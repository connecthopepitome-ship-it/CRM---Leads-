/**
 * API-055 – API-057 Excel/CSV import of masters and opening data (FR-023), LLD-masters §4.1.
 * Rows are parsed in the browser (same as API-082 lead import) and sent as JSON; the server validates
 * every row, stores a preview, and creates/updates only on commit.
 * Kinds: products, customers. (Open leads use API-082; opening invoices — see release notes KI.)
 */
import { Router } from 'express';
import { z } from 'zod';
import { validateGstin } from '@ss/domain';
import type { Ctx } from '../context.js';
import { AppError, fail } from '../http/errors.js';
import { authn, info, P, requirePerm } from '../http/pipeline.js';
import { audit, created, newId, nowIso, stamp } from '../shared/core.js';
import { createCustomerInTx, type CustomerInput } from './customers.js';
import { DATA } from './masters.js';

const MAX_ROWS = 5000;
const Kind = z.enum(['products', 'customers']);
const Upload = z.object({ kind: Kind, rows: z.array(z.record(z.string(), z.unknown())) });
const Commit = z.object({ updateExisting: z.boolean().default(false) });

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
const rupeesToPaise = (v: unknown) => Math.round(Number(String(v).replace(/[₹,\s]/g, '')) * 100);

/** Maps a spreadsheet row to the master/customer input; returns field errors. */
function validateRow(kind: z.infer<typeof Kind>, row: Row): { ok: true; key: string; value: Row } | { ok: false; field: string; message: string } {
  if (kind === 'products') {
    const code = s(row.code);
    const name = s(row.name);
    if (!code) return { ok: false, field: 'code', message: 'Code is required' };
    if (!name) return { ok: false, field: 'name', message: 'Name is required' };
    const data = DATA.products!.safeParse({
      type: s(row.type || 'service').toLowerCase(), hsnSac: s(row.hsnSac) || null, unit: s(row.unit) || 'Nos',
      ratePaise: rupeesToPaise(row.rate ?? 0), taxRatePct: Number(s(row.taxRatePct) || 0), description: s(row.description) || undefined,
    });
    if (!data.success) {
      const issue = data.error.issues[0]!;
      return { ok: false, field: String(issue.path[0] ?? 'hsnSac'), message: issue.message };
    }
    return { ok: true, key: code.toLowerCase(), value: { code, name, data: data.data } };
  }
  const displayName = s(row.name || row.displayName);
  if (!displayName) return { ok: false, field: 'name', message: 'Name is required' };
  const stateCode = s(row.stateCode);
  const gstin = s(row.gstin).toUpperCase() || null;
  return {
    ok: true, key: gstin ?? `${displayName.toLowerCase()}|${s(row.phone)}`,
    value: {
      displayName, type: 'business', gstin,
      billing: s(row.city) && /^\d{2}$/.test(stateCode) ? { line1: s(row.address) || s(row.city), city: s(row.city), stateCode, pincode: s(row.pincode) || null } : null,
      contact: s(row.contactName) || s(row.phone) || s(row.email) ? { name: s(row.contactName) || displayName, phone: s(row.phone) || null, email: s(row.email) || null } : null,
    },
  };
}

