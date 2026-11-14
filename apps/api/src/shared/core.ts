import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { counterKey, diff, fyOf, formatDocNumber, maskValue, type Change, type IsoDate } from '@ss/domain';
import { scopeOf, type Action, type Resource } from '@ss/contracts';
import type { Ctx, Principal } from '../context.js';
import type { Doc, Tx, Where } from '../db/types.js';
import { AppError, fail } from '../http/errors.js';

export const newId = (prefix = '') => `${prefix}${randomUUID().replace(/-/g, '').slice(0, 20)}`;
export const token = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const nowIso = (ctx: Ctx) => ctx.clock.now().toISOString();

// ---------------- settings (TBL-001) ----------------
export interface Settings {
  mode: { mode: 'solo' | 'team'; soloUserId?: string | null };
  modules: { orders: boolean; sheetSync: boolean; webForm: boolean };
  sla: { minutes: number; calendar: { days: number[]; start: string; end: string } };
  sales: { validDays: number; roundOff: boolean; discountLimits: Record<string, number>; supplyKind: 'services' | 'goods'; defaultTermsText: string };
  permissions: { execPaymentsEnabled: boolean };
  finance: { lockDate: IsoDate | null };
  assignment: { strategy: 'round_robin' | 'fewest_open'; defaultOwnerId: string | null };
  branding: { appName: string; primary: string; primaryDark: string; poweredBy: boolean; logoLight?: string | null };
  terminology: Record<string, string>;
  outcomes: { streak: { count: number; tag: string; followUpDays: number } | null };
}
export const DEFAULT_SETTINGS: Settings = {
  mode: { mode: 'solo', soloUserId: null },
  modules: { orders: false, sheetSync: true, webForm: true },
  sla: { minutes: 15, calendar: { days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '19:00' } },
  sales: { validDays: 15, roundOff: true, discountLimits: { sales_exec: 10, sales_manager: 20 }, supplyKind: 'services', defaultTermsText: '' },
  permissions: { execPaymentsEnabled: true },
  finance: { lockDate: null },
  assignment: { strategy: 'round_robin', defaultOwnerId: null },
  branding: { appName: 'SaleSphere', primary: '#2563EB', primaryDark: '#60A5FA', poweredBy: true },
  terminology: {},
  outcomes: { streak: { count: 3, tag: 'unreachable', followUpDays: 2 } },
};
export type SettingsSection = keyof Settings;

export async function getSettings(ctx: Ctx | { db: Ctx['db'] }, t?: Tx): Promise<Settings> {
  const reader = t ?? ctx.db;
  const out = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
  const docs = await reader.query('settings', { limit: 100 });
  for (const d of docs.items) {
    const { id, version: _v, updatedAt: _u, updatedBy: _b, ...rest } = d;
    out[id] = { ...(out[id] as object | undefined), ...rest };
  }
  return out as unknown as Settings;
}

export interface Company {
  legalName: string;
  tradeName?: string | null;
  gstRegistered: boolean;
  gstin?: string | null;
  stateCode: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  jurisdiction?: string | null;
  signatory?: string | null;
  logoDataUrl?: string | null;
}
/** FR-004 AC4: a switched-off module's API answers MODULE_DISABLED. */
export const requireModule = (ctx: Ctx, mod: keyof Settings['modules']) => async (_req: unknown, _res: unknown, next: (e?: unknown) => void) => {
  try {
    const s = await getSettings(ctx);
    next(s.modules[mod] ? undefined : new AppError('MODULE_DISABLED'));
  } catch (e) {
    next(e);
  }
};

export async function getCompany(ctx: { db: Ctx['db'] }, t?: Tx): Promise<Company> {
  const d = await (t ?? ctx.db).get('settings_company', 'company');
  return (d as unknown as Company) ?? { legalName: 'My Company', gstRegistered: false, stateCode: '29', address: '' };
}

// ---------------- numbering (TBL-002/003, RULE-003) ----------------
export const DOC_TYPES = ['quote', 'order', 'tax_invoice', 'bill_of_supply', 'proforma', 'credit_note', 'receipt'] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const DEFAULT_SERIES: Record<DocType, { prefix: string; pad: number; fyReset: boolean }> = {
  quote: { prefix: 'QT', pad: 4, fyReset: true },
  order: { prefix: 'SO', pad: 4, fyReset: true },
  tax_invoice: { prefix: 'INV', pad: 4, fyReset: true },
  bill_of_supply: { prefix: 'BOS', pad: 4, fyReset: true },
  proforma: { prefix: 'PI', pad: 4, fyReset: true },
  credit_note: { prefix: 'CN', pad: 4, fyReset: true },
  receipt: { prefix: 'RCPT', pad: 4, fyReset: true },
};

/** Allocates the next number inside the caller's transaction (atomic counter; never reused). */
export async function nextDocNumber(t: Tx, docType: DocType, date: IsoDate): Promise<string> {
  const series = ((await t.get('numberSeries', docType)) as unknown as typeof DEFAULT_SERIES.quote | null) ?? DEFAULT_SERIES[docType];
  const fy = fyOf(date);
  const key = counterKey(docType, series, fy);
  const c = await t.get('counters', key);
  const seq = ((c?.value as number) ?? 0) + 1;
  t.set('counters', key, { value: seq });
  return formatDocNumber(series, fy, seq);
}

