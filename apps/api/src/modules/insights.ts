import { Router } from 'express';
import { scopeOf, type RoleId } from '@ss/contracts';
import { ageingBucket, istDate, queryToken } from '@ss/domain';
import type { Ctx, Principal } from '../context.js';
import type { Where } from '../db/types.js';
import { fail } from '../http/errors.js';
import { authn, info, P, requirePerm, str } from '../http/pipeline.js';
import { audit, scopeWhere } from '../shared/core.js';
import { masterItems } from './masters.js';
import { createJob, finishJob } from './platform.js';
import { storeExport } from './documents.js';

const OPEN_STAGES = ['new', 'contacted', 'interested', 'quotation_sent', 'negotiation'];

export const REPORTS: Record<string, { name: string; roles: RoleId[] }> = {
  'RPT-002': { name: 'Pipeline by stage', roles: ['admin', 'support', 'sales_manager', 'sales_exec', 'viewer'] },
  'RPT-003': { name: 'Sales', roles: ['admin', 'support', 'sales_manager', 'accounts', 'viewer'] },
  'RPT-004': { name: 'Collections & ageing', roles: ['admin', 'support', 'accounts', 'sales_manager', 'viewer'] },
  'RPT-005': { name: 'Lead source performance', roles: ['admin', 'support', 'sales_manager', 'viewer'] },
  'RPT-006': { name: 'First-contact SLA', roles: ['admin', 'support', 'sales_manager', 'viewer'] },
  'RPT-007': { name: 'Payments received', roles: ['admin', 'support', 'accounts', 'viewer'] },
  'RPT-008': { name: 'GST summary (outward)', roles: ['admin', 'support', 'accounts', 'viewer'] },
  'RPT-009': { name: 'Outstanding by customer', roles: ['admin', 'support', 'accounts', 'sales_manager', 'sales_exec', 'viewer'] },
  'RPT-010': { name: 'Sheet sync log', roles: ['admin', 'support', 'viewer'] },
};

