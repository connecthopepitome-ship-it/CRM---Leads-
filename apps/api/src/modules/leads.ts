import { Router } from 'express';
import { BulkBody, ConvertBody, FormSubmitBody, LeadCreateBody, LeadUpdateBody, MergeBody, StageBody } from '@ss/contracts';
import {
  addBusinessMinutes, checkStageChange, CLOSED_STAGES, decideIntake, fillEmpty, normaliseContact, pickOwner, queryToken, searchTokens,
  type AssignmentRule, type KeyTarget,
} from '@ss/domain';
import type { Ctx, Principal } from '../context.js';
import type { Doc, Tx, Where } from '../db/types.js';
import { AppError, fail } from '../http/errors.js';
import { authn, clientIp, info, P, paging, rateLimit, requirePerm, str } from '../http/pipeline.js';
import { audit, created, getSettings, newId, nextCode, notify, nowIso, requireCan, requireModule, requireScope, scopeWhere, sha256, stamp, token, type ReqInfo } from '../shared/core.js';
import { actor, addActivity, cancelOpenFollowUps, idempotent, moveFollowUps } from '../shared/records.js';
import { createCustomerInTx } from './customers.js';
import { masterItems } from './masters.js';

export type ConsentBasis = 'web_form_consent' | 'person_initiated' | 'imported_by_business' | 'existing_customer';

export interface IntakeInput {
  fields: {
    name: string; phone?: string | null; email?: string | null; company?: string | null; city?: string | null; pincode?: string | null; state?: string | null;
    interestProductId?: string | null; expectedValue?: number | null; notes?: string | null; tags?: string[];
  };
  sourceId: string;
  sourceLabel: string;
  consentBasis: ConsentBasis;
  enquiryAt?: string | null;
  explicitOwnerId?: string | null;
  sheet?: { syncId: string; row: number; hash: string } | null;
}
export interface IntakeResult {
  outcome: 'created' | 'merged' | 'linked_customer' | 'logged';
  leadId: string;
}

export function leadTokens(l: Record<string, unknown>) {
  return searchTokens({ names: [l.name as string, l.company as string], phones: [l.phone as string, l.phoneRaw as string], emails: [l.email as string], codes: [l.id as string] });
}

/** Single entry point for every lead source (LLD-leads §4.1). Runs in its own transaction unless `t` is given. */
export async function intake(ctx: Ctx, input: IntakeInput, ri: ReqInfo, t?: Tx): Promise<IntakeResult> {
  const run = async (tx: Tx) => intakeTx(ctx, tx, input, ri);
  return t ? run(t) : ctx.db.tx(run);
}