/** Simple running code for records ("L-000123", "C-0042"). */
export async function nextCode(t: Tx, name: string, prefix: string, pad: number): Promise<string> {
  const c = await t.get('counters', name);
  const seq = ((c?.value as number) ?? 0) + 1;
  t.set('counters', name, { value: seq });
  return `${prefix}${String(seq).padStart(pad, '0')}`;
}

// ---------------- audit (TBL-020, RULE-012) ----------------
export interface AuditEntry {
  action: string;
  recordType?: string | null;
  recordId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changes?: Change[];
  meta?: Record<string, unknown>;
}
export interface ReqInfo {
  principal: Principal | null;
  ip?: string | null;
  requestId?: string | null;
  actorOverride?: string;
}

/** Writes an audit entry in the same transaction as the business change (no unaudited change). */
export function audit(ctx: Ctx, t: Tx, info: ReqInfo, e: AuditEntry) {
  const id = newId('a_');
  const changes = e.changes ?? (e.before !== undefined || e.after !== undefined ? diff(e.before ?? null, e.after ?? null) : []);
  const userId = info.actorOverride ?? (info.principal ? (info.principal.isSupport ? 'support' : info.principal.userId) : 'system');
  t.create('auditLog', id, {
    at: nowIso(ctx),
    userId,
    userName: info.principal?.name ?? userId,
    action: e.action,
    recordType: e.recordType ?? null,
    recordId: e.recordId ?? null,
    changes,
    meta: e.meta ?? null,
    ipMasked: info.ip ? maskValue('ip', info.ip) : null,
    requestId: info.requestId ?? null,
  });
}

// ---------------- scope (RULE-011) ----------------
export function scopeWhere(p: Principal, res: Resource, action: Action = 'read', field = 'ownerId'): Where[] | null {
  const s = scopeOf(p.role, res, action);
  if (s === 'none') return null;
  if (s === 'all') return [];
  if (s === 'own') return [[field, '==', p.userId]];
  return [[field, 'in', p.teamUserIds.slice(0, 30)]];
}

export function inScope(p: Principal, res: Resource, action: Action, ownerId: string | null | undefined): boolean {
  const s = scopeOf(p.role, res, action);
  if (s === 'all') return true;
  if (s === 'none' || !ownerId) return false;
  if (s === 'own') return ownerId === p.userId;
  return p.teamUserIds.includes(ownerId);
}

export function requireScope(p: Principal, res: Resource, action: Action, doc: Doc | null, field = 'ownerId'): asserts doc is Doc {
  if (!doc) fail('NOT_FOUND');
  if (!inScope(p, res, action, doc[field] as string)) {
    // read → 404 (no existence leak); write on readable record → 403
    if (action !== 'read' && inScope(p, res, 'read', doc[field] as string)) throw new AppError('FORBIDDEN');
    throw new AppError('NOT_FOUND');
  }
}

export function requireCan(p: Principal, res: Resource, action: Action) {
  if (scopeOf(p.role, res, action) === 'none') throw new AppError('FORBIDDEN');
}

/** RULE-058 optimistic concurrency: If-Match carries the version. */
export function checkVersion(doc: Doc, ifMatch: string | undefined) {
  if (ifMatch === undefined) throw new AppError('PRECONDITION_REQUIRED');
  const v = Number(String(ifMatch).replace(/"/g, ''));
  if (v !== Number(doc.version ?? 0)) throw new AppError('VERSION_CONFLICT', `Changed by ${doc.updatedByName ?? 'another user'} — reload`, { changedBy: doc.updatedByName ?? null });
}

export function stamp(ctx: Ctx, p: Principal | null, version?: number) {
  return { updatedAt: nowIso(ctx), updatedBy: p?.userId ?? 'system', updatedByName: p?.name ?? 'System', version: (version ?? 0) + 1 };
}

export function created(ctx: Ctx, p: Principal | null) {
  return { createdAt: nowIso(ctx), createdBy: p?.userId ?? 'system', ...stamp(ctx, p, 0) };
}

// ---------------- notifications (TBL-095) ----------------
export function notify(ctx: Ctx, t: Tx, userIds: string[], event: string, title: string, link: string, refs: string[] = []) {
  for (const u of [...new Set(userIds)].filter(Boolean)) {
    const id = newId('n_');
    t.create('notifications', id, { userId: u, event, title, link, refs, createdAt: nowIso(ctx), readAt: null });
    void ctx.tasks.enqueue('push.send', { notificationId: id });
  }
}

/** Users with a role (e.g. admins for N-010). */
export async function usersWithRole(ctx: Ctx, role: string): Promise<string[]> {
  return (await ctx.db.all('users', { where: [['role', '==', role], ['status', '==', 'active']] })).map((u) => u.id);
}

// ---------------- sealing (AES-256-GCM) for values that must be shown again, e.g. share-link URLs ----------------
import { createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';
let sealKey: Buffer | null = null;
function key(): Buffer {
  if (!sealKey) {
    const env = process.env.DATA_ENC_KEY;
    if (!env && process.env.NODE_ENV === 'production') throw new Error('DATA_ENC_KEY is required in production');
    sealKey = env ? Buffer.from(env, 'base64') : scryptSync('salesphere-dev-only', 'salt', 32);
    if (sealKey.length !== 32) throw new Error('DATA_ENC_KEY must be 32 bytes, base64-encoded');
  }
  return sealKey;
}
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `${iv.toString('base64url')}.${enc.toString('base64url')}.${c.getAuthTag().toString('base64url')}`;
}
export function unseal(sealed: string): string {
  const [iv, enc, tag] = sealed.split('.') as [string, string, string];
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
}
