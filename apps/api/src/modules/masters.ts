import { Router } from 'express';
import { z } from 'zod';
import { CompanyBody, MasterItemBody } from '@ss/contracts';
import { GSTIN_PATTERN, HSN_PATTERN, SAC_PATTERN, TEMPLATE_VARIABLES, unknownTemplateVariables, VPA_PATTERN, validateGstin } from '@ss/domain';
import type { Ctx } from '../context.js';
import type { Tx } from '../db/types.js';
import { AppError, fail } from '../http/errors.js';
import { authn, info, P, requirePerm } from '../http/pipeline.js';
import { audit, created, getCompany, newId, stamp } from '../shared/core.js';

export const MASTER_TYPES = ['bankAccounts', 'upiIds', 'products', 'productCategories', 'units', 'taxRates', 'paymentTerms', 'paymentModes', 'termsTemplates', 'messageTemplates',
  'documentLayouts', 'leadSources', 'pipelineStages', 'lostReasons', 'junkReasons', 'callOutcomes', 'territories', 'tags', 'customerGroups', 'customerTypes', 'states'] as const;
export type MasterType = (typeof MASTER_TYPES)[number];

const GROUP: Record<MasterType, string> = {
  products: 'catalogue', productCategories: 'catalogue', units: 'catalogue',
  termsTemplates: 'templates', messageTemplates: 'templates', documentLayouts: 'templates',
  leadSources: 'sales', pipelineStages: 'sales', lostReasons: 'sales', junkReasons: 'sales', callOutcomes: 'sales', territories: 'sales', tags: 'sales', customerGroups: 'sales', customerTypes: 'sales',
  bankAccounts: 'finance', upiIds: 'finance', taxRates: 'finance', paymentTerms: 'finance', paymentModes: 'finance', states: 'finance',
};