export function importsRoutes(ctx: Ctx): Router {
  const r = Router();
  r.use('/admin/imports', authn, requirePerm('settings:write'));

  // API-055 Upload → preview
  r.post('/admin/imports', async (req, res) => {
    const kind = Kind.parse(req.body?.kind);
    if (Array.isArray(req.body?.rows) && req.body.rows.length > MAX_ROWS) fail('IMPORT_TOO_LARGE');
    const body = Upload.parse(req.body);
    const failures: { row: number; field: string; message: string }[] = [];
    const valid: { row: number; key: string; value: Row }[] = [];
    const seen = new Set<string>();
    let duplicatesExisting = 0;
    for (const [i, raw] of body.rows.entries()) {
      const v = validateRow(kind, raw);
      if (!v.ok) {
        failures.push({ row: i + 2, field: v.field, message: v.message });
        continue;
      }
      if (kind === 'customers' && v.value.gstin) {
        const err = validateGstin(String(v.value.gstin), (v.value.billing as { stateCode?: string } | null)?.stateCode ?? null);
        if (err) {
          failures.push({ row: i + 2, field: 'gstin', message: err === 'GSTIN_STATE_MISMATCH' ? 'GSTIN does not match state' : 'Invalid GSTIN' });
          continue;
        }
      }
      if (seen.has(v.key)) {
        failures.push({ row: i + 2, field: kind === 'products' ? 'code' : 'gstin', message: 'Duplicate of an earlier row in this file' });
        continue;
      }
      seen.add(v.key);
      const exists = kind === 'products' ? await ctx.db.get('masterKeys', `products-${v.key}`) : v.value.gstin ? await ctx.db.get('gstinIndex', String(v.value.gstin)) : null;
      if (exists) duplicatesExisting++;
      valid.push({ row: i + 2, key: v.key, value: v.value });
    }
    const id = newId('imp_');
    const preview = { kind, rows: body.rows.length, valid: valid.length, failed: failures.length, failures, duplicatesExisting, status: 'preview' };
    await ctx.db.tx(async (t) => {
      t.create('imports', id, { ...preview, validRows: valid, ...created(ctx, P(req)) });
      audit(ctx, t, info(req), { action: 'import.preview', recordType: 'import', recordId: id, meta: { kind, rows: body.rows.length, valid: valid.length, failed: failures.length } });
    });
    res.status(201).json({ importId: id, ...preview });
  });

  // API-057 Get
  r.get('/admin/imports/:id', async (req, res) => {
    const imp = await ctx.db.get('imports', String(req.params.id));
    if (!imp) fail('NOT_FOUND');
    const { validRows: _v, ...rest } = imp!;
    res.json(rest);
  });

  // API-056 Commit (only valid rows; existing rows updated or skipped per `updateExisting`)
  r.post('/admin/imports/:id/commit', async (req, res) => {
    const p = P(req);
    const { updateExisting } = Commit.parse(req.body ?? {});
    const id = String(req.params.id);
    const imp = await ctx.db.tx(async (t) => {
      const cur = await t.get('imports', id);
      if (!cur) fail('NOT_FOUND');
      if (cur!.status !== 'preview') throw new AppError('VERSION_CONFLICT', 'This import was already committed');
      t.update('imports', id, { status: 'committing' });
      return cur!;
    });
    const result = { created: 0, updated: 0, skipped: 0, failed: 0 };
    for (const r0 of imp.validRows as { key: string; value: Row }[]) {
      try {
        await ctx.db.tx(async (t) => {
          if (imp.kind === 'products') {
            const keyDoc = await t.get('masterKeys', `products-${r0.key}`);
            if (keyDoc) {
              if (!updateExisting) return void result.skipped++;
              const m = await t.get('masters', String(keyDoc.masterId));
              t.update('masters', String(keyDoc.masterId), { name: r0.value.name, data: r0.value.data, ...stamp(ctx, p, Number(m?.version ?? 0)) });
              audit(ctx, t, info(req), { action: 'master.update', recordType: 'products', recordId: String(keyDoc.masterId), after: { name: r0.value.name, via: 'import' } });
              return void result.updated++;
            }
            const mid = newId('m_');
            t.create('masterKeys', `products-${r0.key}`, { masterId: mid });
            t.create('masters', mid, { type: 'products', key: r0.value.code, name: r0.value.name, sortOrder: 100, data: r0.value.data, status: 'active', inUse: false, isDefault: false, ...created(ctx, p) });
            audit(ctx, t, info(req), { action: 'master.create', recordType: 'products', recordId: mid, after: { name: r0.value.name, via: 'import' } });
            return void result.created++;
          }
          const gstin = r0.value.gstin as string | null;
          if (gstin && (await t.get('gstinIndex', gstin))) return void result.skipped++; // customers are never overwritten by import
          await createCustomerInTx(ctx, t, { ...r0.value, ownerId: p.userId } as unknown as CustomerInput, p, info(req));
          result.created++;
        });
      } catch {
        result.failed++;
      }
    }
    await ctx.db.tx(async (t) => {
      t.update('imports', id, { status: 'done', result, committedAt: nowIso(ctx) });
      audit(ctx, t, info(req), { action: 'import.commit', recordType: 'import', recordId: id, meta: { kind: imp.kind, ...result } });
    });
    res.json(result);
  });

  return r;
}
