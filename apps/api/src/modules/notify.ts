import { Router } from 'express';
import { z } from 'zod';
import { NOTIFICATION_EVENTS } from '@ss/contracts';
import type { Ctx } from '../context.js';
import { authn, P, paging } from '../http/pipeline.js';
import { nowIso, sha256 } from '../shared/core.js';

export function notifyRoutes(ctx: Ctx): Router {
  const r = Router();
  r.use(['/notifications', '/me/push-tokens', '/me/notification-prefs'], authn);

  // API-215
  r.get('/notifications', async (req, res) => {
    const p = P(req);
    const where: [string, '==', unknown][] = [['userId', '==', p.userId]];
    if (req.query.unread === '1') where.push(['readAt', '==', null]);
    const page = await ctx.db.query('notifications', { where, orderBy: [['createdAt', 'desc']], ...paging(req) });
    const unreadCount = await ctx.db.count('notifications', { where: [['userId', '==', p.userId], ['readAt', '==', null]] });
    res.json({ ...page, unreadCount });
  });

  // API-216
  r.post('/notifications/read', async (req, res) => {
    const p = P(req);
    const ids = req.body?.all ? (await ctx.db.all('notifications', { where: [['userId', '==', p.userId], ['readAt', '==', null]] })).map((n) => n.id) : ((req.body?.ids as string[]) ?? []);
    await ctx.db.tx(async (t) => {
      for (const id of ids.slice(0, 500)) {
        const n = await t.get('notifications', id);
        if (n && n.userId === p.userId && !n.readAt) t.update('notifications', id, { readAt: nowIso(ctx) });
      }
    });
    res.json({ ok: true });
  });

  // API-217 / 218 push tokens (max 10 per user)
  r.post('/me/push-tokens', async (req, res) => {
    const p = P(req);
    const body = z.object({ token: z.string().min(20).max(4096), platform: z.string().max(40).optional() }).parse(req.body);
    const id = sha256(body.token);
    await ctx.db.tx(async (t) => {
      const mine = (await t.query('pushTokens', { where: [['userId', '==', p.userId]], orderBy: [['createdAt', 'asc']], limit: 50 })).items;
      if (mine.length >= 10) t.delete('pushTokens', mine[0]!.id);
      t.set('pushTokens', id, { userId: p.userId, token: body.token, platform: body.platform ?? 'web', createdAt: nowIso(ctx), lastSuccessAt: null });
    });
    res.status(201).json({ id });
  });
  r.delete('/me/push-tokens/:id', async (req, res) => {
    const p = P(req);
    await ctx.db.tx(async (t) => {
      const tok = await t.get('pushTokens', String(req.params.id));
      if (tok && tok.userId === p.userId) t.delete('pushTokens', tok.id);
    });
    res.status(204).end();
  });

  // API-219 preferences
  r.get('/me/notification-prefs', async (req, res) => {
    const prefs = (await ctx.db.get('notificationPrefs', P(req).userId)) ?? { push: {} };
    res.json({ events: Object.entries(NOTIFICATION_EVENTS).map(([id, label]) => ({ id, label, push: (prefs.push as Record<string, boolean>)[id] !== false })) });
  });
  r.put('/me/notification-prefs', async (req, res) => {
    const body = z.object({ push: z.record(z.boolean()) }).parse(req.body);
    await ctx.db.tx(async (t) => t.set('notificationPrefs', P(req).userId, { push: body.push }));
    res.json(body);
  });

  return r;
}

/** push.send task (FR-082 AC1/AC3): respects preferences, removes stale tokens; payload has no sensitive data. */
export async function pushSendTask(ctx: Ctx, notificationId: string) {
  const n = await ctx.db.get('notifications', notificationId);
  if (!n) return;
  const prefs = (await ctx.db.get('notificationPrefs', String(n.userId))) ?? { push: {} };
  if ((prefs.push as Record<string, boolean>)[String(n.event)] === false) return;
  const tokens = await ctx.db.all('pushTokens', { where: [['userId', '==', String(n.userId)]] });
  if (!tokens.length) return;
  const out = await ctx.push.send(tokens.map((t) => String(t.token)), { title: String(n.title), link: String(n.link) });
  if (out.invalid.length) await ctx.db.tx(async (t) => {
    for (const tok of tokens) if (out.invalid.includes(String(tok.token))) t.delete('pushTokens', tok.id);
  });
}
