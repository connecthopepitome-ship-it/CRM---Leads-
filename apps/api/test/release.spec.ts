/** Release-readiness coverage (Phase 13): Must FRs that had no automated test. One `it` per FR, TC IDs from docs/08-test. */
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { accessibleOnWhiteText, contrastRatio, renderTemplate } from '@ss/domain';
import { runJob } from '../src/jobs.js';
import { MIGRATIONS, runMigrations } from '../src/migrations.js';
import { moveLeadFilesTask } from '../src/modules/documents.js';
import { pushSendTask } from '../src/modules/notify.js';
import { seedInstall } from '../src/seed.js';
import { unseal } from '../src/shared/core.js';
import { issuedInvoice, LINE, makeCustomer, setup } from './helpers.js';

const H = { 'X-Requested-With': 'SaleSphere' };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('platform & configuration (FR-002 – FR-006, FR-014)', () => {
  it('TC-004 / TC-005 FR-002 provisioning seeds roles, series, masters and one admin; re-running duplicates nothing', async () => {
    const env = await setup();
    const count = () => ({ users: env.db.dump('users').length, masters: env.db.dump('masters').length, series: env.db.dump('numberSeries').length, migrations: env.db.dump('migrations').length });
    const before = count();
    expect(before.users).toBe(1);
    expect(before.masters).toBeGreaterThan(10);
    expect((await env.admin.get('/admin/roles')).body.items).toHaveLength(6); // TC-051 FR-014 AC1
    await seedInstall(env.ctx, { adminUsername: 'admin', adminName: 'Asha Admin', adminPassword: 'Another-Passw0rd-9', webCatalogue: true });
    expect(count()).toEqual(before);
  });

  it('TC-007 / TC-009 FR-003 terminology reaches every user; low-contrast brand colour is refused with an accessible suggestion', async () => {
    const env = await setup();
    expect((await env.admin.put('/admin/settings/terminology', { data: { lead: 'Enquiry', leads: 'Enquiries' } })).status).toBe(200);
    expect((await request(env.app).get('/api/v1/app-config')).body.terminology).toMatchObject({ lead: 'Enquiry' });
    const r = await env.admin.put('/admin/settings/branding', { data: { primary: '#FDE68A' } });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe('CONTRAST_TOO_LOW');
    expect(contrastRatio(r.body.suggestion, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(accessibleOnWhiteText('#2563EB')).toBe('#2563EB'); // already accessible → unchanged
    expect((await env.admin.put('/admin/settings/branding', { data: { primary: '#0F766E' } })).status).toBe(200);
  });

  it('TC-011 / TC-012 / TC-013 FR-004 solo allows one user; team → solo blocked; switched-off modules answer MODULE_DISABLED', async () => {
    const env = await setup();
    expect((await env.admin.post('/admin/users', { username: 'priya', fullName: 'Priya S', role: 'sales_exec' })).body.code).toBe('SOLO_ONE_USER');
    await env.admin.put('/admin/mode', { mode: 'team' });
    await env.createUser('priya', 'sales_exec');
    expect((await env.admin.put('/admin/mode', { mode: 'solo' })).body.code).toBe('SOLO_ONE_USER');
    expect((await env.admin.get('/orders')).body.code).toBe('MODULE_DISABLED');
    await env.admin.put('/admin/settings/modules', { data: { orders: true, sheetSync: false, webForm: false } });
    expect((await env.admin.get('/orders')).status).toBe(200);
    expect((await env.admin.get('/admin/sheets')).body.code).toBe('MODULE_DISABLED');
    expect((await request(env.app).post('/api/v1/public/forms/main/submit').send({ name: 'X', phone: '9845012345' })).body.code).toBe('MODULE_DISABLED');
  });

  it('TC-020 / TC-021 / TC-022 FR-006 migrations run once, in order; a failure stops the run and is recorded', async () => {
    const env = await setup();
    const ran: string[] = [];
    const list = [...MIGRATIONS, { id: '003-b', description: 'b', up: async () => void ran.push('003') }, { id: '002-a', description: 'a', up: async () => void ran.push('002') }];
    expect(await runMigrations(env.db, { list })).toEqual({ applied: ['002-a', '003-b'], alreadyApplied: ['001-initial'] });
    expect(ran).toEqual(['002', '003']);
    expect((await runMigrations(env.db, { list })).applied).toEqual([]); // AC3 re-deploy runs nothing
    const bad = [...list, { id: '004-bad', description: 'boom', up: async () => { throw new Error('boom'); } }, { id: '005-next', description: 'n', up: async () => void ran.push('005') }];
    await expect(runMigrations(env.db, { list: bad })).rejects.toThrow('Migration 004-bad failed: boom');
    expect(ran).not.toContain('005');
    expect(env.db.dump('migrations').find((m) => m.id === '004-bad')).toMatchObject({ status: 'failed', error: 'boom' });
  });

  it('TC-052 / TC-053 FR-014 discount limits and "record payments" switch are enforced for Sales Executives', async () => {
    const env = await setup({ mode: 'team' });
    const exec = await env.createUser('exec', 'sales_exec');
    await env.admin.put('/admin/settings/sales', { data: { discountLimits: { sales_exec: 10, sales_manager: 20 } } });
    expect((await env.admin.get('/admin/roles')).body.items.find((r: { id: string }) => r.id === 'sales_exec').discountLimitPct).toBe(10);
    const c = await makeCustomer(exec.agent);
    const q = await exec.agent.post('/quotes', { partyType: 'customer', partyId: c.id, lines: [{ ...LINE, discountPct: 12 }] });
    const s = await exec.agent.post(`/quotes/${q.body.id}/send`, { channel: 'link' });
    expect(s.status).toBe(202); // held for approval (FR-053)
    expect((await exec.agent.get(`/quotes/${q.body.id}`)).body.status).toBe('pending_approval');
    await env.admin.put('/admin/settings/permissions', { data: { execPaymentsEnabled: false } });
    expect((await env.admin.get('/admin/roles')).body.items.find((r: { id: string }) => r.id === 'sales_exec').canRecordPayments).toBe(false);
    expect((await exec.agent.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 100_000, mode: 'cash' })).status).toBe(403);
  });
});

