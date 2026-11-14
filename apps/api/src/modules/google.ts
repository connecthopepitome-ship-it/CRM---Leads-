import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Ctx } from '../context.js';
import { AppError, fail } from '../http/errors.js';
import { authn, info, P, paging, rateLimit, requirePerm } from '../http/pipeline.js';
import { audit, newId, requireModule, notify, nowIso, seal, sha256, token, unseal, usersWithRole } from '../shared/core.js';
import { GoogleAuthError } from '../shared/google.js';
import { intake, sourceLabel } from './leads.js';
import { masterItems } from './masters.js';

const LEAD_FIELDS = ['name', 'phone', 'email', 'company', 'city', 'pincode', 'notes', 'enquiryAt'] as const;
const SheetSyncBody = z.object({
  spreadsheetId: z.string().min(10).max(200),
  tab: z.string().min(1).max(100),
  headerRow: z.number().int().min(1).max(20).default(1),
  mapping: z.record(z.string()).refine((m) => Object.keys(m).every((k) => (LEAD_FIELDS as readonly string[]).includes(k)), 'Unknown lead field'),
  defaults: z.object({ sourceId: z.string().optional() }).default({}),
  markerColumn: z.string().min(1).max(40).default('CRM Lead ID'),
  mode: z.enum(['webhook', 'poll']).default('poll'),
  pollMinutes: z.number().int().min(1).max(4).default(4),
  writeBack: z.object({ status: z.boolean().default(false), owner: z.boolean().default(false) }).default({}),
  backfillDays: z.number().int().min(0).max(365).default(30),
});

/** FR-038 AC1 */
export function validateMapping(mapping: Record<string, string>, headers: string[]): string | null {
  if (!mapping.phone && !mapping.email) return 'MAPPING_CONTACT_REQUIRED';
  for (const col of Object.values(mapping)) if (col && !headers.includes(col)) return 'VALIDATION_FAILED';
  return null;
}

export function rowValues(headers: string[], row: string[], mapping: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [field, col] of Object.entries(mapping)) {
    const i = headers.indexOf(col);
    if (i >= 0) out[field] = (row[i] ?? '').trim();
  }
  return out;
}
const rowHash = (v: Record<string, string>) => sha256(JSON.stringify(Object.keys(v).sort().map((k) => [k, v[k]])));

