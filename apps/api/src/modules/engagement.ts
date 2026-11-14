import { Router } from 'express';
import { ActivityBody, EmailBody, FollowUpBody, FollowUpPatchBody, OutboxBody, OutcomeBody, WhatsAppBody, scopeOf } from '@ss/contracts';
import { applyOutcome, CONTACT_ACTIVITY_TYPES, istDate, renderTemplate, slaStatus, waLink } from '@ss/domain';
import type { Ctx, Principal } from '../context.js';
import type { Doc, Tx, Where } from '../db/types.js';
import { AppError, fail } from '../http/errors.js';
import { authn, info, P, paging, str } from '../http/pipeline.js';
import { audit, getCompany, getSettings, inScope, newId, notify, nowIso, requireScope, scopeWhere, type ReqInfo } from '../shared/core.js';
import { actor, addActivity, refreshNextFollowUp } from '../shared/records.js';
import { masterItems } from './masters.js';
import { applyStage } from './leads.js';

async function loadRecord(ctx: Ctx, t: Tx | null, recordType: string, recordId: string) {
  return (t ?? ctx.db).get(recordType === 'lead' ? 'leads' : 'customers', recordId);
}

function requireRecord(p: Principal, recordType: string, rec: Doc | null, action: 'read' | 'create' = 'read'): asserts rec is Doc {
  if (!rec) fail('NOT_FOUND');
  const res = recordType === 'lead' ? 'lead' : 'customer';
  // activities: users who can read the record and create activities in that scope (FRD §3.2)
  if (!inScope(p, res, 'read', String(rec!.ownerId))) fail('NOT_FOUND');
  if (action === 'create' && scopeOf(p.role, 'activity', 'create') === 'none') fail('FORBIDDEN');
}

/** First call / WhatsApp / email by a user stops the first-contact SLA (RULE-025, FR-044 AC3). */
function stopSla(ctx: Ctx, t: Tx, lead: Doc, type: string) {
  if (!CONTACT_ACTIVITY_TYPES.includes(type) || lead.firstContactAt) return;
  const now = ctx.clock.now();
  t.update('leads', lead.id, { firstContactAt: now.toISOString(), slaStatus: slaStatus(now, new Date(String(lead.slaDueAt)), now) });
}

export async function createActivityTx(ctx: Ctx, t: Tx, body: ReturnType<typeof ActivityBody.parse>, p: Principal, ri: ReqInfo) {
  if (await t.get('activities', body.clientId)) return { id: body.clientId, duplicate: true };
  const rec = await loadRecord(ctx, t, body.recordType, body.recordId);
  requireRecord(p, body.recordType, rec, 'create');
  const id = addActivity(ctx, t, { id: body.clientId, recordType: body.recordType, recordId: body.recordId, ownerId: String(rec.ownerId), customerId: body.recordType === 'customer' ? body.recordId : (rec.customerId as string) ?? null, type: body.type, status: body.status ?? 'done', note: body.note ?? null, deviceAt: body.deviceAt ?? null, ...actor(p) });
  if (body.recordType === 'lead') stopSla(ctx, t, rec, body.type);
  audit(ctx, t, ri, { action: `activity.${body.type}`, recordType: body.recordType, recordId: body.recordId, meta: { activityId: id, status: body.status ?? 'done' } });
  return { id, duplicate: false };
}

export async function createFollowUpTx(ctx: Ctx, t: Tx, body: ReturnType<typeof FollowUpBody.parse>, p: Principal, ri: ReqInfo) {
  const id = body.clientId ?? newId('fu_');
  if (await t.get('followUps', id)) return { id, duplicate: true };
  const rec = await loadRecord(ctx, t, body.recordType, body.recordId);
  requireRecord(p, body.recordType, rec, 'create');
  t.create('followUps', id, { recordType: body.recordType, recordId: body.recordId, recordName: rec.name ?? rec.displayName, ownerId: rec.ownerId, dueAt: body.dueAt, type: body.type, note: body.note ?? null, status: 'open', remindedAt: null, createdBy: p.userId, createdAt: nowIso(ctx), version: 1 });
  await refreshNextFollowUp(t, body.recordType, body.recordId, { dueAt: body.dueAt });
  audit(ctx, t, ri, { action: 'followup.create', recordType: body.recordType, recordId: body.recordId, meta: { followUpId: id, dueAt: body.dueAt, type: body.type } });
  return { id, duplicate: false };
}