async function intakeTx(ctx: Ctx, t: Tx, input: IntakeInput, ri: ReqInfo): Promise<IntakeResult> {
  const c = normaliseContact(input.fields);
  if ('error' in c) throw new AppError(c.error as 'LEAD_CONTACT_REQUIRED');
  const settings = await getSettings(ctx, t);
  const targets: KeyTarget[] = [];
  for (const k of c.keys) {
    const d = await t.get('contactKeys', k);
    if (d) targets.push({ leadId: (d.leadId as string) ?? undefined, customerId: (d.customerId as string) ?? undefined, contactId: (d.contactId as string) ?? undefined });
  }
  const leadMap = new Map<string, { id: string; stage: string; mergedIntoId?: string | null }>();
  const leadDocs = new Map<string, Doc>();
  const queue = targets.map((x) => x.leadId).filter((x): x is string => !!x);
  while (queue.length) {
    const id = queue.shift()!;
    if (leadMap.has(id)) continue;
    const l = await t.get('leads', id);
    if (!l) continue;
    leadDocs.set(id, l);
    leadMap.set(id, { id, stage: String(l.stage), mergedIntoId: (l.mergedIntoId as string) ?? null });
    if (l.mergedIntoId) queue.push(String(l.mergedIntoId));
  }
  const decision = decideIntake(targets, leadMap);
  const now = nowIso(ctx);
  const who = actor(ri.principal);

  if (decision.kind === 'merge' || decision.kind === 'log_only') {
    const lead = leadDocs.get(decision.leadId)!;
    const patch: Record<string, unknown> = decision.kind === 'merge' ? fillEmpty(lead, { phone: c.phone, email: c.email, company: input.fields.company, city: input.fields.city, pincode: input.fields.pincode, interestProductId: input.fields.interestProductId }) : {};
    if (decision.kind === 'merge' && decision.reopen) Object.assign(patch, { stage: 'new', stageReasonId: null, stageChangedAt: now });
    const next = { ...lead, ...patch };
    t.update('leads', lead.id, { ...patch, searchTokens: leadTokens(next), lastEnquiryAt: now, version: Number(lead.version ?? 0) + 1, updatedAt: now });
    addActivity(ctx, t, { recordType: 'lead', recordId: lead.id, ownerId: String(lead.ownerId), type: 'system', note: `Re-enquired via ${input.sourceLabel}${input.fields.notes ? ` — ${input.fields.notes}` : ''}`, meta: { reenquiry: true, sourceId: input.sourceId, reopened: decision.kind === 'merge' && decision.reopen }, ...who });
    for (const k of c.keys) if (!(await t.get('contactKeys', k))) t.set('contactKeys', k, { leadId: lead.id, updatedAt: now });
    notify(ctx, t, [String(lead.ownerId)], 'N-002', `${lead.name} enquired again via ${input.sourceLabel}`, `/leads/${lead.id}`, [`lead:${lead.id}`]);
    audit(ctx, t, ri, { action: 'lead.reenquiry', recordType: 'lead', recordId: lead.id, before: lead, after: next, meta: { sourceId: input.sourceId } });
    return { outcome: decision.kind === 'merge' ? 'merged' : 'logged', leadId: lead.id };
  }

  // new lead (possibly linked to an existing customer, RULE-021)
  let ownerId: string;
  const labels = [...c.labels];
  let customerId: string | null = null;
  let ruleNote: string | null = null;
  if (decision.kind === 'link_customer') {
    const cust = await t.get('customers', decision.customerId);
    customerId = decision.customerId;
    ownerId = String(cust?.ownerId ?? input.explicitOwnerId ?? settings.assignment.defaultOwnerId ?? who.userId);
    labels.push('existing_customer');
  } else if (input.explicitOwnerId) {
    ownerId = input.explicitOwnerId;
  } else {
    const users = (await t.query('users', { where: [['status', '==', 'active']], limit: 200 })).items.filter((u) => !u.isSupport && ['sales_exec', 'sales_manager', 'admin'].includes(String(u.role)));
    const territories = settings.mode.mode === 'team' ? await masterItems(ctx, 'territories') : [];
    const rules: AssignmentRule[] = territories.map((m) => ({ id: m.id, type: 'territory', ...(m.data as object), userIds: ((m.data as { userIds?: string[] }).userIds ?? []) }));
    const state = (await t.get('leads_meta', 'assign')) ?? { lastIndexByRule: {} };
    let openCounts: Record<string, number> = {};
    if (settings.assignment.strategy === 'fewest_open') {
      const open = await t.query('leads', { where: [['stage', 'in', ['new', 'contacted', 'interested', 'quotation_sent', 'negotiation']]], limit: 5000 });
      openCounts = open.items.reduce<Record<string, number>>((a, l) => ((a[String(l.ownerId)] = (a[String(l.ownerId)] ?? 0) + 1), a), {});
    }
    const res = pickOwner({
      mode: settings.mode.mode, soloUserId: settings.mode.soloUserId ?? users.find((u) => u.role === 'admin')?.id ?? who.userId,
      defaultOwnerId: settings.assignment.defaultOwnerId ?? users.find((u) => u.role === 'admin')?.id ?? who.userId, strategy: settings.assignment.strategy,
      rules, users: users.filter((u) => u.role !== 'admin' || settings.mode.mode === 'solo' || users.length === 1).map((u) => ({ id: u.id, active: true, openLeads: openCounts[u.id] ?? 0 })),
      lastIndexByRule: (state.lastIndexByRule as Record<string, number>) ?? {}, lead: input.fields,
    });
    ownerId = res.ownerId;
    if (res.fallback) labels.push('rule_fallback');
    ruleNote = res.ruleId;
    t.set('leads_meta', 'assign', { lastIndexByRule: res.lastIndexByRule });
  }
  const id = await nextCode(t, 'lead', 'L-', 6);
  const enquiryAt = input.enquiryAt ?? now;
  const slaDueAt = addBusinessMinutes(new Date(enquiryAt), settings.sla.minutes, settings.sla.calendar).toISOString();
  const lead: Record<string, unknown> = {
    id, name: input.fields.name.trim(), phone: c.phone, phoneRaw: c.phoneRaw, phoneValid: c.phoneValid, email: c.email,
    company: input.fields.company ?? null, city: input.fields.city ?? null, pincode: input.fields.pincode ?? null, state: input.fields.state ?? null,
    interestProductId: input.fields.interestProductId ?? null, expectedValue: input.fields.expectedValue ?? null, notes: input.fields.notes ?? null,
    sourceId: input.sourceId, consentBasis: input.consentBasis, consentAt: now, capturedBy: who.userId,
    stage: 'new', stageReasonId: null, stageChangedAt: now, ownerId, labels: [...new Set(labels)], tags: input.fields.tags ?? [],
    enquiryAt, slaDueAt, firstContactAt: null, slaStatus: 'pending', nextFollowUpAt: null, noAnswerStreak: 0,
    customerId, mergedIntoId: null, convertedAt: null, junkAt: null, sheet: input.sheet ?? null, ...created(ctx, ri.principal),
  };
  lead.searchTokens = leadTokens(lead);
  t.create('leads', id, lead);
  for (const k of c.keys) if (!targets.length || !(await t.get('contactKeys', k))) t.set('contactKeys', k, { leadId: id, updatedAt: now });
  addActivity(ctx, t, { recordType: 'lead', recordId: id, ownerId, customerId, type: 'system', note: `Lead created from ${input.sourceLabel}`, meta: { sourceId: input.sourceId }, ...who });
  if (ownerId !== who.userId || ri.principal === null) addActivity(ctx, t, { recordType: 'lead', recordId: id, ownerId, customerId, type: 'assign', note: `Assigned${ruleNote ? ' by rule' : ''}`, meta: { ownerId, ruleId: ruleNote }, ...who });
  if (ownerId !== who.userId) notify(ctx, t, [ownerId], 'N-001', `New lead: ${lead.name} from ${input.sourceLabel}`, `/leads/${id}`, [`lead:${id}`]);
  audit(ctx, t, ri, { action: 'lead.create', recordType: 'lead', recordId: id, after: lead, meta: { sourceId: input.sourceId, outcome: decision.kind } });
  return { outcome: decision.kind === 'link_customer' ? 'linked_customer' : 'created', leadId: id };
}

