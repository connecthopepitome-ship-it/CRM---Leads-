import { Router } from 'express';
import { AuditSearchBody } from '@ss/contracts';
import { daysBetween } from '@ss/domain';
import type { Ctx } from '../context.js';
import type { Where } from '../db/types.js';
import { AppError, fail } from '../http/errors.js';
import { authn, info, P, requirePerm } from '../http/pipeline.js';
import { audit, inScope } from '../shared/core.js';
import { createJob, finishJob } from './platform.js';
import { storeExport } from './documents.js';

export function auditRoutes(ctx: Ctx): Router {
  const r = Router();
  r.use(['/admin/audit', '/history'], authn);

  // RULE-012: immutable — explicit 405 for any change attempt
  r.all('/admin/audit/:id', (req, _res, next) => (['PUT', 'PATCH', 'DELETE'].includes(req.method) ? next(new AppError('AUDIT_IMMUTABLE')) : next()));

  const search = async (body: ReturnType<typeof AuditSearchBody.parse>, limit: number, cursor: string | null) => {
    if (daysBetween(body.from, body.to) > ctx.cfg.auditMaxRangeDays || body.to < body.from) fail('AUDIT_RANGE_TOO_LARGE');
    const where: Where[] = [['at', '>=', `${body.from}T00:00:00.000Z`], ['at', '<=', `${body.to}T23:59:59.999Z`]];
    if (body.userId) where.push(['userId', '==', body.userId]);
    if (body.recordType) where.push(['recordType', '==', body.recordType]);
    if (body.recordId) where.push(['recordId', '==', body.recordId]);
    if (body.action) where.push(['action', '==', body.action]);
    return ctx.db.query('auditLog', { where, orderBy: [['at', 'desc']], limit, cursor });
  };

  // API-040 Search (FR-016)
  r.post('/admin/audit/search', requirePerm('audit:read'), async (req, res) => {
    const body = AuditSearchBody.parse(req.body);
    const page = await search(body, body.limit, body.cursor ?? null);
    const p = P(req);
    if (p.role === 'viewer' || p.isSupport) await ctx.db.tx(async (t) => audit(ctx, t, info(req), { action: 'audit.search', meta: { from: body.from, to: body.to } }));
    res.json(page);
  });

  // API-041 Export (async → xlsx)
  r.post('/admin/audit/export', requirePerm('audit:read'), async (req, res) => {
    const body = AuditSearchBody.parse({ ...req.body, limit: 100 });
    const jobId = await createJob(ctx, P(req).userId, 'audit.export');
    await ctx.db.tx(async (t) => audit(ctx, t, info(req), { action: 'audit.export', meta: { jobId, from: body.from, to: body.to } }));
    res.status(202).json({ jobId });
    void (async () => {
      try {
        const rows: Record<string, unknown>[] = [];
        let cursor: string | null = null;
        do {
          const page = await search(body, 500, cursor);
          rows.push(...page.items);
          cursor = page.nextCursor;
        } while (cursor && rows.length < 100_000);
        const file = await storeExport(ctx, 'audit-log.xlsx', ['at', 'userName', 'action', 'recordType', 'recordId', 'changes', 'ipMasked'], rows.map((x) => ({ ...x, changes: JSON.stringify(x.changes) })));
        await finishJob(ctx, jobId, file);
      } catch (e) {
        await finishJob(ctx, jobId, null, (e as Error).message);
      }
    })();
  });

  // API-042 Record history (FR-016 AC2)
  r.get('/history/:recordType/:recordId', async (req, res) => {
    const p = P(req);
    const recordType = String(req.params.recordType);
    const recordId = String(req.params.recordId);
    const allowed = ['admin', 'viewer', 'support'].includes(p.role);
    if (!allowed) {
      const col: Record<string, [string, Parameters<typeof inScope>[1]]> = { lead: ['leads', 'lead'], customer: ['customers', 'customer'], quote: ['quotations', 'quote'], invoice: ['invoices', 'invoice'], order: ['salesOrders', 'order'], payment: ['payments', 'payment'] };
      const m = col[recordType];
      const doc = m ? await ctx.db.get(m[0], recordId) : null;
      if (!m || !doc || !inScope(p, m[1], 'read', doc.ownerId as string)) fail('NOT_FOUND');
    }
    const items = await ctx.db.query('auditLog', { where: [['recordType', '==', recordType], ['recordId', '==', recordId]], orderBy: [['at', 'desc']], limit: 100, cursor: typeof req.query.cursor === 'string' ? req.query.cursor : null });
    res.json(items);
  });

  return r;
}
