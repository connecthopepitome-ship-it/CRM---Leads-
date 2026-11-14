import request from 'supertest';
import type { Express } from 'express';
import { createApp, InlineTasks } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { MemoryDb } from '../src/db/memory.js';
import { seedInstall } from '../src/seed.js';
import { FakeGoogle } from '../src/shared/google.js';
import type { Ctx } from '../src/context.js';

export const PW = 'Str0ng-Passw0rd!';

export interface TestEnv {
  app: Express;
  ctx: Ctx;
  db: MemoryDb;
  google: FakeGoogle;
  tasks: InlineTasks;
  clock: { t: Date; now(): Date };
  admin: Agent;
  as(username: string): Promise<Agent>;
  createUser(username: string, role: string, extra?: Record<string, unknown>): Promise<{ id: string; agent: Agent }>;
}

export interface Agent {
  token: string;
  userId: string;
  get(url: string): request.Test;
  post(url: string, body?: unknown): request.Test;
  put(url: string, body?: unknown): request.Test;
  patch(url: string, body?: unknown): request.Test;
  del(url: string): request.Test;
}

const H = { 'X-Requested-With': 'SaleSphere' };

export function agentFor(app: Express, token: string, userId: string): Agent {
  const auth = { ...H, Authorization: `Bearer ${token}` };
  return {
    token, userId,
    get: (u) => request(app).get(`/api/v1${u}`).set(auth),
    post: (u, b) => request(app).post(`/api/v1${u}`).set(auth).send(b as object),
    put: (u, b) => request(app).put(`/api/v1${u}`).set(auth).send(b as object),
    patch: (u, b) => request(app).patch(`/api/v1${u}`).set(auth).send(b as object),
    del: (u) => request(app).delete(`/api/v1${u}`).set(auth),
  };
}

export async function login(app: Express, username: string, password: string) {
  const r = await request(app).post('/api/v1/auth/login').set(H).send({ username, password });
  return r;
}

/** Signs in, completes the forced password change, returns an agent. */
export async function signIn(app: Express, username: string, password: string, newPassword = PW): Promise<Agent> {
  const r = await login(app, username, password);
  if (r.status !== 200) throw new Error(`login ${username} ${r.status} ${JSON.stringify(r.body)}`);
  let token = r.body.accessToken as string;
  const userId = r.body.user.id as string;
  if (r.body.user.mustChangePassword) {
    const c = await request(app).post('/api/v1/auth/password').set({ ...H, Authorization: `Bearer ${token}` }).send({ currentPassword: password, newPassword });
    if (c.status !== 200) throw new Error(`pw change ${c.status} ${JSON.stringify(c.body)}`);
    token = c.body.accessToken;
  }
  return agentFor(app, token, userId);
}

export async function setup(opts: { mode?: 'solo' | 'team'; gst?: boolean } = {}): Promise<TestEnv> {
  const db = new MemoryDb();
  const google = new FakeGoogle();
  const tasks = new InlineTasks();
  const clock = { t: new Date('2026-11-13T04:30:00Z'), now() { return new Date(this.t); } };
  const cfg = { ...loadConfig({ NODE_ENV: 'test' }), appOrigin: 'https://crm.example.com' };
  const { app, ctx } = await createApp({ db, cfg, google, tasks, clock });
  await seedInstall(ctx, {
    adminUsername: 'admin', adminName: 'Asha Admin', adminPassword: 'Temp-Passw0rd-1', webCatalogue: true,
    company: opts.gst === false
      ? { legalName: 'Ravi Web Studio', gstRegistered: false, stateCode: '29', address: 'Bengaluru', version: 1 }
      : { legalName: 'Acme Interiors', tradeName: 'Acme Interiors', gstRegistered: true, gstin: '29ABCDE1234F1Z5', stateCode: '29', address: '12 MG Road, Bengaluru', jurisdiction: 'Bengaluru', version: 1 },
  });
  await db.tx(async (t) => {
    t.set('masters', 'm_upiIds_main', { type: 'upiIds', key: 'main', name: 'Main UPI', data: { vpa: 'acme@okhdfcbank', payeeName: 'Acme Interiors', trEnabled: true }, status: 'active', isDefault: true, inUse: false, sortOrder: 1 });
  });
  const admin = await signIn(app, 'admin', 'Temp-Passw0rd-1');
  const passwords = new Map<string, string>();
  const env: TestEnv = {
    app, ctx, db, google, tasks, clock, admin,
    async as(username) {
      return signIn(app, username, passwords.get(username) ?? PW, PW).catch(async () => {
        const r = await login(app, username, PW);
        return agentFor(app, r.body.accessToken, r.body.user.id);
      });
    },
    async createUser(username, role, extra = {}) {
      const r = await admin.post('/admin/users', { username, fullName: `${username} User`, role, ...extra });
      if (r.status !== 201) throw new Error(`create user ${r.status} ${JSON.stringify(r.body)}`);
      passwords.set(username, r.body.temporaryPassword);
      const agent = await signIn(app, username, r.body.temporaryPassword);
      passwords.set(username, PW);
      return { id: r.body.user.id, agent };
    },
  };
  if (opts.mode === 'team') {
    const r = await admin.put('/admin/mode', { mode: 'team' });
    if (r.status !== 200) throw new Error(`mode ${r.status} ${JSON.stringify(r.body)}`);
  }
  return env;
}

export const uid = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);

export async function makeCustomer(a: Agent, extra: Record<string, unknown> = {}) {
  const r = await a.post('/customers', { displayName: 'Ravi Designs', type: 'business', billing: { line1: '1 Brigade Rd', city: 'Bengaluru', stateCode: '29', pincode: '560001' }, contact: { name: 'Ravi Kumar', phone: '9845012345', email: 'ravi@x.com' }, ...extra });
  if (r.status !== 201) throw new Error(`customer ${r.status} ${JSON.stringify(r.body)}`);
  return r.body as { id: string; ownerId: string };
}

export const LINE = { kind: 'item', productId: 'm_products_WEB-BASIC', description: 'Website – Basic', qty: 2, unit: 'Nos', rate: 1_000_000, discountPct: 10, taxRatePct: 18, hsnSac: '998314' };

/** Quote → sent → (optional accept on behalf) → invoice via silent order → issued. */
export async function issuedInvoice(a: Agent, customerId: string, line: Record<string, unknown> = LINE) {
  const q = await a.post('/quotes', { partyType: 'customer', partyId: customerId, lines: [line] });
  if (q.status !== 201) throw new Error(`quote ${q.status} ${JSON.stringify(q.body)}`);
  const s = await a.post(`/quotes/${q.body.id}/send`, { channel: 'link' });
  if (s.status !== 200) throw new Error(`send ${s.status} ${JSON.stringify(s.body)}`);
  const inv = await a.post(`/quotes/${q.body.id}/create-invoice`, { onBehalfNote: 'Confirmed by phone' });
  if (inv.status !== 201) throw new Error(`invoice ${inv.status} ${JSON.stringify(inv.body)}`);
  const iss = await a.post(`/invoices/${inv.body.id}/issue`).set('If-Match', String(inv.body.version));
  if (iss.status !== 200) throw new Error(`issue ${iss.status} ${JSON.stringify(iss.body)}`);
  return iss.body as { id: string; number: string; balanceDue: number; totals: { grandTotal: number } };
}