export async function sourceLabel(ctx: Ctx, sourceId: string) {
  const m = await ctx.db.get('masters', sourceId);
  return String(m?.name ?? sourceId);
}

export function publicLead(l: Doc) {
  const { searchTokens: _s, sheet: _sh, ...rest } = l;
  return rest;
}

/** Applies a stage change inside a tx (RULE-023) with follow-up side effects (FR-049 AC4). */
export async function applyStage(ctx: Ctx, t: Tx, lead: Doc, to: string, reasonId: string | null, p: Principal | null, opts: { auto?: boolean } = {}) {
  const err = checkStageChange(String(lead.stage), to, { reasonId, role: p?.role ?? 'admin', auto: opts.auto });
  if (err) throw new AppError(err as 'LOST_REASON_REQUIRED');
  if (lead.stage === to) return lead;
  const now = nowIso(ctx);
  const patch: Record<string, unknown> = { stage: to, stageReasonId: reasonId, stageChangedAt: now, junkAt: to === 'junk' ? now.slice(0, 10) : null, ...stamp(ctx, p, Number(lead.version ?? 0)) };
  t.update('leads', lead.id, patch);
  addActivity(ctx, t, { recordType: 'lead', recordId: lead.id, ownerId: String(lead.ownerId), customerId: (lead.customerId as string) ?? null, type: 'stage', note: `Stage: ${lead.stage} → ${to}`, meta: { from: lead.stage, to, reasonId }, ...actor(p) });
  if (to === 'lost' || to === 'junk') await cancelOpenFollowUps(ctx, t, lead.id);
  if (to === 'lost' || to === 'junk') t.update('leads', lead.id, { nextFollowUpAt: null });
  return { ...lead, ...patch };
}

