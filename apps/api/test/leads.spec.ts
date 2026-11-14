import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeCustomer, setup } from './helpers.js';

describe('leads (FR-025 – FR-036)', () => {
  it('TC-077 FR-025 AC1 needs phone or email; TC-087 FR-028 normalises', async () => {
    const env = await setup();
    expect((await env.admin.post('/leads', { name: 'Ravi' })).body.code).toBe('LEAD_CONTACT_REQUIRED');
    const r = await env.admin.post('/leads', { name: 'Ravi Kumar', phone: '098450 12345' });
    expect(r.status).toBe(201);
    expect(r.body.lead).toMatchObject({ phone: '+919845012345', stage: 'new', consentBasis: 'person_initiated', slaStatus: 'pending' });
    expect(r.body.lead.id).toMatch(/^L-\d{6}$/);
  });

  it('TC-089 FR-029 AC1 re-enquiry merges into the open lead', async () => {
    const env = await setup();
    const a = await env.admin.post('/leads', { name: 'Ravi Kumar', phone: '9845012345' });
    const b = await env.admin.post('/leads', { name: 'R Kumar', phone: '+91 98450 12345', email: 'ravi@x.com' });
    expect(b.body.outcome).toBe('merged');
    expect(b.body.lead.id).toBe(a.body.lead.id);
    expect(b.body.lead.email).toBe('ravi@x.com'); // empty field filled
    expect(b.body.lead.name).toBe('Ravi Kumar'); // existing kept
    const tl = await env.admin.get(`/timeline/lead/${a.body.lead.id}`);
    expect(tl.body.items.some((x: { note: string }) => x.note.startsWith('Re-enquired'))).toBe(true);
  });

  it('TC-090 FR-029 AC2 a Lost lead reopens to New on re-enquiry', async () => {
    const env = await setup();
    const a = await env.admin.post('/leads', { name: 'Anita', phone: '9876543210' });
    await env.admin.post(`/leads/${a.body.lead.id}/stage`, { stage: 'lost', reasonId: 'm_lostReasons_price' });
    const b = await env.admin.post('/leads', { name: 'Anita', phone: '9876543210' });
    expect(b.body.lead).toMatchObject({ id: a.body.lead.id, stage: 'new' });
  });

  it('TC-091 FR-029 AC3 enquiry from an existing customer contact creates a linked lead', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const r = await env.admin.post('/leads', { name: 'Ravi again', phone: '9845012345' });
    expect(r.body.outcome).toBe('linked_customer');
    expect(r.body.lead).toMatchObject({ customerId: c.id, labels: expect.arrayContaining(['existing_customer']) });
  });

  it('E-01 concurrent enquiries with the same phone create exactly one lead', async () => {
    const env = await setup();
    const results = await Promise.all(Array.from({ length: 5 }, () => env.admin.post('/leads', { name: 'Same Person', phone: '9811111111' })));
    expect(results.filter((r) => r.body.outcome === 'created')).toHaveLength(1);
    expect(env.db.dump('leads')).toHaveLength(1);
  });

  it('TC-099 / TC-100 / TC-101 FR-033 stage rules and history', async () => {
    const env = await setup();
    const a = await env.admin.post('/leads', { name: 'Stage Test', phone: '9822222222' });
    const id = a.body.lead.id;
    expect((await env.admin.post(`/leads/${id}/stage`, { stage: 'lost' })).body.code).toBe('LOST_REASON_REQUIRED');
    expect((await env.admin.post(`/leads/${id}/stage`, { stage: 'won' })).body.code).toBe('WON_ONLY_BY_CONVERSION');
    expect((await env.admin.post(`/leads/${id}/stage`, { stage: 'contacted' })).body.stage).toBe('contacted');
    const tl = await env.admin.get(`/timeline/lead/${id}?types=stage`);
    expect(tl.body.items[0].note).toBe('Stage: new → contacted');
  });

  it('TC-246 RULE-011 a sales executive cannot see another executive’s lead', async () => {
    const env = await setup({ mode: 'team' });
    const a = await env.createUser('exec.a', 'sales_exec');
    const b = await env.createUser('exec.b', 'sales_exec');
    const lead = await a.agent.post('/leads', { name: 'Private Lead', phone: '9833333333' });
    expect(lead.body.lead.ownerId).toBe(a.id);
    expect((await b.agent.get(`/leads/${lead.body.lead.id}`)).status).toBe(404);
    expect((await b.agent.get('/leads')).body.items).toHaveLength(0);
    expect((await b.agent.get('/search?q=private')).body.groups.leads).toBeUndefined();
    expect((await a.agent.get('/search?q=98333 33333')).body.groups.leads).toHaveLength(1);
  });

  it('TC-097 / TC-098 FR-032 bulk reassign skips out-of-scope leads and moves follow-ups', async () => {
    const env = await setup({ mode: 'team' });
    const mgr = await env.createUser('mgr', 'sales_manager');
    const inTeam = await env.createUser('exec.in', 'sales_exec');
    const outTeam = await env.createUser('exec.out', 'sales_exec');
    const target = await env.createUser('exec.d', 'sales_exec');
    await env.admin.post('/admin/teams', { name: 'South', managerId: mgr.id, memberIds: [inTeam.id, target.id] });
    const l1 = await inTeam.agent.post('/leads', { name: 'In 1', phone: '9840000001' });
    const l2 = await outTeam.agent.post('/leads', { name: 'Out 1', phone: '9840000002' });
    await inTeam.agent.post('/follow-ups', { recordType: 'lead', recordId: l1.body.lead.id, dueAt: '2026-11-14T05:30:00Z', type: 'call' });
    const { clearUserCache } = await import('../src/http/pipeline.js');
    clearUserCache();
    const r = await mgr.agent.post('/leads/bulk', { ids: [l1.body.lead.id, l2.body.lead.id], action: 'assign', ownerId: target.id });
    expect(r.body.ok).toEqual([l1.body.lead.id]);
    expect(r.body.skipped).toEqual([{ id: l2.body.lead.id, reason: 'OUT_OF_SCOPE' }]);
    const fus = env.db.dump('followUps');
    expect(fus[0]!.ownerId).toBe(target.id);
    expect((await env.admin.post('/leads/bulk', { ids: Array.from({ length: 501 }, (_x, i) => `L-${i}`), action: 'tag', tags: ['x'] })).body.code).toBe('BULK_TOO_LARGE');
  });

  it('TC-106 / TC-107 FR-036 convert creates customer, moves history and follow-ups', async () => {
    const env = await setup();
    const l = await env.admin.post('/leads', { name: 'Convert Me', phone: '9855555555', company: 'Convert Co' });
    await env.admin.post('/follow-ups', { recordType: 'lead', recordId: l.body.lead.id, dueAt: '2026-11-15T05:30:00Z', type: 'call' });
    const r = await env.admin.post(`/leads/${l.body.lead.id}/convert`, { mode: 'new' });
    expect(r.status).toBe(200);
    const lead = await env.admin.get(`/leads/${l.body.lead.id}`);
    expect(lead.body).toMatchObject({ stage: 'won', customerId: r.body.customerId });
    const tl = await env.admin.get(`/timeline/customer/${r.body.customerId}`);
    expect(tl.body.items.length).toBeGreaterThan(1); // lead history included (FR-035 AC1)
    expect(env.db.dump('followUps')[0]).toMatchObject({ recordType: 'customer', recordId: r.body.customerId });
    expect((await env.admin.post(`/leads/${l.body.lead.id}/convert`, { mode: 'new' })).body.code).toBe('CONVERT_ALREADY_DONE');
  });

  it('TC-082 / TC-083 FR-027 webhook with API key is idempotent; revoked key rejected', async () => {
    const env = await setup();
    const k = await env.admin.post('/admin/lead-capture/keys', { name: 'Website', sourceId: 'm_leadSources_webhook' });
    const call = () => request(env.app).post('/api/v1/hooks/leads').set('X-Api-Key', k.body.key).set('Idempotency-Key', 'abc-123').send({ name: 'Hook Lead', phone: '9866666666' });
    const r1 = await call();
    const r2 = await call();
    expect(r1.status).toBe(201);
    expect(r2.body).toEqual(r1.body);
    expect(env.db.dump('leads')).toHaveLength(1);
    await env.admin.del(`/admin/lead-capture/keys/${k.body.id}`);
    const r3 = await request(env.app).post('/api/v1/hooks/leads').set('X-Api-Key', k.body.key).send({ name: 'X', phone: '9866666667' });
    expect(r3.status).toBe(401);
  });

  it('TC-084 / TC-085 / TC-251 FR-027 web form: honeypot and missing consent are silently dropped; consent recorded', async () => {
    const env = await setup();
    const post = (body: object) => request(env.app).post('/api/v1/public/forms/default/submit').send(body);
    expect((await post({ fields: { name: 'Bot', phone: '9877777777' }, hp: 'filled', consent: true })).status).toBe(202);
    expect((await post({ fields: { name: 'No consent', phone: '9877777778' }, consent: false })).status).toBe(202);
    expect(env.db.dump('leads')).toHaveLength(0);
    await post({ fields: { name: 'Real', phone: '9877777779' }, consent: true, renderedAt: Date.now() - 10_000 });
    expect(env.db.dump('leads')[0]).toMatchObject({ consentBasis: 'web_form_consent' });
  });
});
