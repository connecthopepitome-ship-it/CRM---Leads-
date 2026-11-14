import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { runJob } from '../src/jobs.js';
import { issuedInvoice, LINE, makeCustomer, setup } from './helpers.js';

describe('platform, audit, privacy, insights', () => {
  it('API-001 health and app-config are public', async () => {
    const env = await setup();
    expect((await request(env.app).get('/api/v1/health')).body.status).toBe('ok');
    expect((await request(env.app).get('/api/v1/app-config')).body).toMatchObject({ mode: 'solo', companyName: 'Acme Interiors' });
  });

  it('TC-014 / TC-019 FR-005 number series validation', async () => {
    const env = await setup();
    expect((await env.admin.put('/admin/number-series/tax_invoice', { prefix: 'INVOICE', pad: 5, fyReset: true })).body.code).toBe('SERIES_TOO_LONG');
    expect((await env.admin.put('/admin/number-series/tax_invoice', { prefix: 'ACME', pad: 4, fyReset: true })).status).toBe(200);
    const c = await makeCustomer(env.admin);
    expect((await issuedInvoice(env.admin, c.id)).number).toMatch(/^ACME\//);
  });

  it('TC-054 – TC-058 FR-015 / FR-016 audit: masked, immutable, range guard, role access', async () => {
    const env = await setup({ mode: 'team' });
    const viewer = await env.createUser('auditor', 'viewer');
    const exec = await env.createUser('exec', 'sales_exec');
    const l = await env.admin.post('/leads', { name: 'Audit Me', phone: '9845012345' });
    await env.admin.patch(`/leads/${l.body.lead.id}`, { phone: '9845012346' });
    const s = await viewer.agent.post('/admin/audit/search', { from: '2026-11-01', to: '2026-11-30', recordType: 'lead' });
    const upd = s.body.items.find((x: { action: string }) => x.action === 'lead.update');
    expect(upd.changes).toContainEqual({ field: 'phone', before: '+91*******345', after: '+91*******346' });
    expect(JSON.stringify(s.body)).not.toContain('9845012345');
    expect((await env.admin.patch(`/admin/audit/${upd.id}`, {})).status).toBe(405);
    expect((await env.admin.del(`/admin/audit/${upd.id}`)).body.code).toBe('AUDIT_IMMUTABLE');
    expect((await viewer.agent.post('/admin/audit/search', { from: '2025-01-01', to: '2026-11-30' })).body.code).toBe('AUDIT_RANGE_TOO_LARGE');
    expect((await exec.agent.post('/admin/audit/search', { from: '2026-11-01', to: '2026-11-30' })).status).toBe(403);
  });

  it('NFR-022 audit coverage: every state change in a full journey leaves an audit entry', async () => {
    const env = await setup();
    const before = env.db.dump('auditLog').length;
    const c = await makeCustomer(env.admin);
    const inv = await issuedInvoice(env.admin, c.id, LINE);
    await env.admin.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 100_000, mode: 'cash' });
    await env.admin.post(`/invoices/${inv.id}/credit-notes`, { mode: 'amount', amount: 1000, reason: 'Rounding' });
    const actions = env.db.dump('auditLog').slice(before).map((a) => a.action);
    for (const a of ['customer.create', 'quote.create', 'quote.send', 'quote.accept_on_behalf', 'order.create', 'invoice.create', 'invoice.issue', 'payment.create', 'credit_note.issue']) expect(actions).toContain(a);
  });

  it('TC-244 / TC-245 FR-083 global search by phone and document number', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const inv = await issuedInvoice(env.admin, c.id);
    const byPhone = await env.admin.get('/search?q=98450 12345');
    expect(byPhone.body.groups.customers[0].id).toBe(c.id);
    const seq = inv.number.split('/')[2];
    const byNo = await env.admin.get(`/search?q=${seq}`);
    expect(byNo.body.groups.invoices[0].title).toBe(inv.number);
    expect((await env.admin.get('/search?q=a')).body.code).toBe('SEARCH_QUERY_SHORT');
  });

  it('TC-247 FR-084 dashboard tiles are scoped to the executive', async () => {
    const env = await setup({ mode: 'team' });
    const exec = await env.createUser('exec', 'sales_exec');
    await env.admin.post('/leads', { name: 'Admin Lead', phone: '9811000001' });
    await exec.agent.post('/leads', { name: 'Exec Lead', phone: '9811000002' });
    const d = await exec.agent.get('/dashboard');
    expect(d.body.tiles.find((t: { id: string }) => t.id === 'new_leads').value).toBe(1);
    expect((await exec.agent.get('/reports/RPT-008')).status).toBe(403);
  });

  it('TC-254 / TC-255 FR-088 erase deletes a lead-only person; anonymises when invoices exist', async () => {
    const env = await setup();
    await env.admin.post('/leads', { name: 'Forget Me', phone: '9899999999' });
    const f = await env.admin.post('/admin/privacy/find', { phone: '98999 99999' });
    expect(f.body.plan.mode).toBe('delete');
    expect((await env.admin.post('/admin/privacy/erase', { personKey: f.body.personKey })).body.code).toBe('CONFIRMATION_REQUIRED');
    expect((await env.admin.post('/admin/privacy/erase', { personKey: f.body.personKey, confirm: 'ERASE' })).status).toBe(202);
    expect(env.db.dump('leads')).toHaveLength(0);
    expect(env.db.dump('tombstones')).toHaveLength(1);

    const c = await makeCustomer(env.admin);
    await issuedInvoice(env.admin, c.id);
    const f2 = await env.admin.post('/admin/privacy/find', { phone: '9845012345' });
    expect(f2.body.plan.mode).toBe('anonymise');
    await env.admin.post('/admin/privacy/erase', { personKey: f2.body.personKey, confirm: 'ERASE' });
    const inv = env.db.dump('invoices')[0]!;
    expect((inv.billTo as { name: string }).name).toBe('Ravi Designs'); // legal invoice fields kept
    expect(env.db.dump('contacts')[0]).toMatchObject({ phone: null, email: null, name: 'Erased contact' });
  });

  it('TC-260 / TC-261 FR-090 junk purge after 3 calendar months; reopened lead kept', async () => {
    const env = await setup();
    const a = await env.admin.post('/leads', { name: 'Junk A', phone: '9810000001' });
    const b = await env.admin.post('/leads', { name: 'Junk B', phone: '9810000002' });
    await env.admin.post(`/leads/${a.body.lead.id}/stage`, { stage: 'junk', reasonId: 'm_junkReasons_spam' });
    await env.admin.post(`/leads/${b.body.lead.id}/stage`, { stage: 'junk', reasonId: 'm_junkReasons_spam' });
    await env.admin.post(`/leads/${b.body.lead.id}/reopen`);
    env.clock.t = new Date('2027-02-13T20:00:00Z'); // 14-02-2027 IST: junkAt 13-11-2026 + 3 months = 13-02-2027
    expect(await runJob(env.ctx, 'retention.purge')).toBe(1);
    expect(env.db.dump('leads').map((l) => l.id)).toEqual([b.body.lead.id]);
  });
});