export async function recordOutcomeTx(ctx: Ctx, t: Tx, activityId: string, body: ReturnType<typeof OutcomeBody.parse>, p: Principal, ri: ReqInfo) {
  const a = await t.get('activities', activityId);
  if (!a) fail('NOT_FOUND');
  const rec = await loadRecord(ctx, t, String(a!.recordType), String(a!.recordId));
  requireRecord(p, String(a!.recordType), rec, 'create');
  const outcome = await t.get('masters', body.outcomeId);
  const code = String((outcome?.data as { code?: string } | undefined)?.code ?? outcome?.key ?? body.outcomeId);
  const settings = await getSettings(ctx, t);
  const outcomes = await masterItems(ctx, 'callOutcomes');
  const rules = outcomes.map((o) => ({ outcomeId: String((o.data as { code?: string }).code ?? o.key), stage: ((o.data as { autoStage?: string }).autoStage ?? undefined) || undefined, followUpDays: (o.data as { autoFollowUpDays?: number }).autoFollowUpDays ?? undefined }));
  const prev = Number(rec.noAnswerStreak ?? 0);
  const eff = applyOutcome(prev, code, rules, settings.outcomes.streak);
  t.update('activities', activityId, { status: 'done', outcomeId: body.outcomeId, outcomeLabel: outcome?.name ?? code, note: body.note ?? a!.note ?? null });
  let followUpId: string | null = null;
  if (a!.recordType === 'lead') {
    const patch: Record<string, unknown> = { noAnswerStreak: eff.streak };
    if (eff.tagsAdded.length) patch.tags = [...new Set([...((rec.tags as string[]) ?? []), ...eff.tagsAdded])];
    t.update('leads', rec.id, patch);
    stopSla(ctx, t, rec, 'call');
    const order = ['new', 'contacted', 'interested', 'quotation_sent', 'negotiation'];
    if (eff.stage && order.indexOf(String(rec.stage)) > -1 && order.indexOf(eff.stage) > order.indexOf(String(rec.stage))) await applyStage(ctx, t, { ...rec, ...patch }, eff.stage, null, p, { auto: true });
  }
  const fuDue = body.followUp?.dueAt ?? (eff.followUpDays ? new Date(ctx.clock.now().getTime() + eff.followUpDays * 86_400_000).toISOString() : null);
  if (fuDue) {
    followUpId = newId('fu_');
    t.create('followUps', followUpId, { recordType: a!.recordType, recordId: a!.recordId, recordName: rec.name ?? rec.displayName, ownerId: rec.ownerId, dueAt: fuDue, type: body.followUp?.type ?? 'call', note: body.note ?? null, status: 'open', remindedAt: null, createdBy: p.userId, createdAt: nowIso(ctx), version: 1 });
    await refreshNextFollowUp(t, String(a!.recordType), String(a!.recordId), { dueAt: fuDue });
  }
  audit(ctx, t, ri, { action: 'call.outcome', recordType: String(a!.recordType), recordId: String(a!.recordId), meta: { activityId, outcome: code, streak: eff.streak } });
  return { activity: { id: activityId, type: 'call', outcome: outcome?.name ?? code, status: 'done' }, effects: { streak: eff.streak, tagsAdded: eff.tagsAdded, followUpId, stage: eff.stage } };
}

