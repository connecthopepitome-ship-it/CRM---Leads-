import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { pendingQty, upiTrRef } from '@ss/domain';
import { issuedInvoice, LINE, makeCustomer, setup } from './helpers.js';

describe('quotations, orders, invoices (FR-051 – FR-069)', () => {
  it('TC-153 / TC-152 FR-052 server computes totals; draft has no number', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const q = await env.admin.post('/quotes', { partyType: 'customer', partyId: c.id, lines: [LINE] });
    expect(q.status).toBe(201);
    expect(q.body).toMatchObject({ status: 'draft', number: null, intraState: true });
    expect(q.body.totals).toMatchObject({ taxable: 1_800_000, cgst: 162_000, sgst: 162_000, grandTotal: 2_124_000 });
  });

  it('TC-154 FR-052 AC2 inter-state customer gets IGST', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin, { billing: { line1: 'Andheri', city: 'Mumbai', stateCode: '27' }, gstin: '27ABCDE1234F1Z5' });
    const q = await env.admin.post('/quotes', { partyType: 'customer', partyId: c.id, lines: [LINE] });
    expect(q.body.totals).toMatchObject({ igst: 324_000, cgst: 0 });
  });

  it('TC-157 – TC-159 FR-053 discount above the role limit needs a manager; no self-approval', async () => {
    const env = await setup({ mode: 'team' });
    const mgr = await env.createUser('mgr', 'sales_manager');
    const exec = await env.createUser('exec', 'sales_exec');
    expect((await env.admin.post('/admin/teams', { name: 'Team South', managerId: mgr.id, memberIds: [exec.id] })).status).toBe(201);
    const { clearUserCache } = await import('../src/http/pipeline.js');
    clearUserCache();
    const c = await makeCustomer(exec.agent);
    const q = await exec.agent.post('/quotes', { partyType: 'customer', partyId: c.id, lines: [{ ...LINE, discountPct: 15 }] });
    const s = await exec.agent.post(`/quotes/${q.body.id}/send`, { channel: 'link' });
    expect(s.status).toBe(202);
    expect(s.body.status).toBe('pending_approval');
    await env.tasks.drain();
    expect(env.db.dump('notifications').filter((n) => n.event === 'N-005').map((n) => n.userId)).toEqual([mgr.id]);
    const ok = await mgr.agent.post(`/quotes/${q.body.id}/approval`, { decision: 'approve' });
    expect(ok.body.status).toBe('approved');
    const sent = await exec.agent.post(`/quotes/${q.body.id}/send`, { channel: 'link' });
    expect(sent.status).toBe(200);
    expect(sent.body.number).toMatch(/^QT\/\d{2}-\d{2}\/0001$/);
    // manager's own quote cannot be self-approved
    const own = await mgr.agent.post('/quotes', { partyType: 'customer', partyId: c.id, lines: [{ ...LINE, discountPct: 50 }] });
    await mgr.agent.post(`/quotes/${own.body.id}/send`, {});
    expect((await mgr.agent.post(`/quotes/${own.body.id}/approval`, { decision: 'approve' })).body.code).toBe('SELF_APPROVAL');
  });

  it('TC-161 FR-053 AC5 Solo mode never needs approval', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const q = await env.admin.post('/quotes', { partyType: 'customer', partyId: c.id, lines: [{ ...LINE, discountPct: 60 }] });
    expect((await env.admin.post(`/quotes/${q.body.id}/send`, {})).body.status).toBe('sent');
  });

  it('TC-167 / TC-168 / TC-173 / TC-175 / TC-169 / TC-172 send, view tracking, accept once, lead converted', async () => {
    const env = await setup();
    const l = await env.admin.post('/leads', { name: 'Quote Lead', phone: '9800000001' });
    const q = await env.admin.post('/quotes', { partyType: 'lead', partyId: l.body.lead.id, lines: [LINE] });
    const s = await env.admin.post(`/quotes/${q.body.id}/send`, { channel: 'whatsapp' });
    expect(s.body.waUrl).toMatch(/^https:\/\/wa\.me\/919800000001\?text=/);
    expect((await env.admin.get(`/leads/${l.body.lead.id}`)).body.stage).toBe('quotation_sent');
    const tok = String(s.body.shareUrl).split('/s/')[1];
    for (let i = 0; i < 3; i++) expect((await request(env.app).get(`/api/v1/public/s/${tok}`)).status).toBe(200);
    await request(env.app).get(`/api/v1/public/s/${tok}`).set('Authorization', 'Bearer internal'); // internal view not counted
    const after = await env.admin.get(`/quotes/${q.body.id}`);
    expect(after.body).toMatchObject({ viewCount: 3, status: 'viewed' });
    expect(env.db.dump('notifications').filter((n) => n.event === 'N-007')).toHaveLength(1);
    const accept = () => request(env.app).post(`/api/v1/public/s/${tok}/respond`).send({ type: 'accept', name: 'Ravi Kumar' });
    const [a1, a2] = await Promise.all([accept(), accept()]);
    expect([a1.body.status, a2.body.status]).toEqual(['accepted', 'accepted']);
    expect(env.db.dump('auditLog').filter((x) => x.action === 'quote.respond')).toHaveLength(1);
    const lead = await env.admin.get(`/leads/${l.body.lead.id}`);
    expect(lead.body.stage).toBe('won');
  });

  it('TC-171 FR-057 AC3 expired quote cannot be accepted; TC-174 job marks Expired', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const q = await env.admin.post('/quotes', { partyType: 'customer', partyId: c.id, lines: [LINE], validDays: 1 });
    const s = await env.admin.post(`/quotes/${q.body.id}/send`, {});
    env.clock.t = new Date(env.clock.t.getTime() + 3 * 86_400_000);
    const tok = String(s.body.shareUrl).split('/s/')[1];
    const view = await request(env.app).get(`/api/v1/public/s/${tok}`);
    expect(view.body.state).toBe('expired');
    expect((await request(env.app).post(`/api/v1/public/s/${tok}/respond`).send({ type: 'accept', name: 'Late' })).body.code).toBe('QUOTE_EXPIRED');
    const { runJob } = await import('../src/jobs.js');
    expect(await runJob(env.ctx, 'quotes.expire')).toBe(1);
  });

  it('TC-162 / TC-163 FR-054 revision keeps base number and supersedes the previous one', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const q = await env.admin.post('/quotes', { partyType: 'customer', partyId: c.id, lines: [LINE] });
    const s0 = await env.admin.post(`/quotes/${q.body.id}/send`, {});
    expect((await env.admin.patch(`/quotes/${q.body.id}`, { notes: 'x' }).set('If-Match', '9')).body.code).toBe('QUOTE_LOCKED');
    const r1 = await env.admin.post(`/quotes/${q.body.id}/revise`);
    expect(r1.body).toMatchObject({ revision: 1, status: 'draft', number: s0.body.number });
    const s1 = await env.admin.post(`/quotes/${r1.body.id}/send`, {});
    expect(s1.body.number).toBe(`${s0.body.number}-R1`);
    expect((await env.admin.get(`/quotes/${q.body.id}`)).body.status).toBe('superseded');
    const oldTok = String(s0.body.shareUrl).split('/s/')[1];
    const v = await request(env.app).get(`/api/v1/public/s/${oldTok}`);
    // FR-054 AC2: R0 link shows 'updated' with a link to R1 and no Accept
    expect(v.body).toMatchObject({ state: 'superseded', actions: [] });
    expect(v.body.latestUrl).toBe(s1.body.shareUrl);
  });

  it('TC-179 FR-059 AC4 invoice from accepted quote creates a hidden order; TC-184 qty cap; TC-189 HSN', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const inv = await issuedInvoice(env.admin, c.id);
    expect(inv.number).toMatch(/^INV\/\d{2}-\d{2}\/0001$/);
    expect(inv.balanceDue).toBe(2_124_000);
    const order = env.db.dump('salesOrders')[0]!;
    expect(order.hidden).toBe(true);
    const again = await env.admin.post('/invoices', { type: 'tax_invoice', orderId: order.id, lines: [{ orderLineId: 'ol1', qty: 1 }] });
    expect(again.body.code).toBe('INVOICE_QTY_EXCEEDS_PENDING');
    const q2 = await env.admin.post('/quotes', { partyType: 'customer', partyId: c.id, lines: [{ ...LINE, hsnSac: null }] });
    await env.admin.post(`/quotes/${q2.body.id}/send`, {});
    const d = await env.admin.post(`/quotes/${q2.body.id}/create-invoice`, { onBehalfNote: 'ok' });
    expect((await env.admin.post(`/invoices/${d.body.id}/issue`)).body.code).toBe('HSN_SAC_REQUIRED');
    // no number consumed by the failed issue (FR-065 AC3)
    expect(env.db.dump('counters').find((x) => x.id.startsWith('tax_invoice'))!.value).toBe(1);
  });

  it('E-04 concurrent issues produce distinct consecutive numbers', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const drafts = [];
    for (let i = 0; i < 6; i++) drafts.push((await env.admin.post('/invoices', { type: 'tax_invoice', customerId: c.id, manualLines: [LINE] })).body.id);
    const out = await Promise.all(drafts.map((id) => env.admin.post(`/invoices/${id}/issue`)));
    const nums = out.map((r) => r.body.number as string).sort();
    expect(new Set(nums).size).toBe(6);
    expect(nums.map((n) => Number(n.split('/')[2]))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('TC-190 / TC-191 FR-065 issued invoices are frozen; stale draft saves are refused', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const d = await env.admin.post('/invoices', { type: 'tax_invoice', customerId: c.id, manualLines: [LINE] });
    expect((await env.admin.patch(`/invoices/${d.body.id}`, { notes: 'a' }).set('If-Match', String(d.body.version))).status).toBe(200);
    expect((await env.admin.patch(`/invoices/${d.body.id}`, { notes: 'b' }).set('If-Match', String(d.body.version))).body.code).toBe('VERSION_CONFLICT');
    const cur = await env.admin.get(`/invoices/${d.body.id}`);
    await env.admin.post(`/invoices/${d.body.id}/issue`);
    const e = await env.admin.patch(`/invoices/${d.body.id}`, { manualLines: [LINE] }).set('If-Match', String(cur.body.version + 1));
    expect(e.body.code).toBe('DOCUMENT_ISSUED');
  });

  it('TC-193 FR-066 AC1 full credit note cancels the invoice and restores order quantity', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const inv = await issuedInvoice(env.admin, c.id);
    const cn = await env.admin.post(`/invoices/${inv.id}/credit-notes`, { mode: 'full', reason: 'Wrong customer' });
    expect(cn.status).toBe(201);
    expect(cn.body.number).toMatch(/^CN\//);
    const i = await env.admin.get(`/invoices/${inv.id}`);
    expect(i.body).toMatchObject({ status: 'cancelled', balanceDue: 0, cancelledByNumber: cn.body.number });
    expect((await env.admin.get(`/orders/${env.db.dump('salesOrders')[0]!.id}`)).body.code).toBe('MODULE_DISABLED'); // FR-004 AC4
    const ol = (env.db.dump('salesOrders')[0] as unknown as { lines: { qty: number; invoicedQty?: number; creditedQty?: number }[] }).lines[0]!;
    expect(pendingQty({ qty: ol.qty, invoicedQty: ol.invoicedQty ?? 0, creditedQty: ol.creditedQty ?? 0 })).toBe(2);
    expect((await env.admin.post(`/invoices/${inv.id}/credit-notes`, { mode: 'amount', amount: 1, reason: 'again' })).body.code).toBe('CREDIT_EXCEEDS_TOTAL');
  });

  it('TC-180 FR-060 AC1 an order with live invoices cannot be cancelled', async () => {
    const env = await setup();
    await env.admin.put('/admin/settings/modules', { data: { orders: true } });
    const c = await makeCustomer(env.admin);
    await issuedInvoice(env.admin, c.id);
    const o = env.db.dump('salesOrders')[0]!;
    expect((await env.admin.post(`/orders/${o.id}/status`, { status: 'cancelled', reason: 'Customer cancelled' })).body.code).toBe('ORDER_HAS_INVOICES');
  });

  it('TC-188 / TC-197 invoice UPI payload for the balance; TC-156 non-GST install issues Bill of Supply', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const inv = await issuedInvoice(env.admin, c.id);
    const upi = await env.admin.get(`/invoices/${inv.id}/upi`);
    expect(upi.body.uri).toBe(`upi://pay?pa=acme@okhdfcbank&pn=Acme%20Interiors&am=21240.00&cu=INR&tn=${encodeURIComponent(inv.number)}&tr=${upiTrRef(inv.number)}`);
    expect(upi.body.qrSvg).toContain('<svg');

    const nongst = await setup({ gst: false });
    const c2 = await makeCustomer(nongst.admin);
    const d = await nongst.admin.post('/invoices', { type: 'bill_of_supply', customerId: c2.id, manualLines: [LINE] });
    expect(d.body.totals.taxTotal).toBe(0);
    expect((await nongst.admin.post('/invoices', { type: 'tax_invoice', customerId: c2.id, manualLines: [LINE] })).body.code).toBe('VALIDATION_FAILED');
  });
});
