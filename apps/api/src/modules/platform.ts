import { Router } from 'express';
import { z } from 'zod';
import { accessibleOnWhiteText, contrastRatio, validateSeries } from '@ss/domain';
import type { Ctx } from '../context.js';
import { AppError, fail } from '../http/errors.js';
import { authn, info, P, requirePerm } from '../http/pipeline.js';
import { audit, DEFAULT_SERIES, DEFAULT_SETTINGS, DOC_TYPES, getSettings, nowIso, stamp, type DocType } from '../shared/core.js';

export const APP_VERSION = '0.1.0';
const SECTIONS = Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[];

export function platformRoutes(ctx: Ctx): Router {
  const r = Router();

  // API-001 Health
  r.get('/health', async (_req, res) => {
    try {
      await ctx.db.get('platform', 'release');
      res.json({ status: 'ok', version: APP_VERSION, time: nowIso(ctx) });
    } catch {
      res.status(503).json({ status: 'degraded', version: APP_VERSION });
    }
  });

  // API-002 App bootstrap config (public: branding, terminology, mode)
  r.get('/app-config', async (_req, res) => {
    const s = await getSettings(ctx);
    const company = await ctx.db.get('settings_company', 'company');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      appName: s.branding.appName, companyName: company?.tradeName ?? company?.legalName ?? s.branding.appName,
      branding: s.branding, terminology: s.terminology, mode: s.mode.mode, modules: s.modules, version: APP_VERSION,
      vapidPublicKey: ctx.cfg.fcmVapidPublicKey, gstRegistered: !!company?.gstRegistered,
    });
  });

  r.use(['/admin/settings', '/admin/number-series', '/admin/about', '/jobs', '/admin/mode'], authn);

  // API-003 / API-004 Settings sections
  r.get('/admin/settings/:section', requirePerm('settings:read'), async (req, res) => {
    const section = String(req.params.section) as keyof typeof DEFAULT_SETTINGS;
    if (!SECTIONS.includes(section)) fail('NOT_FOUND');
    const s = await getSettings(ctx);
    const doc = await ctx.db.get('settings', section);
    res.setHeader('ETag', String(doc?.version ?? 0));
    res.json({ section, data: s[section], version: Number(doc?.version ?? 0) });
  });
  r.put('/admin/settings/:section', requirePerm('settings:write'), async (req, res) => {
    const section = String(req.params.section) as keyof typeof DEFAULT_SETTINGS;
    if (!SECTIONS.includes(section) || section === 'mode') fail('NOT_FOUND');
    const data = z.record(z.unknown()).parse(req.body?.data ?? req.body);
    if (section === 'branding' && typeof data.primary === 'string') {
      if (!/^#[0-9a-f]{6}$/i.test(data.primary)) fail('VALIDATION_FAILED', 'Colours must be 6-digit hex, e.g. #2563EB');
      if (contrastRatio(data.primary, '#FFFFFF') < 4.5) throw new AppError('CONTRAST_TOO_LOW', undefined, { suggestion: accessibleOnWhiteText(data.primary), ratio: contrastRatio(data.primary, '#FFFFFF') });
    }
    await ctx.db.tx(async (t) => {
      const cur = await t.get('settings', section);
      const ifm = req.header('if-match');
      if (ifm !== undefined && Number(ifm) !== Number(cur?.version ?? 0)) fail('VERSION_CONFLICT');
      const next = { ...(DEFAULT_SETTINGS[section] as object), ...(cur ?? {}), ...data };
      delete (next as Record<string, unknown>).id;
      t.set('settings', section, { ...next, ...stamp(ctx, P(req), Number(cur?.version ?? 0)) });
      audit(ctx, t, info(req), { action: 'settings.update', recordType: 'settings', recordId: section, before: (cur as Record<string, unknown>) ?? {}, after: next as Record<string, unknown> });
    });
    const s = await getSettings(ctx);
    res.json({ section, data: s[section] });
  });

  // API-005 / API-006 Number series (FR-005)
  r.get('/admin/number-series', requirePerm('settings:read'), async (_req, res) => {
    const items = await Promise.all(DOC_TYPES.map(async (d) => ({ docType: d, ...DEFAULT_SERIES[d], ...((await ctx.db.get('numberSeries', d)) ?? {}), id: d })));
    res.json({ items });
  });
  r.put('/admin/number-series/:docType', requirePerm('settings:write'), async (req, res) => {
    const docType = String(req.params.docType) as DocType;
    if (!DOC_TYPES.includes(docType)) fail('NOT_FOUND');
    const body = z.object({ prefix: z.string().min(1).max(10), pad: z.number().int().min(1).max(8), fyReset: z.boolean() }).parse(req.body);
    const err = validateSeries(body);
    if (err) fail(err as 'SERIES_TOO_LONG');
    await ctx.db.tx(async (t) => {
      const cur = await t.get('numberSeries', docType);
      t.set('numberSeries', docType, { ...body, ...stamp(ctx, P(req), Number(cur?.version ?? 0)) });
      audit(ctx, t, info(req), { action: 'number_series.update', recordType: 'numberSeries', recordId: docType, before: (cur as Record<string, unknown>) ?? DEFAULT_SERIES[docType], after: body });
    });
    res.json({ docType, ...body });
  });

  // API-007 About
  r.get('/admin/about', requirePerm('settings:read'), async (_req, res) => {
    const migrations = await ctx.db.all('migrations');
    res.json({ version: APP_VERSION, migrations: migrations.map((m) => ({ id: m.id, appliedAt: m.appliedAt })) });
  });

  // API-008 Job status
  r.get('/jobs/:jobId', async (req, res) => {
    const job = await ctx.db.get('jobs', String(req.params.jobId));
    if (!job || job.userId !== P(req).userId) fail('NOT_FOUND');
    res.json({ id: job!.id, status: job!.status, progress: job!.progress ?? null, result: job!.result ?? null, error: job!.error ?? null });
  });

  // API-009 Switch mode (RULE-002)
  r.put('/admin/mode', requirePerm('settings:write'), async (req, res) => {
    const mode = z.object({ mode: z.enum(['solo', 'team']) }).parse(req.body).mode;
    await ctx.db.tx(async (t) => {
      const active = (await t.query('users', { where: [['status', '==', 'active']], limit: 100 })).items.filter((u) => !u.isSupport);
      if (mode === 'solo' && active.length !== 1) fail('SOLO_ONE_USER');
      const cur = await t.get('settings', 'mode');
      t.set('settings', 'mode', { mode, soloUserId: mode === 'solo' ? active[0]?.id ?? null : null, ...stamp(ctx, P(req), Number(cur?.version ?? 0)) });
      audit(ctx, t, info(req), { action: 'settings.mode', recordType: 'settings', recordId: 'mode', before: { mode: cur?.mode ?? 'solo' }, after: { mode } });
    });
    res.json({ mode });
  });

  return r;
}

/** Async job record (TBL-00J) used by exports and imports. */
export async function createJob(ctx: Ctx, userId: string, kind: string) {
  const id = `job_${Math.random().toString(36).slice(2, 12)}`;
  await ctx.db.tx(async (t) => t.create('jobs', id, { userId, kind, status: 'queued', createdAt: nowIso(ctx), expireAt: new Date(ctx.clock.now().getTime() + 86_400_000).toISOString() }));
  return id;
}
export async function finishJob(ctx: Ctx, id: string, result: Record<string, unknown> | null, error?: string) {
  await ctx.db.tx(async (t) => t.update('jobs', id, { status: error ? 'failed' : 'done', result, error: error ?? null, finishedAt: nowIso(ctx) }));
}
