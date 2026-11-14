import type { Request, Response } from 'express';
import type { Ctx, Principal } from '../context.js';
import type { Tx } from '../db/types.js';
import { AppError } from '../http/errors.js';
import { newId, nowIso, sha256 } from './core.js';

export interface ActivityInput {
  id?: string;
  recordType: 'lead' | 'customer';
  recordId: string;
  ownerId: string;
  customerId?: string | null;
  type: string;
  status?: 'pending' | 'done' | 'failed';
  note?: string | null;
  meta?: Record<string, unknown>;
  outcomeId?: string | null;
  outcomeLabel?: string | null;
  userId: string;
  userName: string;
  deviceAt?: string | null;
}

/** TBL-050 activity write (always inside a business tx). */
export function addActivity(ctx: Ctx, t: Tx, a: ActivityInput): string {
  const id = a.id ?? newId('act_');
  const now = nowIso(ctx);
  const deviceAt = a.deviceAt ?? null;
  const skew = deviceAt ? Math.abs(new Date(deviceAt).getTime() - ctx.clock.now().getTime()) > 86_400_000 : false;
  t.create('activities', id, {
    recordType: a.recordType, recordId: a.recordId, ownerId: a.ownerId, customerId: a.customerId ?? (a.recordType === 'customer' ? a.recordId : null),
    type: a.type, status: a.status ?? 'done', note: a.note ?? null, meta: a.meta ?? null, outcomeId: a.outcomeId ?? null, outcomeLabel: a.outcomeLabel ?? null,
    userId: a.userId, userName: a.userName, occurredAt: deviceAt && !skew ? deviceAt : now, deviceAt, receivedAt: now, clockSkew: skew,
  });
  return id;
}

export const actor = (p: Principal | null) => ({ userId: p?.userId ?? 'system', userName: p?.name ?? 'System' });

export async function cancelOpenFollowUps(ctx: Ctx, t: Tx, recordId: string) {
  const open = await t.query('followUps', { where: [['recordId', '==', recordId], ['status', '==', 'open']], limit: 200 });
  for (const f of open.items) t.update('followUps', f.id, { status: 'cancelled', completedAt: nowIso(ctx), version: Number(f.version ?? 0) + 1 });
  return open.items.length;
}

export async function moveFollowUps(_ctx: Ctx, t: Tx, recordId: string, ownerId: string, newRecord?: { recordType: string; recordId: string }) {
  const open = await t.query('followUps', { where: [['recordId', '==', recordId], ['status', '==', 'open']], limit: 200 });
  for (const f of open.items) t.update('followUps', f.id, { ownerId, ...(newRecord ?? {}), version: Number(f.version ?? 0) + 1 });
  return open.items.length;
}

/** Recompute the lead/customer `nextFollowUpAt` denormalisation. */
export async function refreshNextFollowUp(t: Tx, recordType: string, recordId: string, extra?: { dueAt: string } | null) {
  const open = await t.query('followUps', { where: [['recordId', '==', recordId], ['status', '==', 'open']], orderBy: [['dueAt', 'asc']], limit: 1 });
  let next = (open.items[0]?.dueAt as string | undefined) ?? null;
  if (extra && (!next || extra.dueAt < next)) next = extra.dueAt;
  t.update(recordType === 'lead' ? 'leads' : 'customers', recordId, { nextFollowUpAt: next });
}

/** Idempotency (TBL-000, RULE-059): replays the stored response for a repeated key within 24 h. */
export async function idempotent(ctx: Ctx, req: Request, res: Response, scope: string, required: boolean, handler: () => Promise<{ status: number; body: unknown }>) {
  const key = req.header('idempotency-key');
  if (!key) {
    if (required) throw new AppError('VALIDATION_FAILED', 'Idempotency-Key header is required');
    const out = await handler();
    res.status(out.status).json(out.body);
    return;
  }
  const id = sha256(`${scope}:${key}`);
  const reqHash = sha256(JSON.stringify(req.body ?? {}));
  const existing = await ctx.db.get('idempotency', id);
  if (existing && new Date(existing.expireAt as string) > ctx.clock.now()) {
    if (existing.reqHash !== reqHash) throw new AppError('IDEMPOTENCY_KEY_REUSED');
    if (existing.status === 'done') {
      res.setHeader('Idempotent-Replay', 'true');
      res.status(Number(existing.httpStatus)).json(existing.body);
      return;
    }
  }
  const expireAt = new Date(ctx.clock.now().getTime() + 86_400_000).toISOString();
  // claim the key first so concurrent duplicates cannot both run the handler
  await ctx.db.tx(async (t) => {
    const cur = await t.get('idempotency', id);
    if (cur && new Date(cur.expireAt as string) > ctx.clock.now()) throw new AppError('VERSION_CONFLICT', 'The same request is already being processed');
    t.set('idempotency', id, { reqHash, status: 'pending', expireAt });
  });
  let out: { status: number; body: unknown };
  try {
    out = await handler();
  } catch (e) {
    await ctx.db.tx(async (t) => t.delete('idempotency', id));
    throw e;
  }
  await ctx.db.tx(async (t) => t.set('idempotency', id, { reqHash, status: 'done', httpStatus: out.status, body: out.body, expireAt }));
  res.status(out.status).json(out.body);
}
