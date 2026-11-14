import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { Router, type Request, type Response } from 'express';
import * as OTPAuth from 'otpauth';
import { ChangePasswordBody, LoginBody, ROLE_LABELS, ROLES, TeamBody, UserCreateBody, UserUpdateBody } from '@ss/contracts';
import { istDate } from '@ss/domain';
import type { Ctx } from '../context.js';
import { AppError, fail } from '../http/errors.js';
import { authn, clearUserCache, clientIp, info, P, paging, rateLimit, requirePerm } from '../http/pipeline.js';
import { audit, created, getSettings, newId, notify, nowIso, sha256, stamp, token, usersWithRole } from '../shared/core.js';

const ACCESS_TTL = 15 * 60;
const IDLE_DAYS = 30;
const ABSOLUTE_DAYS = 90;
const GRACE_MS = 30_000;
const COMMON = new Set(['password123', '1234567890', 'qwertyuiop', 'password@1', 'iloveyou12', 'welcome@123', 'admin@1234', 'abcdefghij', '1q2w3e4r5t', 'password1234']);
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export const hashPassword = (pw: string) => argonHash(pw, ARGON);

/** RULE-006 */
export function checkPasswordPolicy(username: string, pw: string) {
  const lower = pw.toLowerCase();
  if (pw.length < 10 || lower.includes(username.toLowerCase()) || COMMON.has(lower)) fail('PASSWORD_POLICY');
}

const COOKIE = '__Secure-rt';
function setRefreshCookie(ctx: Ctx, res: Response, value: string) {
  res.cookie(ctx.cfg.cookieSecure ? COOKIE : 'rt', value, { httpOnly: true, secure: ctx.cfg.cookieSecure, sameSite: 'strict', path: '/api/v1/auth', maxAge: IDLE_DAYS * 86_400_000 });
}
const readRefresh = (ctx: Ctx, req: Request): string | undefined => req.cookies?.[ctx.cfg.cookieSecure ? COOKIE : 'rt'];

async function issueTokens(ctx: Ctx, req: Request, res: Response, user: Record<string, unknown> & { id: string }, sessionId?: string) {
  const now = ctx.clock.now();
  const secret = token(32);
  const sid = sessionId ?? newId('s_');
  if (!sessionId) {
    await ctx.db.tx(async (t) => {
      t.create('sessions', sid, {
        userId: user.id, currentHash: sha256(secret), prevHash: null, prevValidUntil: null, createdAt: now.toISOString(), lastUsedAt: now.toISOString(),
        idleExpiresAt: new Date(now.getTime() + IDLE_DAYS * 86_400_000).toISOString(), absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_DAYS * 86_400_000).toISOString(),
        revokedAt: null, userAgent: (req.header('user-agent') ?? '').slice(0, 200), ipMasked: clientIp(req).replace(/\.\d+$/, '.x'),
        expireAt: new Date(now.getTime() + (ABSOLUTE_DAYS + 30) * 86_400_000).toISOString(),
      });
    });
  }
  setRefreshCookie(ctx, res, `${sid}.${secret}`);
  const accessToken = await ctx.keys.sign({ sub: user.id, sid, epoch: Number(user.tokenEpoch ?? 0), role: user.role, typ: 'access' }, ACCESS_TTL);
  return { accessToken, expiresIn: ACCESS_TTL, sid, secret };
}

export function publicUser(u: Record<string, unknown> & { id: string }) {
  return {
    id: u.id, username: u.username, fullName: u.fullName, role: u.role, roleLabel: ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role,
    phone: u.phone ?? null, email: u.email ?? null, teamIds: u.teamIds ?? [], status: u.status, mustChangePassword: !!u.mustChangePassword,
    mfaEnabled: !!u.totpEnabled, lastLoginAt: u.lastLoginAt ?? null, isSupport: !!u.isSupport, version: u.version ?? 1,
  };
}