/** Exactly-once sync run (FR-039 – FR-042, RULE-024). */
export async function runSync(ctx: Ctx, syncId: string, trigger: 'webhook' | 'poll' | 'manual' | 'safety') {
  const cfg = await ctx.db.get('sheetSyncs', syncId);
  if (!cfg || cfg.deletedAt) return null;
  const now = ctx.clock.now();
  const leaseOk = await ctx.db.tx(async (t) => {
    const lock = await t.get('syncLocks', syncId);
    if (lock && new Date(String(lock.expiresAt)) > now) return false;
    t.set('syncLocks', syncId, { holder: newId('run_'), expiresAt: new Date(now.getTime() + 60_000).toISOString() });
    return true;
  });
  if (!leaseOk) return { skipped: 'already_running' };
  const runId = newId('run_');
  const run = { syncId, trigger, startedAt: now.toISOString(), endedAt: null as string | null, read: 0, created: 0, merged: 0, skipped: 0, failed: 0, writebackFailed: 0, status: 'running', error: null as string | null, notes: [] as string[] };
  const finish = async (status: string, error?: string) => {
    run.status = status;
    run.error = error ?? null;
    run.endedAt = nowIso(ctx);
    const failing = status === 'failed' ? Number(cfg.consecutiveFailures ?? 0) + 1 : 0;
    await ctx.db.tx(async (t) => {
      t.set('syncRuns', runId, { ...run, expireAt: new Date(ctx.clock.now().getTime() + 180 * 86_400_000).toISOString() });
      t.update('sheetSyncs', syncId, { lastRunAt: run.endedAt, lastRunStatus: status, consecutiveFailures: failing, status: status === 'mapping_attention' ? 'mapping_attention' : failing >= 3 ? 'failing' : 'ok', nextPollAt: new Date(ctx.clock.now().getTime() + (cfg.mode === 'webhook' ? 15 : Number(cfg.pollMinutes ?? 4)) * 60_000).toISOString() });
      t.delete('syncLocks', syncId);
      if (run.failed) notify(ctx, t, await usersWithRole(ctx, 'admin'), 'N-011', `${run.failed} sheet rows need attention`, '/settings/google', []);
    });
    return { runId, ...run };
  };
  let sheet;
  try {
    sheet = await ctx.google.readSheet(String(cfg.spreadsheetId), String(cfg.tab), Number(cfg.headerRow ?? 1));
  } catch (e) {
    if (e instanceof GoogleAuthError) await markGoogleLost(ctx, e.message);
    return finish('failed', (e as Error).message);
  }
  const mapping = cfg.mapping as Record<string, string>;
  const snapshot = (cfg.headersSnapshot as string[]) ?? [];
  const mappedCols = Object.values(mapping);
  if (mappedCols.some((c) => !sheet.headers.includes(c)) || snapshot.filter((h) => mappedCols.includes(h)).some((h) => !sheet.headers.includes(h))) {
    await ctx.db.tx(async (t) => notify(ctx, t, await usersWithRole(ctx, 'admin'), 'N-010', 'Sheet mapping needs attention — the header row changed', '/settings/google', []));
    return finish('mapping_attention');
  }
  const markerIdx = sheet.headers.indexOf(String(cfg.markerColumn));
  const markerMissing = markerIdx < 0;
  if (markerMissing) run.notes.push('Marker column missing — using row hash guard; write-back skipped (E-30)');
  const sourceId = String((cfg.defaults as { sourceId?: string })?.sourceId ?? (await masterItems(ctx, 'leadSources')).find((s) => s.key === 'sheet')?.id ?? 'sheet');
  const label = await sourceLabel(ctx, sourceId);
  const updates: { row: number; col: number; value: string }[] = [];
  const statusIdx = sheet.headers.indexOf('CRM Status');
  const ownerIdx = sheet.headers.indexOf('CRM Owner');
  const backfillFrom = cfg.backfillFrom ? String(cfg.backfillFrom) : null;
  for (const [idx, row] of sheet.rows.entries()) {
    if (!row.some((c) => (c ?? '').trim())) continue;
    run.read++;
    const values = rowValues(sheet.headers, row, mapping);
    const hash = rowHash(values);
    const rowNumber = Number(cfg.headerRow ?? 1) + idx + 1;
    const marker = !markerMissing ? (row[markerIdx] ?? '').trim() : '';
    if (marker) {
      const claim = await ctx.db.get('rowClaims', `${syncId}-${rowNumber}`);
      if (claim && claim.hash !== hash) run.notes.push(`Row ${rowNumber} changed after import — ignored`);
      run.skipped++;
      continue;
    }
    if (backfillFrom && values.enquiryAt && !Number.isNaN(Date.parse(values.enquiryAt)) && new Date(values.enquiryAt).toISOString().slice(0, 10) < backfillFrom) {
      run.skipped++;
      continue;
    }
    const existingClaim = await ctx.db.get('rowClaims', `${syncId}-${rowNumber}`);
    if (existingClaim) {
      // imported before but marker write failed — retry the marker only (never re-import)
      if (!markerMissing) updates.push({ row: idx, col: markerIdx, value: String(existingClaim.leadId) });
      run.skipped++;
      continue;
    }
    try {
      const result = await ctx.db.tx(async (t) => {
        t.create('rowClaims', `${syncId}-${rowNumber}`, { hash, claimedAt: nowIso(ctx), leadId: null });
        if (markerMissing) t.create('rowClaims', `${syncId}-h-${hash}`, { claimedAt: nowIso(ctx) });
        const out = await intake(ctx, {
          fields: { name: values.name ?? '', phone: values.phone, email: values.email, company: values.company, city: values.city, pincode: /^\d{6}$/.test(values.pincode ?? '') ? values.pincode : null, notes: values.notes },
          sourceId, sourceLabel: label, consentBasis: 'person_initiated', enquiryAt: values.enquiryAt && !Number.isNaN(Date.parse(values.enquiryAt)) ? new Date(values.enquiryAt).toISOString() : null,
          sheet: { syncId, row: rowNumber, hash },
        }, { principal: null, actorOverride: 'system' }, t);
        t.update('rowClaims', `${syncId}-${rowNumber}`, { leadId: out.leadId });
        return out;
      });
      if (result.outcome === 'created' || result.outcome === 'linked_customer') run.created++;
      else run.merged++;
      if (!markerMissing) {
        updates.push({ row: idx, col: markerIdx, value: result.leadId });
        const lead = (cfg.writeBack as { status?: boolean; owner?: boolean }) ?? {};
        if (lead.status && statusIdx >= 0) updates.push({ row: idx, col: statusIdx, value: 'New' });
        if (lead.owner && ownerIdx >= 0) {
          const l = await ctx.db.get('leads', result.leadId);
          const u = l ? await ctx.db.get('users', String(l.ownerId)) : null;
          updates.push({ row: idx, col: ownerIdx, value: String(u?.fullName ?? '') });
        }
      }
    } catch (e) {
      if (e instanceof AppError) {
        run.failed++;
        await ctx.db.tx(async (t) => {
          t.delete('rowClaims', `${syncId}-${rowNumber}`);
          t.create('importErrors', newId('ie_'), { syncId, runId, rowNumber, rowData: values, reason: e.code === 'LEAD_CONTACT_REQUIRED' ? 'No valid phone or email' : e.code, status: 'open', createdAt: nowIso(ctx) });
        });
      } else if ((e as Error).message?.startsWith('ALREADY_EXISTS')) run.skipped++;
      else throw e;
    }
  }
  if (updates.length && !markerMissing) {
    try {
      await ctx.google.writeCells(String(cfg.spreadsheetId), String(cfg.tab), updates);
    } catch (e) {
      run.writebackFailed = updates.length;
      run.notes.push(`Write-back failed: ${(e as Error).message}`);
    }
  }
  return finish('ok');
}