/** Per-type data validation (TBL-031 – TBL-036). */
export const DATA: Partial<Record<MasterType, z.ZodTypeAny>> = {
  products: z.object({
    type: z.enum(['goods', 'service']), hsnSac: z.string().optional().nullable(), unit: z.string().default('Nos'), ratePaise: z.number().int().min(0),
    costPaise: z.number().int().min(0).optional(), taxRatePct: z.number().min(0).max(28), description: z.string().max(1000).optional(),
  }).refine((d) => !d.hsnSac || (d.type === 'service' ? SAC_PATTERN.test(d.hsnSac) : HSN_PATTERN.test(d.hsnSac)), 'HSN must be 4–8 digits, SAC 6 digits'),
  bankAccounts: z.object({ bankName: z.string().min(2), accountNo: z.string().regex(/^\d{6,18}$/), ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter an 11-character IFSC like HDFC0001234'), branch: z.string().optional(), showOnInvoice: z.boolean().default(true) }),
  upiIds: z.object({ vpa: z.string().regex(VPA_PATTERN, 'Enter a UPI ID like name@okhdfcbank (no spaces)'), payeeName: z.string().min(1).max(50), trEnabled: z.boolean().default(true) }),
  taxRates: z.object({ ratePct: z.union([z.literal(0), z.literal(0.25), z.literal(3), z.literal(5), z.literal(12), z.literal(18), z.literal(28)]) }),
  paymentTerms: z.object({ days: z.number().int().min(0).max(365), advancePct: z.number().min(0).max(100).default(0) }),
  paymentModes: z.object({ code: z.string(), referenceRequired: z.boolean() }),
  messageTemplates: z.object({ channel: z.enum(['whatsapp', 'email']), purpose: z.string(), subject: z.string().optional(), body: z.string().max(4000) }),
  termsTemplates: z.object({ docType: z.string(), text: z.string().max(5000) }),
  pipelineStages: z.object({ probabilityPct: z.number().min(0).max(100).default(0), system: z.boolean().default(false) }),
  callOutcomes: z.object({ code: z.string(), countsAsContact: z.boolean().default(true), autoStage: z.string().optional().nullable(), autoFollowUpDays: z.number().int().min(0).max(60).optional().nullable() }),
  territories: z.object({ pincodeFrom: z.string().optional(), pincodeTo: z.string().optional(), cities: z.array(z.string()).default([]), userIds: z.array(z.string()).default([]) }),
};

export const isMasterType = (t: string): t is MasterType => (MASTER_TYPES as readonly string[]).includes(t);

export async function masterItems(ctx: Ctx, type: MasterType, activeOnly = true) {
  const where: [string, '==', unknown][] = [['type', '==', type]];
  if (activeOnly) where.push(['status', '==', 'active']);
  return ctx.db.all('masters', { where, orderBy: [['sortOrder', 'asc'], ['name', 'asc']] });
}

/** Mark a master value in use (RULE-013) within a business tx. */
export function markInUse(t: Tx, ids: (string | null | undefined)[]) {
  for (const id of ids) if (id) t.update('masters', id, { inUse: true });
}

export function mastersRoutes(ctx: Ctx): Router {
  const r = Router();
  r.use(['/admin/masters', '/masters', '/admin/company'], authn);

  const canWrite = (type: MasterType) => `masters:write:${GROUP[type]}`;

  // API-045 List
  r.get('/admin/masters/:type', async (req, res) => {
    const type = String(req.params.type);
    if (!isMasterType(type)) fail('NOT_FOUND');
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    let items = await ctx.db.all('masters', { where: [['type', '==', type], ...(status ? [['status', '==', status] as [string, '==', string]] : [])], orderBy: [['sortOrder', 'asc'], ['name', 'asc']] });
    const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : '';
    if (q) items = items.filter((i) => String(i.name).toLowerCase().includes(q) || String(i.key ?? '').toLowerCase().includes(q));
    res.json({ items, nextCursor: null });
  });

  // API-046 Create
  r.post('/admin/masters/:type', async (req, res) => {
    const type = String(req.params.type);
    if (!isMasterType(type)) fail('NOT_FOUND');
    requirePermSync(req, canWrite(type as MasterType));
    const body = MasterItemBody.parse(req.body);
    const data = DATA[type as MasterType]?.parse(body.data ?? {}) ?? body.data ?? {};
    await checkMasterData(type, data as Record<string, unknown>);
    const id = newId('m_');
    await ctx.db.tx(async (t) => {
      if (body.key) {
        const k = `${type}-${body.key.toLowerCase()}`;
        if (await t.get('masterKeys', k)) fail('MASTER_KEY_TAKEN');
        t.create('masterKeys', k, { masterId: id });
      }
      if (req.body?.isDefault) await clearDefault(t, type);
      t.create('masters', id, { type, key: body.key ?? null, name: body.name, sortOrder: body.sortOrder ?? 100, data, status: 'active', inUse: false, isDefault: !!req.body?.isDefault, ...created(ctx, P(req)) });
      audit(ctx, t, info(req), { action: 'master.create', recordType: type, recordId: id, after: { name: body.name, ...data } });
    });
    res.status(201).json({ ...(await ctx.db.get('masters', id)), warnings: await warningsFor(type, data as Record<string, unknown>) });
  });

  /** FR-021 AC1 template variables. */
  async function checkMasterData(type: string, data: Record<string, unknown>) {
    if (type === 'messageTemplates') {
      const bad = unknownTemplateVariables(`${data.subject ?? ''} ${data.body ?? ''}`);
      if (bad.length) throw new AppError('TEMPLATE_UNKNOWN_VARIABLE', `Unknown variable {{${bad[0]}}}. You can use: ${TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(', ')}.`, { unknown: bad, allowed: [...TEMPLATE_VARIABLES] });
    }
  }
  /** FR-019 AC2: GST-registered and no HSN/SAC → saved, with a warning. */
  async function warningsFor(type: string, data: Record<string, unknown>) {
    if (type !== 'products' || data.hsnSac) return [];
    return (await getCompany(ctx)).gstRegistered ? ['Add an HSN/SAC code — this item cannot be used on a tax invoice until it has one.'] : [];
  }

  async function clearDefault(t: Tx, type: string) {
    for (const d of (await t.query('masters', { where: [['type', '==', type], ['isDefault', '==', true]], limit: 20 })).items) t.update('masters', d.id, { isDefault: false });
  }

  // API-047 Update
  r.patch('/admin/masters/:type/:id', async (req, res) => {
    const type = String(req.params.type);
    const id = String(req.params.id);
    if (!isMasterType(type)) fail('NOT_FOUND');
    requirePermSync(req, canWrite(type as MasterType));
    const body = MasterItemBody.partial().parse(req.body);
    await ctx.db.tx(async (t) => {
      const cur = await t.get('masters', id);
      if (!cur || cur.type !== type) fail('NOT_FOUND');
      const data = body.data ? DATA[type as MasterType]?.parse({ ...(cur!.data as object), ...body.data }) ?? body.data : cur!.data;
      if (req.body?.isDefault === true) await clearDefault(t, type);
      t.update('masters', id, { ...(body.name ? { name: body.name } : {}), ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}), data, ...(req.body?.isDefault !== undefined ? { isDefault: !!req.body.isDefault } : {}), ...stamp(ctx, P(req), Number(cur!.version ?? 0)) });
      audit(ctx, t, info(req), { action: 'master.update', recordType: type, recordId: id, before: { name: cur!.name, ...(cur!.data as object) }, after: { name: body.name ?? cur!.name, ...(data as object) } });
    });
    res.json(await ctx.db.get('masters', id));
  });

  // API-048 / 049 Deactivate / activate (RULE-013)
  for (const [path, status] of [['deactivate', 'inactive'], ['activate', 'active']] as const) {
    r.post(`/admin/masters/:type/:id/${path}`, async (req, res) => {
      const type = String(req.params.type);
      if (!isMasterType(type)) fail('NOT_FOUND');
      requirePermSync(req, canWrite(type as MasterType));
      const id = String(req.params.id);
      await ctx.db.tx(async (t) => {
        const cur = await t.get('masters', id);
        if (!cur) fail('NOT_FOUND');
        t.update('masters', id, { status, isDefault: status === 'inactive' ? false : cur!.isDefault });
        audit(ctx, t, info(req), { action: `master.${path}`, recordType: type, recordId: id });
      });
      res.json(await ctx.db.get('masters', id));
    });
  }

  // API-050 Delete unused
  r.delete('/admin/masters/:type/:id', async (req, res) => {
    const type = String(req.params.type);
    if (!isMasterType(type)) fail('NOT_FOUND');
    requirePermSync(req, canWrite(type as MasterType));
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const cur = await t.get('masters', id);
      if (!cur) fail('NOT_FOUND');
      if (cur!.inUse) fail('MASTER_IN_USE');
      t.delete('masters', id);
      if (cur!.key) t.delete('masterKeys', `${type}-${String(cur!.key).toLowerCase()}`);
      audit(ctx, t, info(req), { action: 'master.delete', recordType: type, recordId: id, before: { name: cur!.name } });
    });
    res.status(204).end();
  });

  // API-051 Lookup options
  r.get('/masters/:type/options', async (req, res) => {
    const type = String(req.params.type);
    if (!isMasterType(type)) fail('NOT_FOUND');
    const items = await masterItems(ctx, type as MasterType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.json({ items: items.map((i) => ({ id: i.id, key: i.key, label: i.name, isDefault: !!i.isDefault, data: i.data })) });
  });

  // API-052 / 053 Company profile (FR-017)
  r.get('/admin/company', async (_req, res) => {
    res.json((await ctx.db.get('settings_company', 'company')) ?? null);
  });
  r.put('/admin/company', requirePerm('settings:write'), async (req, res) => {
    const body = CompanyBody.parse(req.body);
    if (body.gstRegistered) {
      if (!body.gstin || !GSTIN_PATTERN.test(body.gstin)) fail('GSTIN_INVALID');
      const err = validateGstin(body.gstin!, body.stateCode);
      if (err) fail(err as 'GSTIN_STATE_MISMATCH');
    }
    await ctx.db.tx(async (t) => {
      const cur = await t.get('settings_company', 'company');
      t.set('settings_company', 'company', { ...body, ...stamp(ctx, P(req), Number(cur?.version ?? 0)) });
      audit(ctx, t, info(req), { action: 'company.update', recordType: 'company', recordId: 'company', before: (cur as Record<string, unknown>) ?? {}, after: body });
    });
    res.json(await ctx.db.get('settings_company', 'company'));
  });

  return r;
}