async function revokeAllSessions(ctx: Ctx, userId: string) {
  const sessions = await ctx.db.all('sessions', { where: [['userId', '==', userId], ['revokedAt', '==', null]] });
  await ctx.db.tx(async (t) => {
    for (const s of sessions) t.update('sessions', s.id, { revokedAt: nowIso(ctx) });
    const u = await t.get('users', userId);
    if (u) t.update('users', userId, { tokenEpoch: Number(u.tokenEpoch ?? 0) + 1 });
  });
  clearUserCache(userId);
}

export function identityRoutes(ctx: Ctx): Router {
  const r = Router();
  const loginLimit = rateLimit('login', 20);

  // API-010 Sign in (FR-007, FR-008, RULE-007)
  r.post('/auth/login', loginLimit, async (req, res) => {
    const body = LoginBody.parse(req.body);
    const uname = await ctx.db.get('usernames', body.username);
    const user = uname ? await ctx.db.get('users', uname.userId as string) : null;
    const now = ctx.clock.now();
    if (!user) {
      await argonHash('timing-equaliser', ARGON);
      fail('INVALID_CREDENTIALS');
    }
    const u = user!;
    if (u.lockedUntil && new Date(u.lockedUntil as string) > now) fail('ACCOUNT_LOCKED', undefined, { lockedUntil: u.lockedUntil });
    const ok = await argonVerify(u.passwordHash as string, body.password).catch(() => false);
    if (!ok) {
      const attempts = Number(u.failedAttempts ?? 0) + 1;
      const lock = attempts >= 5;
      await ctx.db.tx(async (t) => {
        t.update('users', u.id, { failedAttempts: lock ? 0 : attempts, lockedUntil: lock ? new Date(now.getTime() + 15 * 60_000).toISOString() : u.lockedUntil ?? null });
        audit(ctx, t, { principal: null, ip: clientIp(req), requestId: req.id, actorOverride: u.id }, { action: lock ? 'auth.locked' : 'auth.login_failed', recordType: 'user', recordId: u.id });
        if (lock) {
          notify(ctx, t, [u.id], 'N-013', 'Your account was locked after 5 failed attempts', '/me', [`user:${u.id}`]);
          for (const a of await usersWithRole(ctx, 'admin')) if (a !== u.id) notify(ctx, t, [a], 'N-013', `${u.fullName} was locked out after 5 failed attempts`, '/settings/users', [`user:${u.id}`]);
        }
      });
      if (lock) fail('ACCOUNT_LOCKED');
      fail('INVALID_CREDENTIALS');
    }
    if (u.status !== 'active') fail('ACCOUNT_INACTIVE');
    if (u.totpEnabled) {
      const mfaToken = await ctx.keys.sign({ sub: u.id, typ: 'mfa_pending' }, 300);
      res.status(200).json({ mfaRequired: true, mfaToken });
      return;
    }
    await finishLogin(req, res, u);
  });

  async function finishLogin(req: Request, res: Response, u: Record<string, unknown> & { id: string }) {
    await ctx.db.tx(async (t) => {
      t.update('users', u.id, { failedAttempts: 0, lockedUntil: null, lastLoginAt: nowIso(ctx) });
      audit(ctx, t, { principal: null, ip: clientIp(req), requestId: req.id, actorOverride: u.isSupport ? 'support' : u.id }, { action: 'auth.login', recordType: 'user', recordId: u.id });
    });
    const tokens = await issueTokens(ctx, req, res, u);
    res.json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, user: publicUser({ ...u, lastLoginAt: nowIso(ctx) }) });
  }

  // API-011 Verify 2FA (FR-012)
  r.post('/auth/2fa/verify', loginLimit, async (req, res) => {
    const { mfaToken, code } = req.body as { mfaToken?: string; code?: string };
    let claims: Record<string, unknown>;
    try {
      claims = await ctx.keys.verify(String(mfaToken));
    } catch {
      throw new AppError('UNAUTHENTICATED');
    }
    if (claims.typ !== 'mfa_pending') fail('UNAUTHENTICATED');
    const u = await ctx.db.get('users', String(claims.sub));
    if (!u || !u.totpSecret) fail('UNAUTHENTICATED');
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(String(u!.totpSecret)) });
    if (totp.validate({ token: String(code ?? ''), window: 1 }) === null) fail('MFA_INVALID');
    await finishLogin(req, res, u!);
  });

  // API-012 Refresh with rotation, reuse detection and grace window
  r.post('/auth/refresh', rateLimit('refresh', 60), async (req, res) => {
    const raw = readRefresh(ctx, req);
    if (!raw || !raw.includes('.')) fail('REFRESH_INVALID');
    const [sid, secret] = raw!.split('.') as [string, string];
    const now = ctx.clock.now();
    const result = await ctx.db.tx(async (t) => {
      const s = await t.get('sessions', sid);
      if (!s || s.revokedAt) return { error: true as const };
      if (new Date(s.idleExpiresAt as string) < now || new Date(s.absoluteExpiresAt as string) < now) return { error: true as const };
      const h = sha256(secret);
      if (h === s.currentHash) {
        const next = token(32);
        t.update('sessions', sid, { prevHash: h, prevValidUntil: new Date(now.getTime() + GRACE_MS).toISOString(), currentHash: sha256(next), lastUsedAt: now.toISOString(), idleExpiresAt: new Date(now.getTime() + IDLE_DAYS * 86_400_000).toISOString() });
        return { userId: s.userId as string, next };
      }
      if (h === s.prevHash && s.prevValidUntil && new Date(s.prevValidUntil as string) > now) {
        return { userId: s.userId as string, next: null }; // concurrent tab within grace: same session, no new rotation
      }
      t.update('sessions', sid, { revokedAt: now.toISOString(), revokedReason: 'reuse_detected' });
      audit(ctx, t, { principal: null, ip: clientIp(req), requestId: req.id, actorOverride: String(s.userId) }, { action: 'auth.refresh_reuse', recordType: 'session', recordId: sid });
      return { error: true as const };
    });
    if ('error' in result) fail('REFRESH_INVALID');
    const ok = result as { userId: string; next: string | null };
    const u = await ctx.db.get('users', ok.userId);
    if (!u || u.status !== 'active') fail('REFRESH_INVALID');
    if (ok.next) setRefreshCookie(ctx, res, `${sid}.${ok.next}`);
    const accessToken = await ctx.keys.sign({ sub: u!.id, sid, epoch: Number(u!.tokenEpoch ?? 0), role: u!.role, typ: 'access' }, ACCESS_TTL);
    res.json({ accessToken, expiresIn: ACCESS_TTL, user: publicUser(u!) });
  });

  // API-013 Sign out
  r.post('/auth/logout', async (req, res) => {
    const raw = readRefresh(ctx, req);
    if (raw?.includes('.')) {
      const sid = raw.split('.')[0]!;
      await ctx.db.tx(async (t) => {
        const s = await t.get('sessions', sid);
        if (s && !s.revokedAt) t.update('sessions', sid, { revokedAt: nowIso(ctx) });
      });
    }
    res.clearCookie(ctx.cfg.cookieSecure ? COOKIE : 'rt', { path: '/api/v1/auth' });
    res.status(204).end();
  });

  // ---- authenticated below ----
  r.use(['/auth/password', '/me', '/admin/users', '/admin/sessions', '/admin/roles', '/admin/teams', '/admin/support-access'], authn);

  // API-014 Change password (FR-009)
  r.post('/auth/password', async (req, res) => {
    const p = P(req);
    const body = ChangePasswordBody.parse(req.body);
    const u = (await ctx.db.get('users', p.userId))!;
    if (!(await argonVerify(u.passwordHash as string, body.currentPassword).catch(() => false))) fail('INVALID_CREDENTIALS');
    checkPasswordPolicy(String(u.username), body.newPassword);
    const passwordHash = await hashPassword(body.newPassword);
    await ctx.db.tx(async (t) => {
      t.update('users', p.userId, { passwordHash, mustChangePassword: false, tokenEpoch: Number(u.tokenEpoch ?? 0) + 1 });
      audit(ctx, t, info(req), { action: 'user.password_change', recordType: 'user', recordId: p.userId });
    });
    clearUserCache(p.userId);
    const sessions = await ctx.db.all('sessions', { where: [['userId', '==', p.userId], ['revokedAt', '==', null]] });
    await ctx.db.tx(async (t) => {
      for (const s of sessions) t.update('sessions', s.id, { revokedAt: nowIso(ctx) });
    });
    const fresh = (await ctx.db.get('users', p.userId))!;
    const tokens = await issueTokens(ctx, req, res, fresh);
    res.json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, user: publicUser(fresh) });
  });

  // API-015 Current user
  r.get('/me', async (req, res) => {
    const u = await ctx.db.get('users', P(req).userId);
    const s = await getSettings(ctx);
    res.json({ user: publicUser(u!), mode: s.mode.mode, permissions: { execPayments: s.permissions.execPaymentsEnabled } });
  });

  // API-016 Login history
  r.get('/me/login-history', async (req, res) => {
    const items = await ctx.db.query('auditLog', { where: [['recordId', '==', P(req).userId], ['recordType', '==', 'user']], orderBy: [['at', 'desc']], limit: 20 });
    res.json({ items: items.items.filter((a) => String(a.action).startsWith('auth.')).map((a) => ({ at: a.at, action: a.action, ipMasked: a.ipMasked })) });
  });

  // API-017/018/019 2FA (FR-012)
  r.post('/me/2fa/setup', async (req, res) => {
    const p = P(req);
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({ issuer: 'SaleSphere', label: p.name, secret });
    await ctx.db.tx(async (t) => t.update('users', p.userId, { totpPending: secret.base32 }));
    res.json({ otpauthUrl: totp.toString(), secret: secret.base32 });
  });
  r.post('/me/2fa/enable', async (req, res) => {
    const p = P(req);
    const u = (await ctx.db.get('users', p.userId))!;
    if (!u.totpPending) fail('VALIDATION_FAILED');
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(String(u.totpPending)) });
    if (totp.validate({ token: String(req.body?.code ?? ''), window: 1 }) === null) fail('MFA_INVALID');
    await ctx.db.tx(async (t) => {
      t.update('users', p.userId, { totpSecret: u.totpPending, totpPending: null, totpEnabled: true });
      audit(ctx, t, info(req), { action: 'user.2fa_enable', recordType: 'user', recordId: p.userId });
    });
    res.json({ enabled: true });
  });
  r.delete('/me/2fa', async (req, res) => {
    const p = P(req);
    await ctx.db.tx(async (t) => {
      t.update('users', p.userId, { totpSecret: null, totpEnabled: false });
      audit(ctx, t, info(req), { action: 'user.2fa_disable', recordType: 'user', recordId: p.userId });
    });
    res.status(204).end();
  });

  // API-020 – 027 Users (FR-011)
  r.get('/admin/users', requirePerm('users:read'), async (req, res) => {
    const users = await ctx.db.all('users', { orderBy: [['fullName', 'asc']] });
    const p = P(req);
    const visible = p.role === 'sales_manager' ? users.filter((u) => p.teamUserIds.includes(u.id)) : users;
    res.json({ items: visible.filter((u) => !u.isSupport || p.role === 'admin').map(publicUser) });
  });

  r.post('/admin/users', requirePerm('users:write'), async (req, res) => {
    const body = UserCreateBody.parse(req.body);
    const settings = await getSettings(ctx);
    const tempPassword = `${token(6)}-${token(4)}`;
    const passwordHash = await hashPassword(tempPassword);
    const id = newId('u_');
    await ctx.db.tx(async (t) => {
      if (settings.mode.mode === 'solo') {
        const active = (await t.query('users', { where: [['status', '==', 'active']], limit: 100 })).items.filter((u) => !u.isSupport);
        if (active.length >= 1) fail('SOLO_ONE_USER');
      }
      if (await t.get('usernames', body.username)) fail('USERNAME_TAKEN');
      t.create('usernames', body.username, { userId: id });
      const doc = { ...body, teamIds: body.teamIds ?? [], passwordHash, status: 'active', mustChangePassword: true, failedAttempts: 0, tokenEpoch: 0, isSupport: false, ...created(ctx, P(req)) };
      t.create('users', id, doc);
      audit(ctx, t, info(req), { action: 'user.create', recordType: 'user', recordId: id, after: { username: body.username, fullName: body.fullName, role: body.role } });
    });
    const u = (await ctx.db.get('users', id))!;
    res.status(201).json({ user: publicUser(u), temporaryPassword: tempPassword });
  });

  r.patch('/admin/users/:id', requirePerm('users:write'), async (req, res) => {
    const body = UserUpdateBody.parse(req.body);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const u = await t.get('users', id);
      if (!u) fail('NOT_FOUND');
      if (body.role && body.role !== 'admin' && u!.role === 'admin') await assertNotLastAdmin(t, id);
      t.update('users', id, { ...body, ...stamp(ctx, P(req), Number(u!.version ?? 0)), ...(body.role && body.role !== u!.role ? { tokenEpoch: Number(u!.tokenEpoch ?? 0) + 1 } : {}) });
      audit(ctx, t, info(req), { action: 'user.update', recordType: 'user', recordId: id, before: { role: u!.role, fullName: u!.fullName }, after: { role: body.role ?? u!.role, fullName: body.fullName ?? u!.fullName } });
    });
    clearUserCache(id);
    res.json({ user: publicUser((await ctx.db.get('users', id))!) });
  });

  async function assertNotLastAdmin(t: Parameters<Parameters<Ctx['db']['tx']>[0]>[0], exceptId: string) {
    const admins = (await t.query('users', { where: [['role', '==', 'admin'], ['status', '==', 'active']], limit: 50 })).items.filter((a) => a.id !== exceptId && !a.isSupport);
    if (!admins.length) fail('LAST_ADMIN');
  }

  r.post('/admin/users/:id/reset-password', requirePerm('users:write'), async (req, res) => {
    const id = String(req.params.id);
    const tempPassword = `${token(6)}-${token(4)}`;
    const passwordHash = await hashPassword(tempPassword);
    await ctx.db.tx(async (t) => {
      if (!(await t.get('users', id))) fail('NOT_FOUND');
      t.update('users', id, { passwordHash, mustChangePassword: true });
      audit(ctx, t, info(req), { action: 'user.password_reset', recordType: 'user', recordId: id });
    });
    await revokeAllSessions(ctx, id);
    res.json({ temporaryPassword: tempPassword });
  });

  r.post('/admin/users/:id/deactivate', requirePerm('users:write'), async (req, res) => {
    const id = String(req.params.id);
    const reassignTo = (req.body?.reassignTo as string | undefined) ?? null;
    await ctx.db.tx(async (t) => {
      const u = await t.get('users', id);
      if (!u) fail('NOT_FOUND');
      if (u!.role === 'admin') await assertNotLastAdmin(t, id);
      const open = (await t.query('leads', { where: [['ownerId', '==', id]], limit: 500 })).items.filter((l) => !['won', 'lost', 'junk', 'merged'].includes(String(l.stage)));
      if (open.length && !reassignTo) fail('VALIDATION_FAILED', `Reassign ${open.length} open leads first`, { openLeads: open.length });
      for (const l of open) t.update('leads', l.id, { ownerId: reassignTo, version: Number(l.version ?? 0) + 1 });
      t.update('users', id, { status: 'inactive', tokenEpoch: Number(u!.tokenEpoch ?? 0) + 1 });
      audit(ctx, t, info(req), { action: 'user.deactivate', recordType: 'user', recordId: id, meta: { reassigned: open.length, reassignTo } });
    });
    await revokeAllSessions(ctx, id);
    res.json({ ok: true });
  });

  r.post('/admin/users/:id/reactivate', requirePerm('users:write'), async (req, res) => {
    const id = String(req.params.id);
    const settings = await getSettings(ctx);
    await ctx.db.tx(async (t) => {
      if (settings.mode.mode === 'solo') {
        const active = (await t.query('users', { where: [['status', '==', 'active']], limit: 10 })).items.filter((u) => !u.isSupport);
        if (active.length >= 1) fail('SOLO_ONE_USER');
      }
      t.update('users', id, { status: 'active' });
      audit(ctx, t, info(req), { action: 'user.reactivate', recordType: 'user', recordId: id });
    });
    clearUserCache(id);
    res.json({ ok: true });
  });

  r.post('/admin/users/:id/unlock', requirePerm('users:write'), async (req, res) => {
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      t.update('users', id, { lockedUntil: null, failedAttempts: 0 });
      audit(ctx, t, info(req), { action: 'user.unlock', recordType: 'user', recordId: id });
    });
    res.json({ ok: true });
  });

  r.delete('/admin/users/:id/2fa', requirePerm('users:write'), async (req, res) => {
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      t.update('users', id, { totpSecret: null, totpEnabled: false });
      audit(ctx, t, info(req), { action: 'user.2fa_reset', recordType: 'user', recordId: id });
    });
    res.status(204).end();
  });

  // API-028/029 Sessions (FR-010)
  r.get('/admin/sessions', requirePerm('users:write'), async (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const where: [string, '==', unknown][] = [['revokedAt', '==', null]];
    if (userId) where.push(['userId', '==', userId]);
    const items = await ctx.db.query('sessions', { where, orderBy: [['lastUsedAt', 'desc']], ...paging(req) });
    res.json({ items: items.items.map((s) => ({ id: s.id, userId: s.userId, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, userAgent: s.userAgent, ipMasked: s.ipMasked })), nextCursor: items.nextCursor });
  });
  r.post('/admin/users/:id/force-logout', requirePerm('users:write'), async (req, res) => {
    const id = String(req.params.id);
    await revokeAllSessions(ctx, id);
    await ctx.db.tx(async (t) => audit(ctx, t, info(req), { action: 'user.force_logout', recordType: 'user', recordId: id }));
    res.json({ ok: true });
  });

  // API-030/031 Roles (fixed catalogue in MVP; limits editable via settings)
  r.get('/admin/roles', requirePerm('users:read'), async (_req, res) => {
    const s = await getSettings(ctx);
    res.json({ items: ROLES.filter((x) => x !== 'support').map((id) => ({ id, name: ROLE_LABELS[id], discountLimitPct: s.sales.discountLimits[id] ?? (id === 'admin' ? 100 : 0), canRecordPayments: id === 'sales_exec' ? s.permissions.execPaymentsEnabled : undefined })) });
  });

  // API-032 – 034 Teams (Team mode)
  r.get('/admin/teams', requirePerm('users:read'), async (_req, res) => {
    res.json({ items: await ctx.db.all('teams', { orderBy: [['name', 'asc']] }) });
  });
  r.post('/admin/teams', requirePerm('users:write'), async (req, res) => {
    const body = TeamBody.parse(req.body);
    const id = newId('t_');
    await ctx.db.tx(async (t) => {
      t.create('teams', id, { ...body, ...created(ctx, P(req)) });
      audit(ctx, t, info(req), { action: 'team.create', recordType: 'team', recordId: id, after: body });
    });
    clearUserCache();
    res.status(201).json(await ctx.db.get('teams', id));
  });
  r.patch('/admin/teams/:id', requirePerm('users:write'), async (req, res) => {
    const body = TeamBody.partial().parse(req.body);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const team = await t.get('teams', id);
      if (!team) fail('NOT_FOUND');
      t.update('teams', id, { ...body, ...stamp(ctx, P(req), Number(team!.version ?? 0)) });
      audit(ctx, t, info(req), { action: 'team.update', recordType: 'team', recordId: id, before: team, after: { ...team, ...body } });
    });
    clearUserCache();
    res.json(await ctx.db.get('teams', id));
  });

  // API-035 Support access (FR-089, RULE-056)
  r.put('/admin/support-access', requirePerm('users:write'), async (req, res) => {
    const p = P(req);
    if (p.role !== 'admin') fail('FORBIDDEN');
    const enabled = !!req.body?.enabled;
    const days = Number(req.body?.days ?? 0);
    if (enabled && !(days >= 1 && days <= 7)) fail('SUPPORT_DAYS_RANGE');
    const now = ctx.clock.now();
    const expiresAt = enabled ? new Date(now.getTime() + days * 86_400_000).toISOString() : null;
    const oneTimePassword = enabled ? `${token(8)}-${token(6)}` : null;
    const passwordHash = oneTimePassword ? await hashPassword(oneTimePassword) : null;
    await ctx.db.tx(async (t) => {
      const existing = await t.get('usernames', 'support');
      const id = (existing?.userId as string) ?? 'u_support';
      if (!existing) t.create('usernames', 'support', { userId: id });
      const u = await t.get('users', id);
      t.set('users', id, {
        ...(u ?? {}), username: 'support', fullName: 'Support', role: 'support', isSupport: true, status: enabled ? 'active' : 'inactive',
        supportExpiresAt: expiresAt, ...(passwordHash ? { passwordHash, mustChangePassword: false } : {}), tokenEpoch: Number(u?.tokenEpoch ?? 0) + 1,
        failedAttempts: 0, teamIds: [], ...(u ? {} : created(ctx, p)),
      });
      audit(ctx, t, info(req), { action: enabled ? 'support.enable' : 'support.disable', recordType: 'user', recordId: id, meta: { days, expiresAt } });
      notify(ctx, t, await usersWithRole(ctx, 'admin'), 'N-012', enabled ? `Support access active until ${istDate(new Date(expiresAt!))}` : 'Support access disabled', '/settings/users', []);
    });
    clearUserCache('u_support');
    res.json({ enabled, expiresAt, username: 'support', oneTimePassword });
  });

  return r;
}