export function leadsRoutes(ctx: Ctx): Router {
  const r = Router();

  // ---------------- public capture (API-083, API-084) ----------------
  const formLimiter = rateLimit('form', ctx.cfg.leadFormRatePerMin, (req) => String(req.params.formId ?? 'x'));
  r.post('/public/forms/:formId/submit', requireModule(ctx, 'webForm'), formLimiter, async (req, res) => {
    const form = await ctx.db.get('webForms', String(req.params.formId));
    const body = FormSubmitBody.safeParse(req.body);
    const origin = req.header('origin') ?? '';
    const spam = async (reason: string) => {
      if (form) await ctx.db.tx(async (t) => t.update('webForms', form.id, { spamCount: Number(form.spamCount ?? 0) + 1, lastSpamReason: reason }));
      res.status(202).json({ ok: true });
    };
    if (!form || !form.active) return void res.status(202).json({ ok: true });
    if (!body.success) return void res.status(400).json({ code: 'VALIDATION_FAILED' });
    const allowed = (form.allowedOrigins as string[]) ?? [];
    if (allowed.length && !allowed.includes(origin)) return spam('origin');
    if (body.data.hp) return spam('honeypot');
    if (body.data.renderedAt && Date.now() - body.data.renderedAt < ctx.cfg.leadFormMinFillMs) return spam('too_fast');
    if (form.consentRequired && !body.data.consent) return spam('no_consent');
    const f = body.data.fields;
    try {
      await intake(ctx, {
        fields: { name: f.name ?? '', phone: f.phone, email: f.email, company: f.company, city: f.city, pincode: f.pincode, notes: f.message ?? f.notes },
        sourceId: String(form.sourceId), sourceLabel: await sourceLabel(ctx, String(form.sourceId)),
        consentBasis: body.data.consent ? 'web_form_consent' : 'person_initiated',
      }, { principal: null, ip: clientIp(req), requestId: req.id, actorOverride: 'public' });
    } catch (e) {
      if (e instanceof AppError) return spam(e.code);
      throw e;
    }
    res.status(202).json({ ok: true });
  });

  r.post('/hooks/leads', rateLimit('hook', 60, (req) => sha256(req.header('x-api-key') ?? '')), async (req, res) => {
    const key = req.header('x-api-key') ?? '';
    const k = key ? (await ctx.db.all('captureKeys', { where: [['keyHash', '==', sha256(key)]] }))[0] : null;
    if (!k || k.revokedAt) fail('API_KEY_INVALID');
    const body = LeadCreateBody.parse(req.body);
    await idempotent(ctx, req, res, `hook:${k!.id}`, false, async () => {
      const result = await intake(ctx, {
        fields: body, sourceId: body.sourceId ?? String(k!.sourceId), sourceLabel: await sourceLabel(ctx, body.sourceId ?? String(k!.sourceId)),
        consentBasis: body.consent ? 'web_form_consent' : 'person_initiated', enquiryAt: body.enquiryAt ?? null,
      }, { principal: null, ip: clientIp(req), requestId: req.id, actorOverride: `hook:${k!.id}` });
      await ctx.db.tx(async (t) => t.update('captureKeys', k!.id, { lastUsedAt: nowIso(ctx) }));
      return { status: 201, body: { outcome: result.outcome, lead: { id: result.leadId } } };
    });
  });

  // ---------------- authenticated ----------------
  r.use(['/leads', '/me/saved-filters', '/admin/lead-capture'], authn);

  // API-070 List
  r.get('/leads', async (req, res) => {
    const p = P(req);
    const scope = scopeWhere(p, 'lead');
    if (!scope) fail('FORBIDDEN');
    const where: Where[] = [...scope!];
    const stage = str(req.query.stage);
    if (stage) where.push(stage.includes(',') ? ['stage', 'in', stage.split(',')] : ['stage', '==', stage]);
    else if (req.query.open === '1') where.push(['stage', 'in', ['new', 'contacted', 'interested', 'quotation_sent', 'negotiation']]);
    if (str(req.query.ownerId)) where.push(['ownerId', '==', str(req.query.ownerId)]);
    if (str(req.query.sourceId)) where.push(['sourceId', '==', str(req.query.sourceId)]);
    if (str(req.query.sla)) where.push(['slaStatus', '==', str(req.query.sla)]);
    const q = str(req.query.q);
    const tok = q ? queryToken(q) : null;
    if (tok) where.push(['searchTokens', 'array-contains', tok]);
    else if (str(req.query.tag)) where.push(['tags', 'array-contains', str(req.query.tag)]);
    if (req.query.due === 'today') where.push(['nextFollowUpAt', '<=', new Date(ctx.clock.now().getTime() + 86_400_000).toISOString()]);
    const sort = str(req.query.sort) ?? 'createdAt';
    const page = await ctx.db.query('leads', { where, orderBy: [[sort === 'name' ? 'name' : sort === 'nextFollowUpAt' ? 'nextFollowUpAt' : 'createdAt', sort === 'name' || sort === 'nextFollowUpAt' ? 'asc' : 'desc']], ...paging(req) });
    res.json({ items: page.items.map(publicLead), nextCursor: page.nextCursor });
  });

  // API-080 Board
  r.get('/leads/board', async (req, res) => {
    const p = P(req);
    const scope = scopeWhere(p, 'lead');
    if (!scope) fail('FORBIDDEN');
    const stages = (await masterItems(ctx, 'pipelineStages')).filter((s) => !['merged'].includes(String(s.key)));
    const columns = await Promise.all(stages.map(async (s) => {
      const where: Where[] = [...scope!, ['stage', '==', s.key]];
      const [count, value, cards] = await Promise.all([ctx.db.count('leads', { where }), ctx.db.sum('leads', 'expectedValue', { where }), ctx.db.query('leads', { where, orderBy: [['updatedAt', 'desc']], limit: 20 })]);
      return { stage: s.key, label: s.name, probabilityPct: (s.data as { probabilityPct?: number }).probabilityPct ?? 0, count, value, cards: cards.items.map(publicLead) };
    }));
    res.json({ columns });
  });

  // API-079 Duplicate check (scoped; out-of-scope matches are masked)
  r.post('/leads/check-duplicate', async (req, res) => {
    const p = P(req);
    const c = normaliseContact({ name: 'x', phone: req.body?.phone, email: req.body?.email });
    if ('error' in c) return void res.json({ matches: [] });
    const matches = [];
    for (const k of c.keys) {
      const d = await ctx.db.get('contactKeys', k);
      if (d?.leadId) {
        const l = await ctx.db.get('leads', String(d.leadId));
        if (l) matches.push(scopeWhere(p, 'lead') && (p.role === 'admin' || l.ownerId === p.userId || p.teamUserIds.includes(String(l.ownerId)) || ['accounts', 'project_manager', 'viewer'].includes(p.role)) ? { type: 'lead', id: l.id, name: l.name, stage: l.stage, ownerId: l.ownerId } : { type: 'lead', id: null, name: 'Existing lead (another owner)' });
      } else if (d?.customerId) {
        const cu = await ctx.db.get('customers', String(d.customerId));
        if (cu) matches.push({ type: 'customer', id: cu.id, name: cu.displayName });
      }
    }
    res.json({ matches });
  });

  // API-071 Create
  r.post('/leads', async (req, res) => {
    const p = P(req);
    requireCan(p, 'lead', 'create');
    const body = LeadCreateBody.parse(req.body);
    const sources = await masterItems(ctx, 'leadSources');
    const sourceId = body.sourceId ?? sources.find((s) => s.key === 'walkin')?.id ?? sources[0]?.id ?? 'manual';
    const settings = await getSettings(ctx);
    const explicitOwnerId = settings.mode.mode === 'team' && p.role === 'sales_exec' && !body.assignAuto ? p.userId : body.assignAuto ? null : settings.mode.mode === 'solo' ? null : p.userId;
    const result = await intake(ctx, {
      fields: body, sourceId, sourceLabel: await sourceLabel(ctx, sourceId), consentBasis: 'person_initiated', explicitOwnerId, enquiryAt: body.enquiryAt ?? null,
    }, info(req));
    const lead = await ctx.db.get('leads', result.leadId);
    res.status(result.outcome === 'created' || result.outcome === 'linked_customer' ? 201 : 200).json({ outcome: result.outcome, lead: lead && publicLead(lead) });
  });

  // API-082 Import (rows parsed client-side from CSV/Excel; ≤ 5,000)
  r.post('/leads/import', requirePerm('lead:import'), async (req, res) => {
    const rows = (req.body?.rows as Record<string, string>[]) ?? [];
    if (!Array.isArray(rows) || rows.length > 5000) fail('VALIDATION_FAILED', 'Upload up to 5,000 rows');
    const sourceId = String(req.body?.sourceId ?? (await masterItems(ctx, 'leadSources')).find((s) => s.key === 'import')?.id ?? 'import');
    const label = await sourceLabel(ctx, sourceId);
    const report = { created: 0, merged: 0, failed: [] as { row: number; reason: string }[] };
    for (const [i, row] of rows.entries()) {
      try {
        const out = await intake(ctx, { fields: { name: row.name ?? '', phone: row.phone, email: row.email, company: row.company, city: row.city, pincode: row.pincode, notes: row.notes }, sourceId, sourceLabel: label, consentBasis: 'imported_by_business' }, info(req));
        if (out.outcome === 'created' || out.outcome === 'linked_customer') report.created++;
        else report.merged++;
      } catch (e) {
        report.failed.push({ row: i + 2, reason: e instanceof AppError ? e.code : 'ERROR' });
      }
    }
    await ctx.db.tx(async (t) => audit(ctx, t, info(req), { action: 'lead.import', meta: { rows: rows.length, created: report.created, merged: report.merged, failed: report.failed.length } }));
    res.json(report);
  });

  // API-072 Get
  r.get('/leads/:id', async (req, res) => {
    const l = await ctx.db.get('leads', String(req.params.id));
    requireScope(P(req), 'lead', 'read', l);
    res.setHeader('ETag', String(l.version ?? 1));
    res.json(publicLead(l));
  });

  // API-073 Update
  r.patch('/leads/:id', async (req, res) => {
    const p = P(req);
    const body = LeadUpdateBody.parse(req.body);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const l = await t.get('leads', id);
      requireScope(p, 'lead', 'update', l);
      if (l.stage === 'merged') fail('LEAD_MERGED', undefined, { mergedIntoId: l.mergedIntoId });
      const ifm = req.header('if-match');
      if (ifm !== undefined && Number(ifm) !== Number(l.version)) throw new AppError('VERSION_CONFLICT', `Changed by ${l.updatedByName ?? 'another user'} — reload`, { changedBy: l.updatedByName });
      const next: Record<string, unknown> = { ...l, ...body };
      if (body.phone !== undefined || body.email !== undefined || body.name !== undefined) {
        const c = normaliseContact({ name: String(next.name), phone: next.phone as string, email: next.email as string });
        if ('error' in c) throw new AppError(c.error as 'LEAD_CONTACT_REQUIRED');
        Object.assign(next, { phone: c.phone, phoneRaw: c.phoneRaw, phoneValid: c.phoneValid, email: c.email });
        for (const k of c.keys) if (!(await t.get('contactKeys', k))) t.set('contactKeys', k, { leadId: id, updatedAt: nowIso(ctx) });
      }
      const patch: Record<string, unknown> = { ...next, searchTokens: leadTokens(next), ...stamp(ctx, p, Number(l.version)) };
      delete patch.id;
      t.set('leads', id, patch);
      audit(ctx, t, info(req), { action: 'lead.update', recordType: 'lead', recordId: id, before: l, after: next });
    });
    res.json(publicLead((await ctx.db.get('leads', id))!));
  });

  // API-074 Stage
  r.post('/leads/:id/stage', async (req, res) => {
    const p = P(req);
    const body = StageBody.parse(req.body);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const l = await t.get('leads', id);
      requireScope(p, 'lead', 'update', l);
      if (CLOSED_STAGES.includes(String(l.stage)) && !['admin', 'sales_manager', 'support'].includes(p.role) && body.stage !== l.stage) fail('REOPEN_FORBIDDEN');
      const after = await applyStage(ctx, t, l, body.stage, body.reasonId ?? null, p);
      audit(ctx, t, info(req), { action: 'lead.stage', recordType: 'lead', recordId: id, before: { stage: l.stage }, after: { stage: after.stage, stageReasonId: body.reasonId ?? null } });
    });
    res.json(publicLead((await ctx.db.get('leads', id))!));
  });

  // API-075 Reopen
  r.post('/leads/:id/reopen', requirePerm('lead:reopen'), async (req, res) => {
    const p = P(req);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const l = await t.get('leads', id);
      requireScope(p, 'lead', 'update', l);
      await applyStage(ctx, t, l, 'new', null, p);
      audit(ctx, t, info(req), { action: 'lead.reopen', recordType: 'lead', recordId: id, before: { stage: l.stage }, after: { stage: 'new' } });
    });
    res.json(publicLead((await ctx.db.get('leads', id))!));
  });

  // API-076 Bulk (FR-032)
  r.post('/leads/bulk', requirePerm('lead:assign'), async (req, res) => {
    const p = P(req);
    const body = BulkBody.parse(req.body);
    if (body.ids.length > 500) fail('BULK_TOO_LARGE');
    const ok: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    if (body.action === 'assign') {
      const target = body.ownerId ? await ctx.db.get('users', body.ownerId) : null;
      if (!target || target.status !== 'active') fail('VALIDATION_FAILED', 'Choose an active user');
      if (p.role === 'sales_manager' && !p.teamUserIds.includes(target!.id)) fail('FORBIDDEN');
    }
    for (let i = 0; i < body.ids.length; i += 50) {
      const chunk = body.ids.slice(i, i + 50);
      await ctx.db.tx(async (t) => {
        for (const id of chunk) {
          const l = await t.get('leads', id);
          if (!l || !scopeWhere(p, 'lead', 'update') || (p.role === 'sales_manager' && !p.teamUserIds.includes(String(l.ownerId)))) {
            skipped.push({ id, reason: l ? 'OUT_OF_SCOPE' : 'NOT_FOUND' });
            continue;
          }
          try {
            if (body.action === 'assign') {
              if (l.ownerId === body.ownerId) {
                ok.push(id);
                continue;
              }
              t.update('leads', id, { ownerId: body.ownerId, ...stamp(ctx, p, Number(l.version)) });
              addActivity(ctx, t, { recordType: 'lead', recordId: id, ownerId: body.ownerId!, type: 'assign', note: `Reassigned to ${body.ownerId}`, meta: { from: l.ownerId, to: body.ownerId }, ...actor(p) });
              await moveFollowUps(ctx, t, id, body.ownerId!);
            } else if (body.action === 'stage') {
              await applyStage(ctx, t, l, String(body.stage), body.reasonId ?? null, p);
            } else {
              const tags = [...new Set([...((l.tags as string[]) ?? []), ...(body.tags ?? [])])];
              t.update('leads', id, { tags, ...stamp(ctx, p, Number(l.version)) });
            }
            ok.push(id);
          } catch (e) {
            skipped.push({ id, reason: e instanceof AppError ? e.code : 'ERROR' });
          }
        }
        audit(ctx, t, info(req), { action: 'lead.bulk', meta: { action: body.action, count: chunk.length, ownerId: body.ownerId ?? null } });
        if (body.action === 'assign' && i === 0) notify(ctx, t, [body.ownerId!], 'N-001', `${body.ids.length} leads assigned to you`, '/leads?ownerId=' + body.ownerId, []);
      });
    }
    res.json({ ok, skipped });
  });

  // API-077 Merge (FR-030)
  r.post('/leads/merge', requirePerm('lead:merge'), async (req, res) => {
    const p = P(req);
    const body = MergeBody.parse(req.body);
    if (body.survivorId === body.otherId) fail('VALIDATION_FAILED');
    await ctx.db.tx(async (t) => {
      const s = await t.get('leads', body.survivorId);
      const o = await t.get('leads', body.otherId);
      requireScope(p, 'lead', 'update', s);
      requireScope(p, 'lead', 'update', o);
      const picks = body.picks ?? {};
      const merged: Record<string, unknown> = { ...s };
      for (const f of ['name', 'phone', 'email', 'company', 'city', 'pincode', 'expectedValue', 'interestProductId']) {
        if (picks[f] === 'other' || (merged[f] == null && o[f] != null)) merged[f] = o[f];
      }
      merged.tags = [...new Set([...((s.tags as string[]) ?? []), ...((o.tags as string[]) ?? [])])];
      merged.searchTokens = leadTokens(merged);
      const mp: Record<string, unknown> = { ...merged, ...stamp(ctx, p, Number(s.version)) };
      delete mp.id;
      t.set('leads', s.id, mp);
      t.update('leads', o.id, { stage: 'merged', mergedIntoId: s.id, ...stamp(ctx, p, Number(o.version)) });
      for (const a of (await t.query('activities', { where: [['recordId', '==', o.id]], limit: 1000 })).items) t.update('activities', a.id, { recordId: s.id, ownerId: s.ownerId });
      for (const q of (await t.query('quotations', { where: [['partyId', '==', o.id]], limit: 200 })).items) t.update('quotations', q.id, { partyId: s.id, leadId: s.id });
      for (const f of (await t.query('files', { where: [['recordId', '==', o.id]], limit: 500 })).items) t.update('files', f.id, { recordId: s.id });
      await moveFollowUps(ctx, t, o.id, String(s.ownerId), { recordType: 'lead', recordId: s.id });
      for (const k of [o.phone && `p:${o.phone}`, o.email && `e:${o.email}`].filter(Boolean) as string[]) t.set('contactKeys', k, { leadId: s.id, updatedAt: nowIso(ctx) });
      addActivity(ctx, t, { recordType: 'lead', recordId: s.id, ownerId: String(s.ownerId), type: 'system', note: `Merged ${o.id} (${o.name}) into this lead`, ...actor(p) });
      audit(ctx, t, info(req), { action: 'lead.merge', recordType: 'lead', recordId: s.id, before: s, after: merged, meta: { otherId: o.id } });
    });
    res.json(publicLead((await ctx.db.get('leads', body.survivorId))!));
  });

  // API-078 Convert (FR-036)
  r.post('/leads/:id/convert', async (req, res) => {
    const p = P(req);
    const body = ConvertBody.parse(req.body);
    const id = String(req.params.id);
    const result = await ctx.db.tx(async (t) => convertLead(ctx, t, id, body, p, info(req)));
    res.json(result);
  });

  // API-081 Saved filters
  r.get('/me/saved-filters', async (req, res) => {
    res.json((await ctx.db.get('savedFilters', P(req).userId)) ?? { items: [] });
  });
  r.put('/me/saved-filters', async (req, res) => {
    const items = ((req.body?.items as unknown[]) ?? []).slice(0, 20);
    await ctx.db.tx(async (t) => t.set('savedFilters', P(req).userId, { items }));
    res.json({ items });
  });

  // API-085 / API-086 Capture keys and forms
  r.get('/admin/lead-capture/keys', requirePerm('settings:read'), async (_req, res) => {
    res.json({ items: (await ctx.db.all('captureKeys')).map(({ keyHash: _k, ...x }) => x) });
  });
  r.post('/admin/lead-capture/keys', requirePerm('settings:write'), async (req, res) => {
    const key = `ssk_${token(24)}`;
    const id = newId('ck_');
    await ctx.db.tx(async (t) => {
      t.create('captureKeys', id, { name: String(req.body?.name ?? 'Webhook'), sourceId: String(req.body?.sourceId ?? ''), keyHash: sha256(key), last4: key.slice(-4), createdAt: nowIso(ctx), createdBy: P(req).userId, revokedAt: null });
      audit(ctx, t, info(req), { action: 'capture_key.create', recordType: 'captureKey', recordId: id });
    });
    res.status(201).json({ id, key });
  });
  r.delete('/admin/lead-capture/keys/:id', requirePerm('settings:write'), async (req, res) => {
    await ctx.db.tx(async (t) => {
      t.update('captureKeys', String(req.params.id), { revokedAt: nowIso(ctx) });
      audit(ctx, t, info(req), { action: 'capture_key.revoke', recordType: 'captureKey', recordId: String(req.params.id) });
    });
    res.status(204).end();
  });
  r.get('/admin/lead-capture/forms/:formId', requirePerm('settings:read'), async (req, res) => {
    res.json((await ctx.db.get('webForms', String(req.params.formId))) ?? null);
  });
  r.put('/admin/lead-capture/forms/:formId', requirePerm('settings:write'), async (req, res) => {
    const id = String(req.params.formId);
    const b = req.body as Record<string, unknown>;
    await ctx.db.tx(async (t) => {
      const cur = await t.get('webForms', id);
      t.set('webForms', id, {
        sourceId: String(b.sourceId ?? cur?.sourceId ?? ''), allowedOrigins: (b.allowedOrigins as string[]) ?? cur?.allowedOrigins ?? [], consentRequired: !!(b.consentRequired ?? cur?.consentRequired),
        consentText: String(b.consentText ?? cur?.consentText ?? 'I agree to be contacted about my enquiry.'), active: b.active !== false, spamCount: Number(cur?.spamCount ?? 0), ...stamp(ctx, P(req), Number(cur?.version ?? 0)),
      });
      audit(ctx, t, info(req), { action: 'web_form.update', recordType: 'webForm', recordId: id, before: cur, after: b });
    });
    res.json(await ctx.db.get('webForms', id));
  });

  return r;
}