describe('masters & company (FR-017 – FR-024)', () => {
  it('TC-059 / TC-060 FR-017 GSTIN must match the state; an unregistered company issues Bills of Supply, not Tax Invoices', async () => {
    const env = await setup();
    const r = await env.admin.put('/admin/company', { legalName: 'Acme', gstRegistered: true, gstin: '27ABCDE1234F1Z5', stateCode: '29', address: 'Bengaluru' });
    expect(r.body.code).toBe('GSTIN_STATE_MISMATCH');
    const solo = await setup({ gst: false });
    const c = await makeCustomer(solo.admin);
    const inv = await issuedInvoice(solo.admin, c.id, { ...LINE, taxRatePct: 0 });
    expect((await solo.admin.get(`/invoices/${inv.id}`)).body.type).toBe('bill_of_supply');
    const bad = await solo.admin.post('/invoices', { type: 'tax_invoice', orderId: solo.db.dump('salesOrders')[0]!.id });
    expect(bad.body).toMatchObject({ code: 'VALIDATION_FAILED', title: 'Tax invoices need a GST-registered company — use Bill of Supply' });
  });

  it('TC-061 / TC-062 / TC-063 FR-018 UPI ID and IFSC validation; a new default replaces the old one', async () => {
    const env = await setup();
    const bad = await env.admin.post('/admin/masters/upiIds', { name: 'Bad', data: { vpa: 'acme okhdfc', payeeName: 'Acme' } });
    expect(bad.body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(bad.body)).toContain('name@okhdfcbank');
    const two = await env.admin.post('/admin/masters/upiIds', { name: 'Second', data: { vpa: 'acme2@okaxis', payeeName: 'Acme' }, isDefault: true });
    expect(two.status).toBe(201);
    const items = (await env.admin.get('/admin/masters/upiIds')).body.items as { id: string; isDefault: boolean }[];
    expect(items.filter((i) => i.isDefault).map((i) => i.id)).toEqual([two.body.id]);
    expect((await env.admin.post('/admin/masters/bankAccounts', { name: 'HDFC', data: { bankName: 'HDFC Bank', accountNo: '50100123456789', ifsc: 'HDFC1234567' } })).body.code).toBe('VALIDATION_FAILED');
    expect((await env.admin.post('/admin/masters/bankAccounts', { name: 'HDFC', data: { bankName: 'HDFC Bank', accountNo: '50100123456789', ifsc: 'HDFC0001234' } })).status).toBe(201);
  });

  it('TC-064 / TC-065 / TC-066 FR-019 duplicate code rejected; missing HSN/SAC warns; used items can only be deactivated', async () => {
    const env = await setup();
    const item = { name: 'Logo design', key: 'LOGO-1', data: { type: 'service', hsnSac: null, ratePaise: 500_000, taxRatePct: 18 } };
    const first = await env.admin.post('/admin/masters/products', item);
    expect(first.status).toBe(201);
    expect(first.body.warnings[0]).toMatch(/HSN\/SAC/);
    expect((await env.admin.post('/admin/masters/products', item)).body.code).toBe('MASTER_KEY_TAKEN');
    const c = await makeCustomer(env.admin);
    await issuedInvoice(env.admin, c.id); // uses m_products_WEB-BASIC
    expect((await env.admin.del('/admin/masters/products/m_products_WEB-BASIC')).body.code).toBe('MASTER_IN_USE');
    expect((await env.admin.post('/admin/masters/products/m_products_WEB-BASIC/deactivate')).status).toBe(200);
  });

  it('TC-067 / TC-068 FR-020 FY lock date refuses earlier documents; UPI payments need a UTR', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    await env.admin.put('/admin/settings/finance', { data: { lockDate: '2026-10-31' } });
    expect((await env.admin.post('/payments', { customerId: c.id, date: '2026-10-30', amount: 100_000, mode: 'cash' })).body.code).toBe('PERIOD_LOCKED');
    expect((await env.admin.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 100_000, mode: 'upi' })).body.code).toBe('REFERENCE_REQUIRED');
  });

  it('TC-069 / TC-070 FR-021 unknown template variables are rejected listing the valid ones; missing values render empty', async () => {
    const env = await setup();
    const r = await env.admin.post('/admin/masters/messageTemplates', { name: 'Bad', data: { channel: 'whatsapp', purpose: 'invoice', body: 'Hi {{name}}, GST {{gst}}' } });
    expect(r.body.code).toBe('TEMPLATE_UNKNOWN_VARIABLE');
    expect(r.body.title).toContain('{{gst}}');
    expect(r.body.allowed).toContain('doc_no');
    expect(renderTemplate('Hi {{name}}, due {{due_date}}', { name: 'Ravi' })).toBe('Hi Ravi, due ');
  });

  it('TC-073 / TC-074 / TC-075 FR-023 import: preview with reasons, commit only valid rows, update existing on request, 5,000-row cap', async () => {
    const env = await setup();
    const rows = Array.from({ length: 100 }, (_, i) => ({ name: `Customer ${i}`, gstin: i < 3 ? '27ABCDE1234F1Z5' : '', stateCode: '29', city: 'Bengaluru', phone: `98450${String(10000 + i)}` }));
    const pv = await env.admin.post('/admin/imports', { kind: 'customers', rows });
    expect(pv.status).toBe(201);
    expect(pv.body).toMatchObject({ rows: 100, valid: 97, failed: 3 });
    expect(pv.body.failures[0]).toMatchObject({ row: 2, field: 'gstin', message: 'GSTIN does not match state' });
    const before = env.db.dump('customers').length;
    expect(before).toBe(0); // nothing created until confirmed
    expect((await env.admin.post(`/admin/imports/${pv.body.importId}/commit`, {})).body).toMatchObject({ created: 97, failed: 0 });
    expect(env.db.dump('customers')).toHaveLength(97);
    expect((await env.admin.post(`/admin/imports/${pv.body.importId}/commit`, {})).status).toBe(412); // not twice (VERSION_CONFLICT)

    const prod = (rate: number) => [{ code: 'WEB-BASIC', name: 'Website – Basic (5 pages)', type: 'service', hsnSac: '998314', rate, taxRatePct: 18 }];
    const skip = await env.admin.post('/admin/imports', { kind: 'products', rows: prod(30_000) });
    expect(skip.body.duplicatesExisting).toBe(1);
    expect((await env.admin.post(`/admin/imports/${skip.body.importId}/commit`, { updateExisting: false })).body).toMatchObject({ skipped: 1 });
    const upd = await env.admin.post('/admin/imports', { kind: 'products', rows: prod(30_000) });
    expect((await env.admin.post(`/admin/imports/${upd.body.importId}/commit`, { updateExisting: true })).body).toMatchObject({ updated: 1 });
    expect((env.db.dump('masters').find((m) => m.key === 'WEB-BASIC')!.data as { ratePaise: number }).ratePaise).toBe(3_000_000);

    const big = await env.admin.post('/admin/imports', { kind: 'products', rows: Array.from({ length: 5001 }, () => ({})) });
    expect(big.body).toMatchObject({ code: 'IMPORT_TOO_LARGE', title: 'Split into files of up to 5,000 rows.' });
  });

  it('TC-076 FR-024 a deactivated tax rate is not offered for new lines but old documents still show it', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const inv = await issuedInvoice(env.admin, c.id, { ...LINE, taxRatePct: 12 });
    const rates = (await env.admin.get('/admin/masters/taxRates')).body.items as { id: string; data: { ratePct: number } }[];
    const twelve = rates.find((r) => r.data.ratePct === 12)!;
    await env.admin.post(`/admin/masters/taxRates/${twelve.id}/deactivate`);
    const opts = (await env.admin.get('/masters/taxRates/options')).body.items as { id: string }[];
    expect(opts.map((o) => o.id)).not.toContain(twelve.id);
    expect((await env.admin.get(`/invoices/${inv.id}`)).body.lines[0].taxRatePct).toBe(12);
  });
});