/** Job: disable support user after expiry (FR-089 AC1). */
export async function expireSupportAccess(ctx: Ctx) {
  const now = ctx.clock.now();
  const users = await ctx.db.all('users', { where: [['isSupport', '==', true], ['status', '==', 'active']] });
  for (const u of users) {
    if (u.supportExpiresAt && new Date(u.supportExpiresAt as string) <= now) {
      await ctx.db.tx(async (t) => {
        t.update('users', u.id, { status: 'inactive', tokenEpoch: Number(u.tokenEpoch ?? 0) + 1 });
        audit(ctx, t, { principal: null }, { action: 'support.expire', recordType: 'user', recordId: u.id });
        notify(ctx, t, await usersWithRole(ctx, 'admin'), 'N-012', 'Support access expired', '/settings/users', []);
      });
      const sessions = await ctx.db.all('sessions', { where: [['userId', '==', u.id], ['revokedAt', '==', null]] });
      await ctx.db.tx(async (t) => {
        for (const s of sessions) t.update('sessions', s.id, { revokedAt: now.toISOString() });
      });
      clearUserCache(u.id);
    }
  }
}

/** Bootstrap the first admin (provisioning, FR-002). */
export async function ensureAdmin(ctx: Ctx, username: string, fullName: string, password: string) {
  if (await ctx.db.get('usernames', username)) return null;
  const id = newId('u_');
  const passwordHash = await hashPassword(password);
  await ctx.db.tx(async (t) => {
    t.create('usernames', username, { userId: id });
    t.create('users', id, { username, fullName, role: 'admin', teamIds: [], passwordHash, status: 'active', mustChangePassword: true, failedAttempts: 0, tokenEpoch: 0, isSupport: false, ...created(ctx, null) });
    t.set('settings', 'mode', { mode: 'solo', soloUserId: id });
    t.set('settings', 'assignment', { strategy: 'round_robin', defaultOwnerId: id });
  });
  return id;
}