export function engagementRoutes(ctx: Ctx): Router {
  const r = Router();
  r.use(['/timeline', '/activities', '/follow-ups', '/messages', '/emails', '/outbox', '/me/email-quota'], authn);

  // API-100 Timeline (FR-035)
  r.get('/timeline/:recordType/:recordId', async (req, res) => {
    const p = P(req);
    const recordType = String(req.params.recordType);
    const rec = await loadRecord(ctx, null, recordType, String(req.params.recordId));
    requireRecord(p, recordType, rec);
    const where: Where[] = recordType === 'customer' ? [['customerId', '==', rec.id]] : [['recordId', '==', rec.id]];
    const types = str(req.query.types);
    if (types) where.push(['type', 'in', types.split(',')]);
    res.json(await ctx.db.query('activities', { where, orderBy: [['occurredAt', 'desc']], ...paging(req) }));
  });

  // API-101 Log activity (pending call / WhatsApp opened / note / visit)
  r.post('/activities', async (req, res) => {
    const p = P(req);
    const body = ActivityBody.parse(req.body);
    const out = await ctx.db.tx(async (t) => createActivityTx(ctx, t, body, p, info(req)));
    res.status(out.duplicate ? 200 : 201).json(await ctx.db.get('activities', out.id));
  });

  // API-102 Outcome (FR-044, FR-045)
  r.post('/activities/:id/outcome', async (req, res) => {
    const p = P(req);
    const body = OutcomeBody.parse(req.body);
    res.json(await ctx.db.tx(async (t) => recordOutcomeTx(ctx, t, String(req.params.id), body, p, info(req))));
  });

  // API-103 Follow-ups (FR-049)
  r.get('/follow-ups', async (req, res) => {
    const p = P(req);
    const scope = scopeWhere(p, 'activity');
    if (!scope) fail('FORBIDDEN');
    const bucket = str(req.query.bucket) ?? 'today';
    const now = ctx.clock.now();
    const today = istDate(now);
    const endOfToday = new Date(`${today}T18:29:59.999Z`).toISOString();
    const where: Where[] = [...scope!, ['status', '==', 'open']];
    if (str(req.query.ownerId)) where.push(['ownerId', '==', str(req.query.ownerId)]);
    if (bucket === 'overdue') where.push(['dueAt', '<', now.toISOString()]);
    else if (bucket === 'today') where.push(['dueAt', '>=', now.toISOString()], ['dueAt', '<=', endOfToday]);
    else if (bucket === 'upcoming') where.push(['dueAt', '>', endOfToday]);
    res.json(await ctx.db.query('followUps', { where, orderBy: [['dueAt', 'asc']], ...paging(req) }));
  });
  r.post('/follow-ups', async (req, res) => {
    const p = P(req);
    const body = FollowUpBody.parse(req.body);
    const out = await ctx.db.tx(async (t) => createFollowUpTx(ctx, t, body, p, info(req)));
    res.status(out.duplicate ? 200 : 201).json(await ctx.db.get('followUps', out.id));
  });
  r.patch('/follow-ups/:id', async (req, res) => {
    const p = P(req);
    const body = FollowUpPatchBody.parse(req.body);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const f = await t.get('followUps', id);
      requireScope(p, 'activity', 'update', f);
      if (f.status !== 'open') fail('VALIDATION_FAILED', 'This follow-up is already closed');
      if (body.action === 'reschedule' && !body.dueAt) fail('VALIDATION_FAILED', 'Choose a new date and time');
      const patch = body.action === 'complete' ? { status: 'done', completedAt: nowIso(ctx) } : body.action === 'cancel' ? { status: 'cancelled', completedAt: nowIso(ctx) } : { dueAt: body.dueAt, remindedAt: null };
      t.update('followUps', id, { ...patch, version: Number(f.version ?? 0) + 1 });
      await refreshNextFollowUp(t, String(f.recordType), String(f.recordId), body.action === 'reschedule' ? { dueAt: body.dueAt! } : null);
      audit(ctx, t, info(req), { action: `followup.${body.action}`, recordType: String(f.recordType), recordId: String(f.recordId), meta: { followUpId: id } });
    });
    res.json(await ctx.db.get('followUps', id));
  });

  // API-106 WhatsApp click-to-chat (FR-046)
  r.post('/messages/whatsapp', async (req, res) => {
    const p = P(req);
    const body = WhatsAppBody.parse(req.body);
    const rec = await loadRecord(ctx, null, body.recordType, body.recordId);
    requireRecord(p, body.recordType, rec, 'create');
    let phone = rec.phone as string | null;
    if (body.recordType === 'customer') phone = ((await ctx.db.all('contacts', { where: [['customerId', '==', rec.id]] })).find((c) => c.isPrimary && c.phoneValid) ?? (await ctx.db.all('contacts', { where: [['customerId', '==', rec.id], ['phoneValid', '==', true]] }))[0])?.phone as string | null;
    if (!phone || (body.recordType === 'lead' && !rec.phoneValid)) fail('PHONE_REQUIRED');
    let text = body.text ?? '';
    if (!text && body.templateId) {
      const tpl = await ctx.db.get('masters', body.templateId);
      const company = await getCompany(ctx);
      text = renderTemplate(String((tpl?.data as { body?: string })?.body ?? ''), { name: String(rec.name ?? rec.displayName ?? ''), company: company.tradeName ?? company.legalName, ...body.vars });
    }
    const id = await ctx.db.tx(async (t) => {
      const aid = addActivity(ctx, t, { recordType: body.recordType, recordId: rec.id, ownerId: String(rec.ownerId), customerId: body.recordType === 'customer' ? rec.id : (rec.customerId as string) ?? null, type: 'whatsapp', note: `WhatsApp opened: ${text.slice(0, 200)}`, meta: { templateId: body.templateId ?? null, delivery: 'opened' }, ...actor(p) });
      if (body.recordType === 'lead') stopSla(ctx, t, rec, 'whatsapp');
      audit(ctx, t, info(req), { action: 'whatsapp.open', recordType: body.recordType, recordId: rec.id, meta: { templateId: body.templateId ?? null } });
      return aid;
    });
    res.json({ url: waLink(phone!, text), text, activityId: id });
  });

  // API-107 Email via Gmail (FR-047, RULE-057)
  r.post('/emails', async (req, res) => {
    const p = P(req);
    const body = EmailBody.parse(req.body);
    const rec = await loadRecord(ctx, null, body.recordType, body.recordId);
    requireRecord(p, body.recordType, rec, 'create');
    const conn = await ctx.google.connected().catch(() => null);
    if (!conn || !conn.scopes.some((s) => s.includes('gmail'))) fail('GOOGLE_NOT_CONNECTED');
    let size = 0;
    for (const a of body.attachments ?? []) size += Number((await ctx.db.get('files', a.fileId))?.size ?? 0);
    if (size > 20 * 1024 * 1024) fail('ATTACHMENTS_TOO_LARGE');
    const id = newId('em_');
    await ctx.db.tx(async (t) => {
      const q = (await t.get('engagement', 'emailQuota')) ?? { buckets: {} };
      const now = ctx.clock.now();
      const buckets = Object.fromEntries(Object.entries(q.buckets as Record<string, number>).filter(([h]) => new Date(`${h}:00:00Z`).getTime() > now.getTime() - 86_400_000));
      const used = Object.values(buckets).reduce((s, n) => s + n, 0);
      if (used >= ctx.cfg.emailDailyLimit) fail('EMAIL_DAILY_LIMIT');
      const hour = now.toISOString().slice(0, 13);
      buckets[hour] = (buckets[hour] ?? 0) + 1;
      t.set('engagement', 'emailQuota', { buckets });
      t.create('emails', id, { recordType: body.recordType, recordId: rec.id, userId: p.userId, to: body.to, cc: body.cc ?? [], subject: body.subject, html: body.html, attachments: body.attachments ?? [], status: 'queued', attempts: 0, createdAt: nowIso(ctx) });
      audit(ctx, t, info(req), { action: 'email.queue', recordType: body.recordType, recordId: rec.id, meta: { emailId: id, subject: body.subject } });
    });
    await ctx.tasks.enqueue('email.send', { emailId: id });
    res.status(202).json({ emailId: id, status: 'queued' });
  });
  r.get('/emails/:id', async (req, res) => {
    const e = await ctx.db.get('emails', String(req.params.id));
    if (!e || e.userId !== P(req).userId) fail('NOT_FOUND');
    res.json({ id: e!.id, status: e!.status, error: e!.error ?? null });
  });
  r.post('/emails/:id/retry', async (req, res) => {
    const e = await ctx.db.get('emails', String(req.params.id));
    if (!e || e.userId !== P(req).userId) fail('NOT_FOUND');
    await ctx.db.tx(async (t) => t.update('emails', e!.id, { status: 'queued', attempts: 0, error: null }));
    await ctx.tasks.enqueue('email.send', { emailId: e!.id });
    res.status(202).json({ emailId: e!.id, status: 'queued' });
  });
  r.get('/me/email-quota', async (_req, res) => {
    const q = (await ctx.db.get('engagement', 'emailQuota')) ?? { buckets: {} };
    const since = ctx.clock.now().getTime() - 86_400_000;
    const used = Object.entries(q.buckets as Record<string, number>).filter(([h]) => new Date(`${h}:00:00Z`).getTime() > since).reduce((s, [, n]) => s + n, 0);
    res.json({ used, limit: ctx.cfg.emailDailyLimit });
  });

  // API-109 Offline outbox replay (FR-081, RULE-051)
  r.post('/outbox', async (req, res) => {
    const p = P(req);
    const body = OutboxBody.parse(req.body);
    const results: { clientId: string; status: 'ok' | 'duplicate' | 'rejected'; error?: string }[] = [];
    for (const item of body.items) {
      try {
        if (item.kind === 'note' || item.kind === 'call') {
          const parsed = ActivityBody.parse({ ...item.payload, clientId: item.clientId, type: item.kind === 'note' ? 'note' : 'call', deviceAt: item.deviceAt });
          const out = await ctx.db.tx(async (t) => createActivityTx(ctx, t, parsed, p, info(req)));
          results.push({ clientId: item.clientId, status: out.duplicate ? 'duplicate' : 'ok' });
        } else if (item.kind === 'call_outcome') {
          const actId = String(item.payload.activityId ?? '');
          const existing = await ctx.db.get('activities', actId);
          if (!existing) {
            // the pending call itself was created offline in the same batch or earlier — create it first
            const parsed = ActivityBody.parse({ clientId: actId, recordType: item.payload.recordType, recordId: item.payload.recordId, type: 'call', status: 'pending', deviceAt: item.deviceAt });
            await ctx.db.tx(async (t) => createActivityTx(ctx, t, parsed, p, info(req)));
          } else if (existing.status === 'done') {
            results.push({ clientId: item.clientId, status: 'duplicate' });
            continue;
          }
          const ob = OutcomeBody.parse(item.payload);
          await ctx.db.tx(async (t) => recordOutcomeTx(ctx, t, actId, ob, p, info(req)));
          results.push({ clientId: item.clientId, status: 'ok' });
        } else if (item.kind === 'follow_up') {
          const fb = FollowUpBody.parse({ ...item.payload, clientId: item.clientId });
          const out = await ctx.db.tx(async (t) => createFollowUpTx(ctx, t, fb, p, info(req)));
          results.push({ clientId: item.clientId, status: out.duplicate ? 'duplicate' : 'ok' });
        } else {
          results.push({ clientId: item.clientId, status: 'rejected', error: 'OUTBOX_KIND_NOT_ALLOWED' });
        }
      } catch (e) {
        results.push({ clientId: item.clientId, status: 'rejected', error: e instanceof AppError ? e.code : 'VALIDATION_FAILED' });
      }
    }
    res.json({ results });
  });

  return r;
}

