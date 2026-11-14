import { describe, expect, it } from 'vitest';
import { runSync } from '../src/modules/google.js';
import { setup } from './helpers.js';

async function withSheet(rows: string[][], editable = true) {
  const env = await setup();
  await env.google.exchange('code');
  env.google.sheets.set('sheet1/Leads', { headers: ['Timestamp', 'Full Name', 'Phone', 'Email'], rows, editable });
  const mapping = { name: 'Full Name', phone: 'Phone', email: 'Email' };
  return { env, mapping };
}

describe('Google Sheet sync (FR-037 – FR-043)', () => {
  it('TC-112 / TC-119 mapping must include phone or email; sheet must be editable', async () => {
    const { env } = await withSheet([], false);
    env.google.sheets.set('sheet1-xxxxx/Leads', { headers: ['Full Name', 'Phone'], rows: [], editable: false });
    expect((await env.admin.post('/admin/sheets', { spreadsheetId: 'sheet1-xxxxx', tab: 'Leads', mapping: { name: 'Full Name' } })).body.code).toBe('MAPPING_CONTACT_REQUIRED');
    expect((await env.admin.post('/admin/sheets', { spreadsheetId: 'sheet1-xxxxx', tab: 'Leads', mapping: { name: 'Full Name', phone: 'Phone' } })).body.code).toBe('SHEET_NOT_EDITABLE');
  });

  it('TC-117 / TC-121 / TC-122 rows import once, markers are written, reruns never duplicate', async () => {
    const { env, mapping } = await withSheet([['t', 'Ravi', '9845012345', ''], ['t', 'Anita', '', 'anita@x.com'], ['t', 'Bad Row', '123', '']]);
    env.google.sheets.set('sheet1-abcdef/Leads', env.google.sheets.get('sheet1/Leads')!);
    const c = await env.admin.post('/admin/sheets', { spreadsheetId: 'sheet1-abcdef', tab: 'Leads', mapping, backfillDays: 0 });
    expect(c.status).toBe(201);
    const [r1, r2] = await Promise.all([runSync(env.ctx, c.body.id, 'webhook'), runSync(env.ctx, c.body.id, 'poll')]);
    const ran = [r1, r2].find((r) => r && 'created' in r) as { created: number; failed: number };
    expect(ran).toMatchObject({ created: 2, failed: 1 });
    expect(env.db.dump('leads')).toHaveLength(2);
    const sheet = env.google.sheets.get('sheet1-abcdef/Leads')!;
    expect(sheet.headers[4]).toBe('CRM Lead ID');
    expect(sheet.rows[0]![4]).toMatch(/^L-/);
    // edit a stamped row → ignored and logged (FR-040 AC2)
    sheet.rows[0]![1] = 'Ravi Changed';
    const r3 = (await runSync(env.ctx, c.body.id, 'poll')) as { created: number; notes: string[] };
    expect(r3.created).toBe(0);
    expect(r3.notes.join(' ')).toContain('changed after import');
    expect(env.db.dump('leads')).toHaveLength(2);
    // error queue: fix and retry (FR-042 AC2)
    const errs = await env.admin.get('/admin/import-errors');
    expect(errs.body.items[0].reason).toBe('No valid phone or email');
    const retry = await env.admin.post(`/admin/import-errors/${errs.body.items[0].id}/retry`, { fields: { phone: '9811119999' } });
    expect(retry.body.outcome).toBe('created');
  });

  it('TC-113 header change marks the mapping for attention and imports nothing', async () => {
    const { env, mapping } = await withSheet([['t', 'Ravi', '9845012345', '']]);
    env.google.sheets.set('sheet1-qwerty/Leads', env.google.sheets.get('sheet1/Leads')!);
    const c = await env.admin.post('/admin/sheets', { spreadsheetId: 'sheet1-qwerty', tab: 'Leads', mapping, backfillDays: 0 });
    env.google.sheets.get('sheet1-qwerty/Leads')!.headers[2] = 'Mobile';
    const r = (await runSync(env.ctx, c.body.id, 'poll')) as { status: string };
    expect(r.status).toBe('mapping_attention');
    expect(env.db.dump('leads')).toHaveLength(0);
  });

  it('TC-123 write-back failure keeps the import; TC-126 auth loss alerts admins', async () => {
    const { env, mapping } = await withSheet([['t', 'Ravi', '9845012345', '']]);
    env.google.sheets.set('sheet1-zxcvbn/Leads', env.google.sheets.get('sheet1/Leads')!);
    const c = await env.admin.post('/admin/sheets', { spreadsheetId: 'sheet1-zxcvbn', tab: 'Leads', mapping, backfillDays: 0 });
    env.google.sheets.get('sheet1-zxcvbn/Leads')!.editable = false;
    const r = (await runSync(env.ctx, c.body.id, 'poll')) as { created: number; writebackFailed: number };
    expect(r).toMatchObject({ created: 1, writebackFailed: 1 });
    // next run must not re-import even though the marker could not be written
    env.google.sheets.get('sheet1-zxcvbn/Leads')!.editable = true;
    const r2 = (await runSync(env.ctx, c.body.id, 'poll')) as { created: number };
    expect(r2.created).toBe(0);
    expect(env.db.dump('leads')).toHaveLength(1);
    env.google.failAuth = true;
    await runSync(env.ctx, c.body.id, 'poll');
    expect((await env.admin.get('/admin/google')).body.status).toBe('lost');
    expect(env.db.dump('notifications').some((n) => n.event === 'N-010')).toBe(true);
  });
});