function requirePermSync(req: Parameters<ReturnType<typeof requirePerm>>[0], perm: string) {
  let err: unknown = null;
  requirePerm(perm)(req, {} as never, (e?: unknown) => (err = e ?? null));
  if (err) throw err;
}

/** Seed data per install (FR-002, Q-023 web-services catalogue). */
export async function seedMasters(ctx: Ctx, withWebCatalogue: boolean) {
  const existing = await ctx.db.count('masters');
  if (existing) return;
  const items: [MasterType, string, string | null, number, Record<string, unknown>][] = [
    ['leadSources', 'Walk-in / phone', 'walkin', 1, {}], ['leadSources', 'Website form', 'web_form', 2, {}], ['leadSources', 'Google Sheet', 'sheet', 3, {}],
    ['leadSources', 'Referral', 'referral', 4, {}], ['leadSources', 'CSV import', 'import', 5, {}], ['leadSources', 'Webhook', 'webhook', 6, {}],
    ['pipelineStages', 'New', 'new', 1, { probabilityPct: 5, system: true }], ['pipelineStages', 'Contacted', 'contacted', 2, { probabilityPct: 15 }],
    ['pipelineStages', 'Interested', 'interested', 3, { probabilityPct: 35 }], ['pipelineStages', 'Quotation Sent', 'quotation_sent', 4, { probabilityPct: 55 }],
    ['pipelineStages', 'Negotiation', 'negotiation', 5, { probabilityPct: 75 }], ['pipelineStages', 'Won', 'won', 6, { probabilityPct: 100, system: true }],
    ['pipelineStages', 'Lost', 'lost', 7, { probabilityPct: 0, system: true }], ['pipelineStages', 'Junk', 'junk', 8, { probabilityPct: 0, system: true }],
    ['lostReasons', 'Price too high', 'price', 1, {}], ['lostReasons', 'Chose competitor', 'competitor', 2, {}], ['lostReasons', 'No response', 'no_response', 3, {}], ['lostReasons', 'Not needed now', 'not_now', 4, {}],
    ['junkReasons', 'Spam / fake', 'spam', 1, {}], ['junkReasons', 'Wrong number', 'wrong_number', 2, {}], ['junkReasons', 'Duplicate', 'duplicate', 3, {}],
    ['callOutcomes', 'Connected', 'connected', 1, { code: 'connected', countsAsContact: true, autoStage: 'contacted' }],
    ['callOutcomes', 'No answer', 'no_answer', 2, { code: 'no_answer', countsAsContact: true }], ['callOutcomes', 'Busy', 'busy', 3, { code: 'busy', countsAsContact: true }],
    ['callOutcomes', 'Wrong number', 'wrong_number', 4, { code: 'wrong_number', countsAsContact: true }], ['callOutcomes', 'Call back later', 'call_back', 5, { code: 'call_back', countsAsContact: true, autoFollowUpDays: 1 }],
    ['taxRates', 'GST 0%', 'gst0', 1, { ratePct: 0 }], ['taxRates', 'GST 5%', 'gst5', 2, { ratePct: 5 }], ['taxRates', 'GST 12%', 'gst12', 3, { ratePct: 12 }],
    ['taxRates', 'GST 18%', 'gst18', 4, { ratePct: 18 }], ['taxRates', 'GST 28%', 'gst28', 5, { ratePct: 28 }],
    ['paymentTerms', 'Due on receipt', 'due', 1, { days: 0, advancePct: 0 }], ['paymentTerms', 'Net 15', 'net15', 2, { days: 15, advancePct: 0 }],
    ['paymentTerms', 'Net 30', 'net30', 3, { days: 30, advancePct: 0 }], ['paymentTerms', '50% advance', 'adv50', 4, { days: 0, advancePct: 50 }],
    ['paymentModes', 'UPI', 'upi', 1, { code: 'upi', referenceRequired: true }], ['paymentModes', 'Bank transfer (NEFT/RTGS/IMPS)', 'neft', 2, { code: 'neft', referenceRequired: true }],
    ['paymentModes', 'Cheque', 'cheque', 3, { code: 'cheque', referenceRequired: true }], ['paymentModes', 'Card', 'card', 4, { code: 'card', referenceRequired: true }], ['paymentModes', 'Cash', 'cash', 5, { code: 'cash', referenceRequired: false }],
    ['units', 'Nos', 'nos', 1, {}], ['units', 'Hours', 'hrs', 2, {}], ['units', 'Months', 'months', 3, {}], ['units', 'Pages', 'pages', 4, {}],
    ['messageTemplates', 'Greeting', 'greeting', 1, { channel: 'whatsapp', purpose: 'greeting', body: 'Hi {{name}}, thanks for your enquiry with {{company}}. When is a good time to talk?' }],
    ['messageTemplates', 'Quote link', 'quote', 2, { channel: 'whatsapp', purpose: 'quote', body: 'Hi {{name}}, here is your quotation {{doc_no}} from {{company}}: {{link}}' }],
    ['messageTemplates', 'Invoice / pay link', 'invoice', 3, { channel: 'whatsapp', purpose: 'invoice', body: 'Hi {{name}}, invoice {{doc_no}} for ₹{{amount}} is ready. View and pay via UPI: {{link}}' }],
    ['messageTemplates', 'Payment reminder', 'reminder', 4, { channel: 'whatsapp', purpose: 'reminder', body: 'Hi {{name}}, a gentle reminder that ₹{{amount}} is due on {{doc_no}}. Pay via UPI: {{link}}' }],
    ['messageTemplates', 'Receipt', 'receipt', 5, { channel: 'whatsapp', purpose: 'receipt', body: 'Hi {{name}}, we received ₹{{amount}}. Receipt {{doc_no}}: {{link}}. Thank you!' }],
    ['messageTemplates', 'Quote email', 'quote_email', 6, { channel: 'email', purpose: 'quote', subject: 'Quotation {{doc_no}} from {{company}}', body: '<p>Hi {{name}},</p><p>Please find our quotation {{doc_no}}: <a href="{{link}}">view online</a>.</p>' }],
    ['termsTemplates', 'Standard quotation terms', 'quote_terms', 1, { docType: 'quote', text: '1. Prices are valid until the date shown.\n2. 50% advance to start; balance on delivery.\n3. Taxes as applicable.' }],
  ];
  if (withWebCatalogue) {
    items.push(
      ['products', 'Website – Basic (5 pages)', 'WEB-BASIC', 1, { type: 'service', hsnSac: '998314', unit: 'Nos', ratePaise: 2_500_000, taxRatePct: 18 }],
      ['products', 'Website – Business (10 pages)', 'WEB-BIZ', 2, { type: 'service', hsnSac: '998314', unit: 'Nos', ratePaise: 5_000_000, taxRatePct: 18 }],
      ['products', 'E-commerce store setup', 'WEB-ECOM', 3, { type: 'service', hsnSac: '998314', unit: 'Nos', ratePaise: 9_000_000, taxRatePct: 18 }],
      ['products', 'Annual maintenance', 'AMC', 4, { type: 'service', hsnSac: '998313', unit: 'Months', ratePaise: 300_000, taxRatePct: 18 }],
      ['products', 'Domain + hosting (1 year)', 'HOST', 5, { type: 'service', hsnSac: '998315', unit: 'Nos', ratePaise: 600_000, taxRatePct: 18 }],
      ['products', 'Logo design', 'LOGO', 6, { type: 'service', hsnSac: '998391', unit: 'Nos', ratePaise: 800_000, taxRatePct: 18 }],
      ['products', 'Developer hour', 'DEV-HR', 7, { type: 'service', hsnSac: '998314', unit: 'Hours', ratePaise: 150_000, taxRatePct: 18 }],
    );
  }
  await ctx.db.tx(async (t) => {
    for (const [type, name, key, sortOrder, data] of items) {
      const id = `m_${type}_${key}`;
      t.set('masters', id, { type, key, name, sortOrder, data, status: 'active', inUse: false, isDefault: false, ...created(ctx, null) });
      if (key) t.set('masterKeys', `${type}-${key.toLowerCase()}`, { masterId: id });
    }
  });
}