// ---------------- jobs ----------------
/** sla.check every minute (FR-050 AC1). */
export async function slaCheckJob(ctx: Ctx) {
  const now = ctx.clock.now().toISOString();
  const due = await ctx.db.all('leads', { where: [['slaStatus', '==', 'pending'], ['slaDueAt', '<=', now]] });
  const settings = await getSettings(ctx);
  for (const l of due) {
    await ctx.db.tx(async (t) => {
      const cur = await t.get('leads', l.id);
      if (!cur || cur.slaStatus !== 'pending' || cur.firstContactAt) return;
      t.update('leads', l.id, { slaStatus: 'breached' });
      const managers = settings.mode.mode === 'team' ? (await t.query('teams', { where: [['memberIds', 'array-contains', String(l.ownerId)]], limit: 10 })).items.map((x) => String(x.managerId)) : [];
      notify(ctx, t, [String(l.ownerId), ...managers], 'N-004', `${l.name} not contacted in ${settings.sla.minutes} min`, `/leads/${l.id}`, [`lead:${l.id}`]);
    });
  }
  return due.length;
}

/** followups.remind every minute (FR-049 AC1). */
export async function followUpReminderJob(ctx: Ctx) {
  const now = ctx.clock.now().toISOString();
  const due = (await ctx.db.all('followUps', { where: [['status', '==', 'open'], ['dueAt', '<=', now]] })).filter((f) => !f.remindedAt);
  for (const f of due) {
    await ctx.db.tx(async (t) => {
      t.update('followUps', f.id, { remindedAt: now });
      notify(ctx, t, [String(f.ownerId)], 'N-003', `Follow up ${f.recordName ?? ''}: ${f.type} now`, `/${f.recordType === 'lead' ? 'leads' : 'customers'}/${f.recordId}`, [`${f.recordType}:${f.recordId}`]);
    });
  }
  return due.length;
}