interface Table {
  columns: { key: string; label: string; money?: boolean }[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
}

async function scoped(ctx: Ctx, p: Principal, col: string, res: Parameters<typeof scopeWhere>[1], extra: Where[] = []) {
  const s = scopeWhere(p, res);
  if (!s) return [];
  return ctx.db.all(col, { where: [...s, ...extra] });
}

export async function runReport(ctx: Ctx, p: Principal, id: string, q: Record<string, string | undefined>): Promise<Table> {
  const today = istDate(ctx.clock.now());
  const from = q.from ?? `${today.slice(0, 7)}-01`;
  const to = q.to ?? today;
  const inRange = (d: unknown) => typeof d === 'string' && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  switch (id) {
    case 'RPT-002': {
      const stages = await masterItems(ctx, 'pipelineStages');
      const leads = await scoped(ctx, p, 'leads', 'lead', [['stage', 'in', OPEN_STAGES]]);
      const rows = stages.filter((s) => OPEN_STAGES.includes(String(s.key))).map((s) => {
        const ls = leads.filter((l) => l.stage === s.key);
        const value = ls.reduce((a, l) => a + Number(l.expectedValue ?? 0), 0);
        const prob = Number((s.data as { probabilityPct?: number }).probabilityPct ?? 0);
        return { stage: s.name, count: ls.length, value, weighted: Math.round((value * prob) / 100) };
      });
      return { columns: [{ key: 'stage', label: 'Stage' }, { key: 'count', label: 'Leads' }, { key: 'value', label: 'Value', money: true }, { key: 'weighted', label: 'Weighted value', money: true }], rows };
    }
    case 'RPT-003': {
      const inv = (await scoped(ctx, p, 'invoices', 'invoice')).filter((i) => i.type !== 'proforma' && i.status !== 'draft' && inRange(i.date));
      const byMonth = new Map<string, { month: string; count: number; value: number }>();
      for (const i of inv) {
        const m = String(i.date).slice(0, 7);
        const e = byMonth.get(m) ?? { month: m, count: 0, value: 0 };
        e.count++;
        e.value += Number((i.totals as { grandTotal: number }).grandTotal) - Number(i.credited ?? 0);
        byMonth.set(m, e);
      }
      return { columns: [{ key: 'month', label: 'Month' }, { key: 'count', label: 'Invoices' }, { key: 'value', label: 'Net value', money: true }], rows: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)) };
    }
    case 'RPT-004':
    case 'RPT-009': {
      const asOf = q.asOf ?? today;
      const inv = (await scoped(ctx, p, 'invoices', 'invoice', [['status', 'in', ['issued', 'partly_paid']]])).filter((i) => i.type !== 'proforma' && String(i.date) <= asOf);
      const customers = new Map<string, Record<string, number | string>>();
      for (const i of inv) {
        const c = customers.get(String(i.customerId)) ?? { customer: String(i.customerName), outstanding: 0, not_due: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, overdue: 0 };
        const bal = Number(i.balanceDue ?? 0);
        const b = ageingBucket(String(i.dueDate), asOf);
        (c[b] as number) += bal;
        (c.outstanding as number) += bal;
        if (b !== 'not_due') (c.overdue as number) += bal;
        customers.set(String(i.customerId), c);
      }
      for (const [cid, row] of customers) row.advance = Number(((await ctx.db.get('customers', cid))?.totals as { advance?: number } | undefined)?.advance ?? 0);
      const money = (k: string, l: string) => ({ key: k, label: l, money: true });
      const rows = [...customers.values()].sort((a, b) => Number(b.outstanding) - Number(a.outstanding));
      const sum = (k: string) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
      return id === 'RPT-004'
        ? { columns: [{ key: 'customer', label: 'Customer' }, money('outstanding', 'Outstanding'), money('not_due', 'Not yet due'), money('d1_30', '1–30'), money('d31_60', '31–60'), money('d61_90', '61–90'), money('d90_plus', '90+'), money('advance', 'Advance (separate)')], rows, totals: { outstanding: sum('outstanding'), not_due: sum('not_due'), d1_30: sum('d1_30'), d31_60: sum('d31_60'), d61_90: sum('d61_90'), d90_plus: sum('d90_plus') } }
        : { columns: [{ key: 'customer', label: 'Customer' }, money('outstanding', 'Outstanding'), money('overdue', 'Overdue')], rows, totals: { outstanding: sum('outstanding'), overdue: sum('overdue') } };
    }
    case 'RPT-005':
    case 'RPT-006': {
      const leads = (await scoped(ctx, p, 'leads', 'lead')).filter((l) => inRange(l.createdAt));
      const key = id === 'RPT-005' ? 'sourceId' : 'ownerId';
      const names = new Map<string, string>();
      if (id === 'RPT-005') for (const s of await masterItems(ctx, 'leadSources')) names.set(s.id, String(s.name));
      else for (const u of await ctx.db.all('users')) names.set(u.id, String(u.fullName));
      const groups = new Map<string, Record<string, number | string>>();
      for (const l of leads) {
        const g = groups.get(String(l[key])) ?? { group: names.get(String(l[key])) ?? String(l[key]), leads: 0, withinSla: 0, contacted: 0, minutesSum: 0, converted: 0 };
        (g.leads as number)++;
        if (l.slaStatus === 'met') (g.withinSla as number)++;
        if (l.firstContactAt) {
          (g.contacted as number)++;
          (g.minutesSum as number) += Math.round((new Date(String(l.firstContactAt)).getTime() - new Date(String(l.enquiryAt)).getTime()) / 60_000);
        }
        if (l.stage === 'won') (g.converted as number)++;
        groups.set(String(l[key]), g);
      }
      const rows = [...groups.values()].map((g) => ({ ...g, slaPct: Number(g.leads) ? Math.round((Number(g.withinSla) / Number(g.leads)) * 100) : 0, avgMinutes: Number(g.contacted) ? Math.round(Number(g.minutesSum) / Number(g.contacted)) : null }));
      return {
        columns: [{ key: 'group', label: id === 'RPT-005' ? 'Source' : 'Owner' }, { key: 'leads', label: 'Leads' }, { key: 'withinSla', label: 'Contacted within SLA' }, { key: 'slaPct', label: '% within SLA' }, ...(id === 'RPT-005' ? [{ key: 'converted', label: 'Converted' }] : [{ key: 'avgMinutes', label: 'Avg minutes to first contact' }])],
        rows,
      };
    }
    case 'RPT-007': {
      const pays = (await scoped(ctx, p, 'payments', 'payment', [['status', '==', 'active']])).filter((x) => inRange(x.date));
      return { columns: [{ key: 'receiptNo', label: 'Receipt' }, { key: 'date', label: 'Date' }, { key: 'customerName', label: 'Customer' }, { key: 'mode', label: 'Mode' }, { key: 'reference', label: 'UTR / ref' }, { key: 'amount', label: 'Amount', money: true }, { key: 'tdsAmount', label: 'TDS', money: true }], rows: pays.sort((a, b) => String(a.date).localeCompare(String(b.date))), totals: { amount: pays.reduce((s, x) => s + Number(x.amount), 0), tdsAmount: pays.reduce((s, x) => s + Number(x.tdsAmount ?? 0), 0) } };
    }
    case 'RPT-008': {
      const inv = (await scoped(ctx, p, 'invoices', 'invoice')).filter((i) => i.type === 'tax_invoice' && i.status !== 'draft' && inRange(i.date));
      const rows = new Map<string, Record<string, number | string>>();
      for (const i of inv) {
        const b2 = (i.billTo as { gstin?: string } | null)?.gstin ? 'B2B' : 'B2C';
        for (const l of i.lines as { kind?: string; taxRatePct: number; taxable: number; cgst: number; sgst: number; igst: number }[]) {
          if (l.kind === 'heading') continue;
          const k = `${b2}-${l.taxRatePct}`;
          const r = rows.get(k) ?? { type: b2, ratePct: l.taxRatePct, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
          (r.taxable as number) += l.taxable;
          (r.cgst as number) += l.cgst;
          (r.sgst as number) += l.sgst;
          (r.igst as number) += l.igst;
          rows.set(k, r);
        }
      }
      for (const cn of (await scoped(ctx, p, 'creditNotes', 'invoice')).filter((c) => inRange(c.date))) {
        const r = rows.get('CN') ?? { type: 'Credit notes', ratePct: '', taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        const tx = cn.taxSplit as { cgst: number; sgst: number; igst: number };
        (r.taxable as number) -= Number(cn.amount) - tx.cgst - tx.sgst - tx.igst;
        (r.cgst as number) -= tx.cgst;
        (r.sgst as number) -= tx.sgst;
        (r.igst as number) -= tx.igst;
        rows.set('CN', r);
      }
      return { columns: [{ key: 'type', label: 'Type' }, { key: 'ratePct', label: 'Rate %' }, { key: 'taxable', label: 'Taxable', money: true }, { key: 'cgst', label: 'CGST', money: true }, { key: 'sgst', label: 'SGST', money: true }, { key: 'igst', label: 'IGST', money: true }], rows: [...rows.values()] };
    }
    case 'RPT-010': {
      const runs = (await ctx.db.all('syncRuns', { orderBy: [['startedAt', 'desc']] })).filter((x) => inRange(x.startedAt));
      return { columns: [{ key: 'startedAt', label: 'Started' }, { key: 'trigger', label: 'Trigger' }, { key: 'read', label: 'Read' }, { key: 'created', label: 'Created' }, { key: 'merged', label: 'Merged' }, { key: 'failed', label: 'Failed' }, { key: 'status', label: 'Status' }], rows: runs };
    }
  }
  fail('NOT_FOUND');
  return { columns: [], rows: [] };
}

export function insightsRoutes(ctx: Ctx): Router {
  const r = Router();
  r.use(['/dashboard', '/search', '/reports', '/admin/targets'], authn);

  // API-225 Dashboard (FR-084)
  r.get('/dashboard', async (req, res) => {
    const p = P(req);
    const now = ctx.clock.now();
    const today = istDate(now);
    const endOfToday = new Date(`${today}T18:29:59.999Z`).toISOString();
    const tiles: Record<string, unknown>[] = [];
    const act = scopeWhere(p, 'activity');
    if (act) {
      tiles.push({ id: 'followups_today', value: await ctx.db.count('followUps', { where: [...act, ['status', '==', 'open'], ['dueAt', '>=', now.toISOString()], ['dueAt', '<=', endOfToday]] }), link: '/follow-ups?bucket=today' });
      tiles.push({ id: 'followups_overdue', value: await ctx.db.count('followUps', { where: [...act, ['status', '==', 'open'], ['dueAt', '<', now.toISOString()]] }), link: '/follow-ups?bucket=overdue', tone: 'danger' });
    }
    const ls = scopeWhere(p, 'lead');
    if (ls) {
      tiles.push({ id: 'new_leads', value: await ctx.db.count('leads', { where: [...ls, ['stage', '==', 'new']] }), link: '/leads?stage=new' });
      tiles.push({ id: 'sla_breaches', value: await ctx.db.count('leads', { where: [...ls, ['slaStatus', '==', 'breached'], ['stage', 'in', OPEN_STAGES]] }), link: '/leads?sla=breached', tone: 'warning' });
      tiles.push({ id: 'hot_leads', value: await ctx.db.count('leads', { where: [...ls, ['stage', 'in', ['interested', 'quotation_sent', 'negotiation']]] }), link: '/leads?stage=interested,quotation_sent,negotiation' });
    }
    const qs = scopeWhere(p, 'quote');
    if (qs) tiles.push({ id: 'quotes_awaiting', value: await ctx.db.count('quotations', { where: [...qs, ['status', 'in', ['sent', 'viewed']], ['isLatest', '==', true]] }), link: '/sales?tab=quotes&status=sent,viewed' });
    if (scopeOf(p.role, 'finance', 'read') !== 'none') {
      const inv = scopeWhere(p, 'invoice') ?? [];
      const overdue = (await ctx.db.all('invoices', { where: [...inv, ['status', 'in', ['issued', 'partly_paid']], ['dueDate', '<', today]] })).filter((i) => i.type !== 'proforma');
      tiles.push({ id: 'overdue_invoices', value: overdue.length, amount: overdue.reduce((s, i) => s + Number(i.balanceDue ?? 0), 0), link: '/sales?tab=invoices&overdue=1', tone: 'danger' });
      const pays = await ctx.db.all('payments', { where: [...(scopeWhere(p, 'payment') ?? []), ['status', '==', 'active'], ['date', '>=', `${today.slice(0, 7)}-01`]] });
      tiles.push({ id: 'collections_month', amount: pays.reduce((s, x) => s + Number(x.amount), 0), link: '/sales?tab=payments' });
    }
    if (ls) {
      const pipe = await runReport(ctx, p, 'RPT-002', {});
      tiles.push({ id: 'pipeline', stages: pipe.rows });
    }
    const target = await ctx.db.get('targets', `${today.slice(0, 7)}-${p.userId}`);
    if (target) {
      const inv = (await ctx.db.all('invoices', { where: [['ownerId', '==', p.userId], ['date', '>=', `${today.slice(0, 7)}-01`]] })).filter((i) => i.type !== 'proforma' && i.status !== 'draft');
      tiles.push({ id: 'target', target: target.amount, achieved: inv.reduce((s, i) => s + Number((i.totals as { grandTotal: number }).grandTotal) - Number(i.credited ?? 0), 0) });
    }
    res.json({ tiles });
  });

  // API-226 Global search (FR-083)
  r.get('/search', async (req, res) => {
    const p = P(req);
    const q = str(req.query.q) ?? '';
    const tok = queryToken(q);
    if (!tok) fail('SEARCH_QUERY_SHORT');
    const groups: Record<string, unknown[]> = {};
    const add = async (key: string, col: string, res2: Parameters<typeof scopeWhere>[1], map: (d: Record<string, unknown>) => Record<string, unknown>) => {
      const s = scopeWhere(p, res2);
      if (!s) return;
      const items = await ctx.db.query(col, { where: [...s, ['searchTokens', 'array-contains', tok]], limit: 5 });
      if (items.items.length) groups[key] = items.items.map(map);
    };
    await Promise.all([
      add('leads', 'leads', 'lead', (d) => ({ id: d.id, title: d.name, subtitle: d.phone ?? d.email, link: `/leads/${d.id}` })),
      add('customers', 'customers', 'customer', (d) => ({ id: d.id, title: d.displayName, subtitle: d.code, link: `/customers/${d.id}` })),
      add('quotes', 'quotations', 'quote', (d) => ({ id: d.id, title: d.displayNumber ?? 'Draft quote', subtitle: d.partyName, link: `/sales/quotes/${d.id}` })),
      add('invoices', 'invoices', 'invoice', (d) => ({ id: d.id, title: d.number ?? 'Draft invoice', subtitle: d.customerName, link: `/sales/invoices/${d.id}` })),
      add('payments', 'payments', 'payment', (d) => ({ id: d.id, title: d.receiptNo, subtitle: d.customerName, link: `/sales/payments/${d.id}` })),
    ]);
    res.json({ q, groups });
  });

  // API-227 / 228 / 229 Reports (FR-085)
  r.get('/reports', async (req, res) => {
    const p = P(req);
    res.json({ items: Object.entries(REPORTS).filter(([, v]) => v.roles.includes(p.role)).map(([id, v]) => ({ id, name: v.name })) });
  });
  r.get('/reports/:id', async (req, res) => {
    const p = P(req);
    const id = String(req.params.id);
    if (!REPORTS[id] || !REPORTS[id]!.roles.includes(p.role)) fail('FORBIDDEN');
    const t = await runReport(ctx, p, id, req.query as Record<string, string>);
    if (t.rows.length > 2000) fail('REPORT_TOO_LARGE');
    res.json({ id, name: REPORTS[id]!.name, ...t });
  });
  r.post('/reports/:id/export', async (req, res) => {
    const p = P(req);
    const id = String(req.params.id);
    if (!REPORTS[id] || !REPORTS[id]!.roles.includes(p.role)) fail('FORBIDDEN');
    const jobId = await createJob(ctx, p.userId, 'report.export');
    await ctx.db.tx(async (t) => audit(ctx, t, info(req), { action: 'report.export', meta: { reportId: id, jobId } }));
    res.status(202).json({ jobId });
    void (async () => {
      try {
        const t = await runReport(ctx, p, id, (req.body ?? {}) as Record<string, string>);
        const rows = t.rows.map((row) => Object.fromEntries(t.columns.map((c) => [c.label, c.money ? Number(row[c.key] ?? 0) / 100 : row[c.key]])));
        await finishJob(ctx, jobId, await storeExport(ctx, `${id}-${REPORTS[id]!.name.replace(/\W+/g, '-')}.xlsx`, t.columns.map((c) => c.label), rows));
      } catch (e) {
        await finishJob(ctx, jobId, null, (e as Error).message);
      }
    })();
  });

  // API-230 Targets
  r.get('/admin/targets', async (req, res) => {
    const month = str(req.query.month) ?? istDate(ctx.clock.now()).slice(0, 7);
    res.json({ items: (await ctx.db.all('targets', { where: [['month', '==', month]] })) });
  });
  r.put('/admin/targets', requirePerm('settings:write'), async (req, res) => {
    const items = (req.body?.items as { month: string; userId: string; amount: number }[]) ?? [];
    await ctx.db.tx(async (t) => {
      for (const it of items.slice(0, 100)) t.set('targets', `${it.month}-${it.userId}`, { month: it.month, userId: it.userId, amount: Math.max(0, Math.round(it.amount)) });
      audit(ctx, t, info(req), { action: 'targets.update', meta: { count: items.length } });
    });
    res.json({ ok: true });
  });

  return r;
}

