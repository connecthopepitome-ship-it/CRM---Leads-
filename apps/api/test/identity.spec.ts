import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { clearUserCache } from '../src/http/pipeline.js';
import { login, PW, setup } from './helpers.js';

const H = { 'X-Requested-With': 'SaleSphere' };

describe('identity (FR-007 – FR-012, FR-089)', () => {
  it('TC-023 FR-007 sign in, forced password change, /me', async () => {
    const env = await setup();
    const me = await env.admin.get('/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ username: 'admin', role: 'admin', mustChangePassword: false });
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
  });

  it('TC-028 / TC-029 FR-008 wrong password then lockout after 5 attempts', async () => {
    const env = await setup();
    for (let i = 0; i < 4; i++) expect((await login(env.app, 'admin', 'nope-nope-nope')).body.code).toBe('INVALID_CREDENTIALS');
    expect((await login(env.app, 'admin', 'nope-nope-nope')).status).toBe(423);
    expect((await login(env.app, 'admin', PW)).body.code).toBe('ACCOUNT_LOCKED');
    env.clock.t = new Date(env.clock.t.getTime() + 16 * 60_000);
    expect((await login(env.app, 'admin', PW)).status).toBe(200);
    const audit = env.db.dump('auditLog').map((a) => a.action);
    expect(audit).toContain('auth.locked');
  });

  it('TC-033 FR-009 password policy rejects weak passwords', async () => {
    const env = await setup();
    const r = await env.admin.post('/auth/password', { currentPassword: PW, newPassword: 'password123' });
    expect(r.body.code).toBe('PASSWORD_POLICY');
  });

  it('TC-036 FR-010 refresh rotates; reusing an old token revokes the session', async () => {
    const env = await setup();
    const r = await login(env.app, 'admin', PW);
    const cookie = r.headers['set-cookie']![0]!.split(';')[0]!;
    const r1 = await request(env.app).post('/api/v1/auth/refresh').set(H).set('Cookie', cookie);
    expect(r1.status).toBe(200);
    const cookie2 = r1.headers['set-cookie']![0]!.split(';')[0]!;
    // within the 30 s grace window the previous token still works (concurrent tabs)
    expect((await request(env.app).post('/api/v1/auth/refresh').set(H).set('Cookie', cookie)).status).toBe(200);
    env.clock.t = new Date(env.clock.t.getTime() + 60_000);
    expect((await request(env.app).post('/api/v1/auth/refresh').set(H).set('Cookie', cookie)).body.code).toBe('REFRESH_INVALID');
    // reuse detection revoked the whole session
    expect((await request(env.app).post('/api/v1/auth/refresh').set(H).set('Cookie', cookie2)).body.code).toBe('REFRESH_INVALID');
  });

  it('TC-039 FR-010 AC3 forced logout takes effect (epoch check ≤ 60 s)', async () => {
    const env = await setup({ mode: 'team' });
    const exec = await env.createUser('priya', 'sales_exec');
    expect((await exec.agent.get('/me')).status).toBe(200);
    expect((await env.admin.post(`/admin/users/${exec.id}/force-logout`)).status).toBe(200);
    clearUserCache();
    expect((await exec.agent.get('/me')).status).toBe(401);
  });

  it('CSRF header is required on state-changing requests', async () => {
    const env = await setup();
    const r = await request(env.app).post('/api/v1/leads').set('Authorization', `Bearer ${env.admin.token}`).send({ name: 'X', phone: '9845012345' });
    expect(r.body.code).toBe('CSRF_FAILED');
  });

  it('TC-040 FR-011 Solo mode allows one active user; Team mode allows more; last admin protected', async () => {
    const env = await setup();
    const solo = await env.admin.post('/admin/users', { username: 'second', fullName: 'Second User', role: 'sales_exec' });
    expect(solo.body.code).toBe('SOLO_ONE_USER');
    await env.admin.put('/admin/mode', { mode: 'team' });
    const u = await env.admin.post('/admin/users', { username: 'second', fullName: 'Second User', role: 'sales_exec' });
    expect(u.status).toBe(201);
    expect(u.body.temporaryPassword).toBeTruthy();
    expect((await env.admin.post('/admin/users', { username: 'SECOND', fullName: 'Dup', role: 'viewer' })).body.code).toBe('USERNAME_TAKEN');
    expect((await env.admin.patch(`/admin/users/${env.admin.userId}`, { role: 'viewer' })).body.code).toBe('LAST_ADMIN');
  });

  it('TC-258 FR-089 support access expires automatically', async () => {
    const env = await setup();
    const r = await env.admin.put('/admin/support-access', { enabled: true, days: 2 });
    expect(r.status).toBe(200);
    expect((await env.admin.put('/admin/support-access', { enabled: true, days: 9 })).body.code).toBe('SUPPORT_DAYS_RANGE');
    const s = await login(env.app, 'support', r.body.oneTimePassword);
    expect(s.status).toBe(200);
    env.clock.t = new Date(env.clock.t.getTime() + 2 * 86_400_000 + 1000);
    const { runJob } = await import('../src/jobs.js');
    await runJob(env.ctx, 'support.expire');
    expect((await login(env.app, 'support', r.body.oneTimePassword)).body.code).toBe('ACCOUNT_INACTIVE');
  });
});
