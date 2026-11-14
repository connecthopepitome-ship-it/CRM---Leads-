import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { hasPermission, type RoleId } from '@ss/contracts';
import type { Ctx, Principal } from '../context.js';
import { AppError } from './errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      principal: Principal | null;
      ctx: Ctx;
      log: Ctx['log'];
    }
  }
}

export const requestContext = (ctx: Ctx): RequestHandler => (req, res, next) => {
  req.id = (req.header('x-request-id') ?? '').slice(0, 64) || randomUUID();
  req.ctx = ctx;
  req.principal = null;
  req.log = ctx.log.child({ requestId: req.id });
  res.setHeader('X-Request-Id', req.id);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  const started = Date.now();
  res.on('finish', () => req.log.info({ method: req.method, route: req.route?.path ?? req.path.replace(/[A-Za-z0-9_-]{16,}/g, ':id'), status: res.statusCode, ms: Date.now() - started, userId: req.principal?.userId }, 'request'));
  next();
};

/** HMAC-signed edge → API headers (HLD v0.2): X-SS-Edge-Ts, X-SS-Edge-Sig = HMAC(secret, ts.method.path). */
export const edgeSignature = (ctx: Ctx): RequestHandler => (req, _res, next) => {
  const secret = ctx.cfg.edgeSecret;
  if (!secret || req.path === '/health') return next();
  const ts = req.header('x-ss-edge-ts') ?? '';
  const sig = req.header('x-ss-edge-sig') ?? '';
  const expected = createHmac('sha256', secret).update(`${ts}.${req.method}.${req.originalUrl.split('?')[0]}`).digest('hex');
  const fresh = Math.abs(Date.now() - Number(ts)) < 60_000;
  const ok = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!fresh || !ok) return next(new AppError('EDGE_SIGNATURE_INVALID'));
  next();
};

export function clientIp(req: Request): string {
  return (req.header('cf-connecting-ip') ?? req.header('x-forwarded-for')?.split(',')[0] ?? req.socket.remoteAddress ?? '').trim();
}

/** Fixed-window limiter (per instance; the edge enforces the global 60/min/IP). */
export function rateLimit(name: string, perMinute: number, keyFn: (req: Request) => string = clientIp): RequestHandler {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req, _res, next) => {
    const now = Date.now();
    const k = `${name}:${keyFn(req)}`;
    const h = hits.get(k);
    if (!h || h.reset < now) hits.set(k, { n: 1, reset: now + 60_000 });
    else if (++h.n > perMinute) return next(new AppError('RATE_LIMITED'));
    if (hits.size > 10_000) for (const [key, v] of hits) if (v.reset < now) hits.delete(key);
    next();
  };
}

/** CSRF defence for cookie-carrying and state-changing requests (custom header cannot be sent cross-site without CORS). */
export const csrf: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.header('x-requested-with') !== 'SaleSphere') return next(new AppError('CSRF_FAILED'));
  next();
};

const userCache = new Map<string, { at: number; user: Record<string, unknown> | null; team: string[] }>();
export function clearUserCache(userId?: string) {
  if (userId) userCache.delete(userId);
  else userCache.clear();
}

/** Bearer access token → principal; token-epoch check with ≤ 60 s cache (CR-003). */
export const authn: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  const h = req.header('authorization') ?? '';
  if (!h.startsWith('Bearer ')) return next(new AppError('UNAUTHENTICATED'));
  let claims: Record<string, unknown>;
  try {
    claims = await req.ctx.keys.verify(h.slice(7));
  } catch {
    return next(new AppError('UNAUTHENTICATED'));
  }
  if (claims.typ !== 'access') return next(new AppError('UNAUTHENTICATED'));
  const userId = String(claims.sub);
  let cached = userCache.get(userId);
  if (!cached || Date.now() - cached.at > 60_000) {
    const user = await req.ctx.db.get('users', userId);
    let team: string[] = [userId];
    if (user?.role === 'sales_manager') {
      const teams = await req.ctx.db.all('teams', { where: [['managerId', '==', userId]] });
      team = [...new Set([userId, ...teams.flatMap((t: Record<string, unknown>) => (t.memberIds as string[]) ?? [])])];
    }
    cached = { at: Date.now(), user, team };
    userCache.set(userId, cached);
  }
  const u = cached.user;
  if (!u || u.status !== 'active' || Number(u.tokenEpoch ?? 0) !== Number(claims.epoch)) return next(new AppError('UNAUTHENTICATED'));
  req.principal = {
    userId,
    role: u.role as RoleId,
    name: String(u.fullName),
    teamUserIds: cached.team,
    isSupport: !!u.isSupport,
    sessionId: (claims.sid as string) ?? null,
  };
  const path = (req.originalUrl.split('?')[0] ?? '').replace(/^\/api\/v1/, '');
  if (u.mustChangePassword && !['/auth/password', '/me', '/auth/logout'].includes(path)) return next(new AppError('PASSWORD_CHANGE_REQUIRED'));
  next();
};

export const requirePerm = (perm: string): RequestHandler => (req, _res, next) => {
  if (!req.principal || !hasPermission(req.principal.role, perm)) return next(new AppError('FORBIDDEN'));
  next();
};

export const P = (req: Request): Principal => {
  if (!req.principal) throw new AppError('UNAUTHENTICATED');
  return req.principal;
};

export const info = (req: Request) => ({ principal: req.principal, ip: clientIp(req), requestId: req.id });

/** Returns the cursor/limit query params. */
export function paging(req: Request, max = 100) {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 25) || 25, 1), max);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  return { limit, cursor };
}

export const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length ? v : undefined);
