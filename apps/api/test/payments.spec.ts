import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { issuedInvoice, LINE, makeCustomer, setup } from './helpers.js';

const L = (rate: number) => ({ ...LINE, qty: 1, rate, discountPct: 0, taxRatePct: 0 });

describe('payments (FR-070 – FR-073) and customer finance (FR-074 – FR-076)', () => {
  it('TC-210 / TC-211 FR-071 oldest-first allocation and advance', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const a = await issuedInvoice(env.admin, c.id, L(1_000_000));
    env.clock.t = new Date(env.clock.t.getTime() + 2 * 86_400_000);
    const b = await issuedInvoice(env.admin, c.id, L(1_500_000));
    const p = await env.admin.post('/payments', { customerId: c.id, date: '2026-11-15', amount: 3_000_000, mode: 'upi', reference: '432112345678' });
    expect(p.status).toBe(201);
    expect(p.body.receiptNo).toMatch(/^RCPT\//);
    expect(p.body.allocations.map((x: { invoiceId: string; amount: number }) => [x.invoiceId, x.amount])).toEqual([[a.id, 1_000_000], [b.id, 1_500_000]]);
    expect(p.body.advance).toBe(500_000);
    const c360 = await env.admin.get(`/customers/${c.id}/360`);
    expect(c360.body.kpis).toMatchObject({ outstanding: 0, advance: 500_000, received: 3_000_000 });
  });

  it('TC-212 FR-071 AC3 TDS settles the invoice and shows separately on the statement (TC-224)', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const inv = await issuedInvoice(env.admin, c.id, L(1_000_000));
    const p = await env.admin.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 900_000, tdsAmount: 100_000, tdsSection: '194J', mode: 'neft', reference: 'N123' });
    expect(p.body.allocations[0].amount).toBe(1_000_000);
    expect((await env.admin.get(`/invoices/${inv.id}`)).body).toMatchObject({ status: 'paid', balanceDue: 0 });
    const st = await env.admin.get(`/customers/${c.id}/statement?from=2026-11-01&to=2026-11-30`);
    expect(st.body.rows.map((r: { kind: string }) => r.kind)).toEqual(['invoice', 'payment', 'tds']);
    expect(st.body.closing).toBe(0);
  });

  it('TC-198 / TC-205 part payment lowers the QR amount on the public invoice page', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const inv = await issuedInvoice(env.admin, c.id, L(4_838_000));
    const link = await env.admin.post('/share-links', { documentType: 'invoice', documentId: inv.id });
    const tok = String(link.body.url).split('/s/')[1];
    await env.admin.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 2_000_000, mode: 'upi', reference: 'U1' });
    const page = await request(env.app).get(`/api/v1/public/s/${tok}`);
    expect(page.body.balanceDue).toBe(2_838_000);
    expect(page.body.upi.uri).toContain('am=28380.00');
    expect(page.body.html).toContain('Scan to pay');
  });

  it('TC-207 / TC-208 / TC-213 validation: duplicate UTR, future date, manual over-allocation', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const inv = await issuedInvoice(env.admin, c.id, L(1_000_000));
    await env.admin.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 100_000, mode: 'upi', reference: 'utr 999' });
    const dup = await env.admin.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 100_000, mode: 'upi', reference: 'UTR999' });
    expect(dup.body).toMatchObject({ code: 'UTR_DUPLICATE' });
    expect((await env.admin.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 100_000, mode: 'upi', reference: 'UTR999', utrOverrideReason: 'Bank reused ref' })).status).toBe(201);
    expect((await env.admin.post('/payments', { customerId: c.id, date: '2026-11-14', amount: 1, mode: 'cash' })).body.code).toBe('PAYMENT_DATE_FUTURE');
    expect((await env.admin.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 1, mode: 'upi' })).body.code).toBe('REFERENCE_REQUIRED');
    const over = await env.admin.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 1000, mode: 'cash', allocation: { mode: 'manual', items: [{ invoiceId: inv.id, amount: 2000 }] } });
    expect(over.body.code).toBe('ALLOCATION_EXCEEDS_AMOUNT');
  });

  it('TC-209 FR-070 AC4 repeated submission with the same Idempotency-Key creates one payment', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    await issuedInvoice(env.admin, c.id, L(1_000_000));
    const send = () => env.admin.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 500_000, mode: 'cash' }).set('Idempotency-Key', 'k-1');
    const r1 = await send();
    const r2 = await send();
    expect(r2.body.id).toBe(r1.body.id);
    expect(env.db.dump('payments')).toHaveLength(1);
  });

  it('TC-215 / TC-216 FR-073 reversal restores the balance; executives cannot reverse', async () => {
    const env = await setup({ mode: 'team' });
    const exec = await env.createUser('exec', 'sales_exec');
    const c = await makeCustomer(env.admin, { ownerId: exec.id });
    const inv = await issuedInvoice(env.admin, c.id, L(1_000_000));
    const p = await exec.agent.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 1_000_000, mode: 'cheque', reference: 'CHQ1' });
    expect(p.status).toBe(201);
    expect((await exec.agent.post(`/payments/${p.body.id}/reverse`, { reason: 'Bounced' })).status).toBe(403);
    const r = await env.admin.post(`/payments/${p.body.id}/reverse`, { reason: 'Cheque bounced' });
    expect(r.body).toMatchObject({ status: 'reversed' });
    expect((await env.admin.get(`/invoices/${inv.id}`)).body).toMatchObject({ balanceDue: 1_000_000, status: 'issued' });
    expect((await env.admin.post(`/payments/${p.body.id}/reverse`, { reason: 'again' })).body.code).toBe('PAYMENT_ALREADY_REVERSED');
  });

  it('TC-194 FR-066 AC2 credit beyond the balance becomes on-account credit', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const inv = await issuedInvoice(env.admin, c.id, L(1_000_000));
    await env.admin.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 600_000, mode: 'cash' });
    const cn = await env.admin.post(`/invoices/${inv.id}/credit-notes`, { mode: 'amount', amount: 600_000, reason: 'Scope reduced' });
    expect(cn.body.onAccountCredit).toBe(200_000);
    expect((await env.admin.get(`/invoices/${inv.id}`)).body.balanceDue).toBe(0);
  });

  it('TC-217 / TC-218 FR-074 GSTIN state and duplicate warning', async () => {
    const env = await setup();
    const bad = await env.admin.post('/customers', { displayName: 'X', type: 'business', gstin: '29ABCDE1234F1Z5', billing: { line1: 'a', city: 'Mumbai', stateCode: '27' } });
    expect(bad.body.code).toBe('GSTIN_STATE_MISMATCH');
    await makeCustomer(env.admin, { gstin: '29ABCDE1234F1Z5' });
    expect((await env.admin.post('/customers', { displayName: 'Y', type: 'business', gstin: '29ABCDE1234F1Z5' })).body.code).toBe('POSSIBLE_DUPLICATE');
    expect((await env.admin.post('/customers', { displayName: 'Y', type: 'business', gstin: '29ABCDE1234F1Z5', confirmDuplicate: true })).status).toBe(201);
  });

  it('TC-221 FR-075 AC3 Project Manager sees no financial tiles or tabs', async () => {
    const env = await setup({ mode: 'team' });
    const pm = await env.createUser('pm.user', 'project_manager');
    const c = await makeCustomer(env.admin);
    const r = await pm.agent.get(`/customers/${c.id}/360`);
    expect(r.body.tabs).not.toContain('invoices');
    expect(r.body.ageing).toBeNull();
    expect(r.body.customer.totals).toBeUndefined();
    expect((await pm.agent.get(`/customers/${c.id}/invoices`)).status).toBe(403);
  });

  it('TC-249 FR-085 AC1 ageing buckets sum to outstanding', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin, { creditDays: 0 });
    await issuedInvoice(env.admin, c.id, L(1_000_000));
    env.clock.t = new Date(env.clock.t.getTime() + 45 * 86_400_000);
    await issuedInvoice(env.admin, c.id, L(500_000));
    const r = await env.admin.get('/reports/RPT-004');
    const row = r.body.rows[0];
    expect(row.d31_60).toBe(1_000_000);
    expect(row.not_due).toBe(500_000);
    expect(row.not_due + row.d1_30 + row.d31_60 + row.d61_90 + row.d90_plus).toBe(row.outstanding);
  });
});