describe('leads, sync, sales documents (FR-026, FR-034, FR-039, FR-063, FR-072)', () => {
  it('TC-080 / TC-081 FR-026 CSV import merges duplicates of existing leads and within the file', async () => {
    const env = await setup();
    await env.admin.post('/leads', { name: 'Existing', phone: '9845011111' });
    const r = await env.admin.post('/leads/import', { rows: [
      { name: 'Dup A', phone: '9845011111' }, { name: 'Dup B', phone: '+91 98450 11111' },
      { name: 'New 1', phone: '9845022222' }, { name: 'New 1 again', phone: '9845022222' },
    ] });
    expect(r.body).toMatchObject({ created: 1, merged: 3 });
    expect(env.db.dump('leads').filter((l) => l.stage !== 'merged')).toHaveLength(2);
  });

  it('TC-102 / TC-103 / TC-104 FR-034 saved filters persist; "Lost" needs a reason; lists are paginated', async () => {
    const env = await setup();
    await env.admin.put('/me/saved-filters', { items: [{ name: 'My hot leads', query: 'stage=interested&ownerId=me' }] });
    expect((await env.admin.get('/me/saved-filters')).body.items[0].name).toBe('My hot leads');
    const l = await env.admin.post('/leads', { name: 'Ravi', phone: '9845012345' });
    expect((await env.admin.post(`/leads/${l.body.lead.id}/stage`, { stage: 'lost' })).body.code).toBe('LOST_REASON_REQUIRED');
    for (let i = 0; i < 3; i++) await env.admin.post('/leads', { name: `L${i}`, phone: `984502000${i}` });
    const p1 = await env.admin.get('/leads?limit=2');
    expect(p1.body.items).toHaveLength(2);
    expect(p1.body.nextCursor).toBeTruthy();
    expect((await env.admin.get(`/leads?limit=2&cursor=${encodeURIComponent(p1.body.nextCursor)}`)).body.items).toHaveLength(2);
    expect((await env.admin.get('/leads/board')).status).toBe(200);
  });

  it('TC-114 / TC-115 / TC-116 FR-039 webhook imports at once; polling every 4 min; webhook mode keeps a 15-min safety poll', async () => {
    const env = await setup();
    await env.google.exchange('code');
    env.google.sheets.set('sheet-hook1/Leads', { headers: ['Full Name', 'Phone'], rows: [], editable: true });
    env.google.sheets.set('sheet-poll1/Leads', { headers: ['Full Name', 'Phone'], rows: [], editable: true });
    const hook = await env.admin.post('/admin/sheets', { spreadsheetId: 'sheet-hook1', tab: 'Leads', mapping: { name: 'Full Name', phone: 'Phone' }, mode: 'webhook', backfillDays: 0 });
    const poll = await env.admin.post('/admin/sheets', { spreadsheetId: 'sheet-poll1', tab: 'Leads', mapping: { name: 'Full Name', phone: 'Phone' }, mode: 'poll', pollMinutes: 4, backfillDays: 0 });
    expect([hook.status, poll.status]).toEqual([201, 201]);
    await runJob(env.ctx, 'sheets.poll'); // first run sets nextPollAt per mode
    await env.tasks.drain();
    const syncs = env.db.dump('sheetSyncs');
    const at = (id: string) => (Date.parse(String(syncs.find((s) => s.id === id)!.nextPollAt)) - env.clock.now().getTime()) / 60_000;
    expect(at(poll.body.id)).toBe(4);
    expect(at(hook.body.id)).toBe(15);

    env.google.sheets.get('sheet-hook1/Leads')!.rows.push(['Hook Lead', '9845031111']);
    const cfg = env.db.dump('sheetSyncs').find((s) => s.id === hook.body.id)!;
    const ts = Date.now();
    const sig = createHmac('sha256', unseal(String(cfg.hookSecretSealed))).update(`${cfg.id}.${ts}`).digest('hex');
    expect((await request(env.app).post(`/api/v1/hooks/sheets/${cfg.id}`).set({ ...H, 'X-SS-Signature': sig }).send({ ts })).status).toBe(202);
    await env.tasks.drain();
    expect(env.db.dump('leads').map((l) => l.name)).toContain('Hook Lead');

    env.google.sheets.get('sheet-poll1/Leads')!.rows.push(['Poll Lead', '9845032222']);
    env.clock.t = new Date(env.clock.t.getTime() + 4 * 60_000);
    await runJob(env.ctx, 'sheets.poll');
    await env.tasks.drain();
    expect(env.db.dump('leads').map((l) => l.name)).toContain('Poll Lead');
  });

  it('TC-186 / TC-187 FR-063 proforma → tax invoice: proforma shows "Converted to INV/…" and is not outstanding', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const q = await env.admin.post('/quotes', { partyType: 'customer', partyId: c.id, lines: [LINE] });
    const pf = await env.admin.post('/invoices', { type: 'proforma', quoteId: q.body.id });
    expect(pf.status).toBe(201);
    expect(pf.body.type).toBe('proforma');
    expect((await env.admin.post(`/invoices/${pf.body.id}/issue`).set('If-Match', String(pf.body.version))).status).toBe(200);
    const conv = await env.admin.post(`/invoices/${pf.body.id}/convert`);
    expect(conv.status).toBe(201);
    const inv = await env.admin.get(`/invoices/${conv.body.id}`);
    await env.admin.post(`/invoices/${conv.body.id}/issue`).set('If-Match', String(inv.body.version));
    const after = await env.admin.get(`/invoices/${pf.body.id}`);
    expect(after.body.convertedToId).toBe(conv.body.id);
    const open = (await env.admin.post('/payments/preview', { customerId: c.id, amount: 1 })).body.open as { id: string }[];
    expect(open.map((o) => o.id)).toEqual([conv.body.id]);
  });

  it('TC-214 FR-072 every payment gets a numbered receipt', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    await issuedInvoice(env.admin, c.id);
    const p = await env.admin.post('/payments', { customerId: c.id, date: '2026-11-13', amount: 100_000, mode: 'cash' });
    expect(p.body.receiptNo).toMatch(/^RCPT\/26-27\/0001$/);
    expect((await env.admin.post('/share-links', { documentType: 'receipt', documentId: p.body.id })).status).toBe(201);
  });
});