async function markGoogleLost(ctx: Ctx, error: string) {
  await ctx.db.tx(async (t) => {
    const cur = await t.get('integrations', 'google');
    if (cur?.status === 'lost') return;
    t.set('integrations', 'google', { ...(cur ?? {}), status: 'lost', lastError: error, lastErrorAt: nowIso(ctx) });
    notify(ctx, t, await usersWithRole(ctx, 'admin'), 'N-010', 'Google connection lost — reconnect', '/settings/google', []);
  });
}

/** sheets.poll tick: due syncs (incl. 15-min safety net in webhook mode). */
export async function pollSheetsJob(ctx: Ctx) {
  const now = ctx.clock.now().toISOString();
  const due = (await ctx.db.all('sheetSyncs')).filter((s) => !s.deletedAt && s.status !== 'mapping_attention' && (!s.nextPollAt || String(s.nextPollAt) <= now));
  for (const s of due) await ctx.tasks.enqueue('sheet.sync', { syncId: s.id, trigger: s.mode === 'webhook' ? 'safety' : 'poll' });
  return due.length;
}

export function googleRoutes(ctx: Ctx): Router {
  const r = Router();

  // API-129 Apps Script hook (signed)
  r.post('/hooks/sheets/:id', rateLimit('sheet-hook', 30, (req) => String(req.params.id)), async (req, res) => {
    const cfg = await ctx.db.get('sheetSyncs', String(req.params.id));
    if (!cfg || !cfg.hookSecretSealed) fail('SIGNATURE_INVALID');
    const ts = Number(req.body?.ts ?? 0);
    const sig = String(req.header('x-ss-signature') ?? '');
    const expected = createHmac('sha256', unseal(String(cfg!.hookSecretSealed))).update(`${cfg!.id}.${ts}`).digest('hex');
    if (Math.abs(Date.now() - ts) > 5 * 60_000 || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) fail('SIGNATURE_INVALID');
    await ctx.tasks.enqueue('sheet.sync', { syncId: cfg!.id, trigger: 'webhook' });
    res.status(202).json({ ok: true });
  });

  // API-122 OAuth callback (state-bound)
  r.get('/oauth/google/callback', async (req, res) => {
    const state = String(req.query.state ?? '');
    const st = await ctx.db.get('oauthStates', state);
    if (!st || new Date(String(st.expireAt)) < ctx.clock.now()) fail('OAUTH_STATE_INVALID');
    const conn = await ctx.google.exchange(String(req.query.code ?? ''));
    await ctx.db.tx(async (t) => {
      t.delete('oauthStates', state);
      t.set('integrations', 'google', { status: 'connected', email: conn.email, scopes: conn.scopes, connectedAt: nowIso(ctx), connectedBy: st!.userId, lastError: null, consecutiveFailures: 0 });
      audit(ctx, t, { principal: null, actorOverride: String(st!.userId) }, { action: 'google.connect', recordType: 'integration', recordId: 'google', meta: { scopes: conn.scopes } });
    });
    const syncs = await ctx.db.all('sheetSyncs');
    for (const s of syncs) if (!s.deletedAt) await ctx.tasks.enqueue('sheet.sync', { syncId: s.id, trigger: 'manual' }); // FR-043 AC2 catch-up
    res.redirect(`${ctx.cfg.appOrigin}/settings/google?connected=1`);
  });

  r.use(['/admin/google', '/admin/sheets', '/admin/import-errors'], authn);
  r.use('/admin/sheets', requireModule(ctx, 'sheetSync'));

  // API-120 Status
  r.get('/admin/google', requirePerm('settings:read'), async (_req, res) => {
    const d: Record<string, unknown> = (await ctx.db.get('integrations', 'google')) ?? { status: 'not_connected' };
    const scopes = (d.scopes as string[]) ?? [];
    res.json({ status: d.status, email: d.email ?? null, scopes, features: { drive: scopes.some((s) => s.includes('drive')), gmail: scopes.some((s) => s.includes('gmail')), sheets: scopes.some((s) => s.includes('spreadsheets')) }, lastError: d.lastError ?? null, pickerApiKey: ctx.cfg.googlePickerKey, clientId: ctx.cfg.googleClientId });
  });
  // API-121 Connect
  r.post('/admin/google/connect', requirePerm('settings:write'), async (req, res) => {
    const state = token(24);
    await ctx.db.tx(async (t) => t.create('oauthStates', state, { userId: P(req).userId, expireAt: new Date(ctx.clock.now().getTime() + 10 * 60_000).toISOString() }));
    res.json({ authUrl: ctx.google.authUrl(state) });
  });
  // API-123 Disconnect
  r.post('/admin/google/disconnect', requirePerm('settings:write'), async (req, res) => {
    await ctx.google.disconnect();
    await ctx.db.tx(async (t) => {
      t.set('integrations', 'google', { status: 'not_connected', email: null, scopes: [] });
      audit(ctx, t, info(req), { action: 'google.disconnect', recordType: 'integration', recordId: 'google' });
    });
    res.json({ status: 'not_connected' });
  });
  // API-124 Picker token: the access token is minted by the adapter (short-lived)
  r.get('/admin/google/picker-token', requirePerm('settings:write'), async (_req, res) => {
    const conn = await ctx.google.connected();
    if (!conn) fail('GOOGLE_NOT_CONNECTED');
    res.json({ developerKey: ctx.cfg.googlePickerKey, clientId: ctx.cfg.googleClientId });
  });

  // API-125 Preview
  r.post('/admin/sheets/preview', requirePerm('settings:write'), async (req, res) => {
    const body = z.object({ spreadsheetId: z.string(), tab: z.string(), headerRow: z.number().int().default(1) }).parse(req.body);
    const sheet = await ctx.google.readSheet(body.spreadsheetId, body.tab, body.headerRow);
    res.json({ headers: sheet.headers, rows: sheet.rows.slice(0, 5), canEdit: await ctx.google.canEdit(body.spreadsheetId) });
  });

  // API-126 Create
  r.post('/admin/sheets', requirePerm('settings:write'), async (req, res) => {
    const body = SheetSyncBody.parse(req.body);
    const sheet = await ctx.google.readSheet(body.spreadsheetId, body.tab, body.headerRow);
    const err = validateMapping(body.mapping, sheet.headers);
    if (err) fail(err as 'MAPPING_CONTACT_REQUIRED');
    if (!(await ctx.google.canEdit(body.spreadsheetId))) fail('SHEET_NOT_EDITABLE');
    // the marker column must exist: append it to the header row if missing
    if (!sheet.headers.includes(body.markerColumn)) await ctx.google.writeCells(body.spreadsheetId, body.tab, [{ row: -1, col: sheet.headers.length, value: body.markerColumn }]).catch(() => undefined);
    const id = newId('ss_');
    const hookSecret = token(32);
    const backfillFrom = body.backfillDays ? new Date(ctx.clock.now().getTime() - body.backfillDays * 86_400_000).toISOString().slice(0, 10) : null;
    await ctx.db.tx(async (t) => {
      t.create('sheetSyncs', id, { ...body, headersSnapshot: [...sheet.headers, ...(sheet.headers.includes(body.markerColumn) ? [] : [body.markerColumn])], backfillFrom, hookSecretSealed: seal(hookSecret), status: 'ok', consecutiveFailures: 0, nextPollAt: nowIso(ctx), createdAt: nowIso(ctx), createdBy: P(req).userId, version: 1 });
      audit(ctx, t, info(req), { action: 'sheet_sync.create', recordType: 'sheetSync', recordId: id, meta: { tab: body.tab, mode: body.mode } });
    });
    res.status(201).json({ id, markerColumn: body.markerColumn });
  });
  // API-127 List / update / delete
  r.get('/admin/sheets', requirePerm('settings:read'), async (_req, res) => {
    res.json({ items: (await ctx.db.all('sheetSyncs')).filter((s) => !s.deletedAt).map(({ hookSecretSealed: _h, ...s }) => s) });
  });
  r.patch('/admin/sheets/:id', requirePerm('settings:write'), async (req, res) => {
    const id = String(req.params.id);
    const body = SheetSyncBody.partial().parse(req.body);
    const cur = await ctx.db.get('sheetSyncs', id);
    if (!cur) fail('NOT_FOUND');
    let headersSnapshot = cur!.headersSnapshot;
    if (body.mapping) {
      const sheet = await ctx.google.readSheet(String(cur!.spreadsheetId), String(body.tab ?? cur!.tab), Number(body.headerRow ?? cur!.headerRow));
      const err = validateMapping(body.mapping, sheet.headers);
      if (err) fail(err as 'MAPPING_CONTACT_REQUIRED');
      headersSnapshot = sheet.headers;
    }
    await ctx.db.tx(async (t) => {
      t.update('sheetSyncs', id, { ...body, headersSnapshot, status: 'ok', version: Number(cur!.version ?? 0) + 1 });
      audit(ctx, t, info(req), { action: 'sheet_sync.update', recordType: 'sheetSync', recordId: id, before: { mapping: cur!.mapping }, after: { mapping: body.mapping ?? cur!.mapping } });
    });
    res.json(await ctx.db.get('sheetSyncs', id));
  });
  r.delete('/admin/sheets/:id', requirePerm('settings:write'), async (req, res) => {
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      t.update('sheetSyncs', id, { deletedAt: nowIso(ctx) });
      audit(ctx, t, info(req), { action: 'sheet_sync.delete', recordType: 'sheetSync', recordId: id });
    });
    res.status(204).end();
  });
  // API-128 Sync now
  r.post('/admin/sheets/:id/sync', requirePerm('settings:write'), async (req, res) => {
    const out = await runSync(ctx, String(req.params.id), 'manual');
    if (!out) fail('NOT_FOUND');
    res.status(202).json(out);
  });
  // API-130 Runs
  r.get('/admin/sheets/:id/runs', requirePerm('settings:read'), async (req, res) => {
    res.json(await ctx.db.query('syncRuns', { where: [['syncId', '==', String(req.params.id)]], orderBy: [['startedAt', 'desc']], ...paging(req) }));
  });
  // API-133 Apps Script snippet (rotates the secret)
  r.get('/admin/sheets/:id/apps-script', requirePerm('settings:write'), async (req, res) => {
    const id = String(req.params.id);
    const secret = token(32);
    await ctx.db.tx(async (t) => t.update('sheetSyncs', id, { hookSecretSealed: seal(secret) }));
    const url = `${ctx.cfg.appOrigin}/api/v1/hooks/sheets/${id}`;
    res.json({
      script: `// SaleSphere — paste into Extensions → Apps Script, then add an "On change" trigger for onSheetChange\nconst URL = '${url}';\nconst SECRET = '${secret}';\nfunction onSheetChange() {\n  const ts = Date.now();\n  const raw = Utilities.computeHmacSha256Signature('${id}.' + ts, SECRET);\n  const sig = raw.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');\n  UrlFetchApp.fetch(URL, { method: 'post', contentType: 'application/json', headers: { 'X-SS-Signature': sig }, payload: JSON.stringify({ ts }), muteHttpExceptions: true });\n}\n`,
    });
  });
  // API-131 / 132 Error queue
  r.get('/admin/import-errors', requirePerm('settings:read'), async (req, res) => {
    const where: [string, '==', unknown][] = [['status', '==', String(req.query.status ?? 'open')]];
    if (req.query.syncId) where.push(['syncId', '==', String(req.query.syncId)]);
    res.json(await ctx.db.query('importErrors', { where, orderBy: [['createdAt', 'desc']], ...paging(req) }));
  });
  r.post('/admin/import-errors/:id/retry', requirePerm('settings:write'), async (req, res) => {
    const e = await ctx.db.get('importErrors', String(req.params.id));
    if (!e || e.status !== 'open') fail('NOT_FOUND');
    const fields = { ...(e!.rowData as Record<string, string>), ...((req.body?.fields as Record<string, string>) ?? {}) };
    const cfg = await ctx.db.get('sheetSyncs', String(e!.syncId));
    const sourceId = String((cfg?.defaults as { sourceId?: string })?.sourceId ?? 'sheet');
    const out = await intake(ctx, { fields: { name: fields.name ?? '', phone: fields.phone, email: fields.email, company: fields.company, city: fields.city, notes: fields.notes }, sourceId, sourceLabel: await sourceLabel(ctx, sourceId), consentBasis: 'person_initiated' }, info(req));
    await ctx.db.tx(async (t) => {
      t.update('importErrors', e!.id, { status: 'resolved', resolvedLeadId: out.leadId, resolvedAt: nowIso(ctx) });
      t.set('rowClaims', `${e!.syncId}-${e!.rowNumber}`, { hash: 'manual', leadId: out.leadId, claimedAt: nowIso(ctx) });
      audit(ctx, t, info(req), { action: 'import_error.retry', recordType: 'lead', recordId: out.leadId });
    });
    res.json({ leadId: out.leadId, outcome: out.outcome });
  });
  r.post('/admin/import-errors/:id/dismiss', requirePerm('settings:write'), async (req, res) => {
    await ctx.db.tx(async (t) => {
      t.update('importErrors', String(req.params.id), { status: 'dismissed' });
      audit(ctx, t, info(req), { action: 'import_error.dismiss', recordType: 'importError', recordId: String(req.params.id) });
    });
    res.json({ ok: true });
  });

  return r;
}