/** email.send task: 3 attempts, then failed + activity (FR-047 AC4). */
export async function emailSendTask(ctx: Ctx, emailId: string) {
  const e = await ctx.db.get('emails', emailId);
  if (!e || e.status !== 'queued') return;
  const rec = await ctx.db.get(e.recordType === 'lead' ? 'leads' : 'customers', String(e.recordId));
  try {
    const attachments = [];
    for (const a of (e.attachments as { fileId: string }[]) ?? []) {
      const f = await ctx.db.get('files', a.fileId);
      if (!f) continue;
      const { readBlob } = await import('./documents.js');
      attachments.push({ name: String(f.name), mimeType: String(f.mimeType), data: await readBlob(ctx, { storage: String(f.storage), ref: String(f.ref) }) });
    }
    const msgId = await ctx.google.sendEmail({ to: e.to as string[], cc: e.cc as string[], subject: String(e.subject), html: String(e.html), attachments });
    const user = await ctx.db.get('users', String(e.userId));
    await ctx.db.tx(async (t) => {
      t.update('emails', emailId, { status: 'sent', gmailMessageId: msgId, sentAt: nowIso(ctx) });
      if (rec) {
        addActivity(ctx, t, { recordType: e.recordType as 'lead', recordId: rec.id, ownerId: String(rec.ownerId), customerId: e.recordType === 'customer' ? rec.id : (rec.customerId as string) ?? null, type: 'email', note: `Email sent: ${e.subject}`, meta: { emailId }, userId: String(e.userId), userName: String(user?.fullName ?? '') });
        if (e.recordType === 'lead') stopSla(ctx, t, rec, 'email');
      }
    });
  } catch (err) {
    const attempts = Number(e.attempts ?? 0) + 1;
    await ctx.db.tx(async (t) => t.update('emails', emailId, { attempts, status: attempts >= 3 ? 'failed' : 'queued', error: (err as Error).message }));
    if (attempts < 3) await ctx.tasks.enqueue('email.send', { emailId, delaySeconds: attempts === 1 ? 60 : 240 });
    else if (rec) {
      await ctx.db.tx(async (t) => {
        addActivity(ctx, t, { recordType: e.recordType as 'lead', recordId: rec.id, ownerId: String(rec.ownerId), type: 'email', status: 'failed', note: `Email failed: ${e.subject} — Retry from the email`, meta: { emailId }, userId: String(e.userId), userName: '' });
      });
    }
  }
}