describe('files, sharing, notifications, privacy (FR-077 – FR-087)', () => {
  it('TC-225 / TC-226 FR-077 documents go to the customer folder; lead files move there on conversion', async () => {
    const env = await setup();
    await env.google.exchange('code');
    const l = await env.admin.post('/leads', { name: 'Ravi Kumar', phone: '9845012345' });
    const s = await env.admin.post('/files/uploads', { recordType: 'lead', recordId: l.body.lead.id, name: 'brief.pdf', mimeType: 'application/pdf', size: 4 });
    const f = await env.admin.put(`/files/uploads/${s.body.sessionId}`, Buffer.from('%PDF')).set('Content-Type', 'application/octet-stream').set('Content-Range', 'bytes 0-3/4');
    expect(f.status).toBe(201);
    const driveId = String(env.db.dump('files').find((x) => x.id === f.body.id)!.ref);
    expect(env.google.files.get(driveId)!.path).toEqual(['Leads', l.body.lead.id]);
    const conv = await env.admin.post(`/leads/${l.body.lead.id}/convert`, { mode: 'new' });
    await env.tasks.drain();
    await moveLeadFilesTask(env.ctx, l.body.lead.id, conv.body.customerId); // idempotent re-run
    const cust = env.db.dump('customers').find((x) => x.id === conv.body.customerId)!;
    expect(env.google.files.get(driveId)!.path).toEqual(['Customers', `${cust.code} – ${cust.displayName}`, 'Documents']);
  });

  it('TC-227 / TC-228 / TC-229 / TC-230 FR-078 size and type limits, record access, resumable upload', async () => {
    const env = await setup({ mode: 'team' });
    const other = await env.createUser('other', 'sales_exec');
    const c = await makeCustomer(env.admin);
    const base = { recordType: 'customer', recordId: c.id, mimeType: 'application/pdf' };
    expect((await env.admin.post('/files/uploads', { ...base, name: 'big.pdf', size: 30 * 1024 * 1024 })).body).toMatchObject({ code: 'FILE_TOO_LARGE', title: 'Files must be 25 MB or smaller.' });
    expect((await env.admin.post('/files/uploads', { ...base, name: 'setup.exe', mimeType: 'application/octet-stream', size: 10 })).body.code).toBe('FILE_TYPE_BLOCKED');
    const s = await env.admin.post('/files/uploads', { ...base, name: 'brief.pdf', size: 8 });
    const put = (range: string, body: string) => env.admin.put(`/files/uploads/${s.body.sessionId}`, Buffer.from(body)).set('Content-Type', 'application/octet-stream').set('Content-Range', range);
    expect((await put('bytes 0-3/8', '%PDF')).status).toBe(308);
    const resume = await put('bytes 0-3/8', '%PDF'); // retry after a drop: server says where to resume
    expect(resume.status).toBe(308);
    expect(resume.headers.range).toBe('bytes=0-3');
    const done = await put('bytes 4-7/8', '-1.7');
    expect(done.status).toBe(201);
    expect((await other.agent.get(`/files/${done.body.id}/content`)).status).toBe(404);
    expect((await env.admin.get(`/files/${done.body.id}/content`)).status).toBe(200);
  });

  it('TC-231 / TC-232 FR-079 revoked links say "no longer active — contact <company>"; a link exposes only its document', async () => {
    const env = await setup();
    const c = await makeCustomer(env.admin);
    const inv = await issuedInvoice(env.admin, c.id);
    const link = await env.admin.post('/share-links', { documentType: 'invoice', documentId: inv.id });
    const tokenPath = new URL(link.body.url).pathname.replace(/^\/s\//, '');
    const ok = await request(env.app).get(`/api/v1/public/s/${tokenPath}`);
    expect(ok.status).toBe(200);
    expect(JSON.stringify(ok.body)).not.toMatch(/ownerId|customerId|createdBy|"lines":\[\{"productId"/);
    await env.admin.patch(`/share-links/${link.body.id}`, { action: 'revoke' });
    const gone = await request(env.app).get(`/api/v1/public/s/${tokenPath}`);
    expect(gone.body).toMatchObject({ code: 'LINK_INACTIVE', title: 'This link is no longer active — contact Acme Interiors.' });
  });

  it('TC-241 / TC-242 / TC-243 FR-082 push respects opt-outs; the in-app item is always created', async () => {
    const env = await setup();
    const send = vi.fn(async () => ({ invalid: [] as string[] }));
    env.ctx.push = { send };
    const TOKEN = 'fcm-device-token-0123456789abcdef';
    expect((await env.admin.post('/me/push-tokens', { token: TOKEN })).status).toBe(201);
    await env.admin.put('/me/notification-prefs', { push: { 'N-007': false } });
    const c = await makeCustomer(env.admin);
    const q = await env.admin.post('/quotes', { partyType: 'customer', partyId: c.id, lines: [LINE] });
    const sent = await env.admin.post(`/quotes/${q.body.id}/send`, { channel: 'link' });
    const token = new URL(sent.body.shareUrl ?? sent.body.url ?? sent.body.link.url).pathname.replace(/^\/s\//, '');
    await request(env.app).get(`/api/v1/public/s/${token}`); // customer opens → N-007
    await env.tasks.drain();
    await tick();
    const n = (await env.admin.get('/notifications')).body.items as { event: string }[];
    expect(n.map((x) => x.event)).toContain('N-007');
    expect(send).not.toHaveBeenCalled();
    // AC1: an allowed event is pushed with a title and deep link (no sensitive data)
    const n7 = env.db.dump('notifications').find((x) => x.event === 'N-007')!;
    await env.admin.put('/me/notification-prefs', { push: {} });
    await pushSendTask(env.ctx, n7.id);
    expect(send).toHaveBeenCalledWith([TOKEN], { title: n7.title, link: n7.link });
  });

  it('TC-253 FR-087 personal-data export lists every record for a phone and is audited', async () => {
    const env = await setup();
    await env.admin.post('/leads', { name: 'Ravi Kumar', phone: '9845012345' });
    const f = await env.admin.post('/admin/privacy/find', { phone: '9845012345' });
    expect(f.body.counts.leads).toBe(1);
    const job = await env.admin.post('/admin/privacy/export', { personKey: f.body.personKey });
    expect(job.status).toBe(202);
    let status = '';
    for (let i = 0; i < 50 && status !== 'done'; i++) {
      await tick();
      status = (await env.admin.get(`/jobs/${job.body.jobId}`)).body.status;
    }
    expect(status).toBe('done');
    expect(env.db.dump('auditLog').map((a) => a.action)).toContain('privacy.export');
  });
});

describe('branding on documents (FR-003 AC2)', () => {
  it('TC-008 FR-003 AC2 a new logo is used on new documents; issued documents keep their original logo', async () => {
    const env = await setup();
    const LOGO_A = 'data:image/png;base64,QUFBQQ==';
    const LOGO_B = 'data:image/png;base64,QkJCQg==';
    const company = { legalName: 'Acme Interiors', gstRegistered: true, gstin: '29ABCDE1234F1Z5', stateCode: '29', address: '12 MG Road, Bengaluru' };
    expect((await env.admin.put('/admin/company', { ...company, logoDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' })).body.code).toBe('VALIDATION_FAILED'); // no SVG
    await env.admin.put('/admin/company', { ...company, logoDataUrl: LOGO_A });
    const c = await makeCustomer(env.admin);
    const first = await issuedInvoice(env.admin, c.id);
    await env.admin.put('/admin/company', { ...company, logoDataUrl: LOGO_B });
    const second = await issuedInvoice(env.admin, c.id);
    const html = async (id: string) => (await env.admin.get(`/documents/invoice/${id}/preview`)).text;
    expect(await html(first.id)).toContain(LOGO_A);
    expect(await html(second.id)).toContain(LOGO_B);
    expect(await html(first.id)).not.toContain(LOGO_B);
  });
});