/** FR-036: create or link customer, move contact keys, follow-ups, activities, quotes; lead → Won. */
export async function convertLead(ctx: Ctx, t: Tx, leadId: string, body: { mode: 'new' | 'link'; customerId?: string }, p: Principal | null, ri: ReqInfo) {
  const l = await t.get('leads', leadId);
  if (p) requireScope(p, 'lead', 'update', l);
  if (!l) fail('NOT_FOUND');
  if (l!.customerId && l!.stage === 'won') fail('CONVERT_ALREADY_DONE', undefined, { customerId: l!.customerId });
  let customerId: string;
  if (body.mode === 'link' || (l!.customerId && body.mode !== 'new')) {
    customerId = String(body.customerId ?? l!.customerId);
    const c = await t.get('customers', customerId);
    if (!c) fail('NOT_FOUND');
    t.update('customers', customerId, { leadIds: [...new Set([...((c!.leadIds as string[]) ?? []), leadId])] });
    const contactId = newId('ct_');
    t.create('contacts', contactId, { customerId, name: l!.name, role: 'decision_maker', phone: l!.phone, phoneValid: !!l!.phoneValid, email: l!.email, isPrimary: false, consentBasis: l!.consentBasis, consentAt: l!.consentAt, ...created(ctx, p) });
    for (const k of [l!.phone && `p:${l!.phone}`, l!.email && `e:${l!.email}`].filter(Boolean) as string[]) t.set('contactKeys', k, { customerId, contactId, updatedAt: nowIso(ctx) });
  } else {
    customerId = await createCustomerInTx(ctx, t, {
      displayName: String(l!.company || l!.name), legalName: (l!.company as string) ?? null, type: l!.company ? 'business' : 'individual', ownerId: String(l!.ownerId), leadIds: [leadId],
      contact: { name: String(l!.name), phone: (l!.phone as string) ?? null, email: (l!.email as string) ?? null, role: 'decision_maker', consentBasis: l!.consentBasis as string },
      billing: l!.city ? { line1: String(l!.city), city: String(l!.city), stateCode: String(l!.state ?? ''), pincode: (l!.pincode as string) ?? null } : null,
    }, p, ri);
  }
  const now = nowIso(ctx);
  t.update('leads', leadId, { stage: 'won', customerId, convertedAt: now, stageChangedAt: now, ...stamp(ctx, p, Number(l!.version)) });
  for (const a of (await t.query('activities', { where: [['recordId', '==', leadId]], limit: 2000 })).items) t.update('activities', a.id, { customerId });
  await moveFollowUps(ctx, t, leadId, String(l!.ownerId), { recordType: 'customer', recordId: customerId });
  for (const q of (await t.query('quotations', { where: [['leadId', '==', leadId]], limit: 200 })).items) t.update('quotations', q.id, { customerId });
  const leadFiles = (await t.query('files', { where: [['recordId', '==', leadId]], limit: 500 })).items;
  for (const f of leadFiles) t.update('files', f.id, { customerId });
  if (leadFiles.some((f) => f.storage === 'drive')) void ctx.tasks.enqueue('drive.moveLeadFiles', { leadId, customerId, delaySeconds: 10 });
  addActivity(ctx, t, { recordType: 'lead', recordId: leadId, ownerId: String(l!.ownerId), customerId, type: 'stage', note: `Converted to customer`, meta: { customerId }, ...actor(p) });
  audit(ctx, t, ri, { action: 'lead.convert', recordType: 'lead', recordId: leadId, before: { stage: l!.stage }, after: { stage: 'won', customerId } });
  return { customerId };
}
