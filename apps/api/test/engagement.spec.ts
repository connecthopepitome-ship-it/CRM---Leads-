import { describe, expect, it } from 'vitest';
import { runJob } from '../src/jobs.js';
import { setup, uid } from './helpers.js';

describe('engagement (FR-044 – FR-050, FR-081)', () => {
  it('TC-128 / TC-130 / TC-132 FR-044, FR-045 call outcome stops SLA; 3 × No answer → Unreachable + follow-up', async () => {
    const env = await setup();
    const l = await env.admin.post('/leads', { name: 'Caller', phone: '9811112222' });
    const id = l.body.lead.id;
    let last;
    for (let i = 0; i < 3; i++) {
      const a = await env.admin.post('/activities', { clientId: uid(), recordType: 'lead', recordId: id, type: 'call', status: 'pending' });
      expect(a.status).toBe(201);
      last = await env.admin.post(`/activities/${a.body.id}/outcome`, { outcomeId: 'm_callOutcomes_no_answer' });
    }
    expect(last!.body.effects).toMatchObject({ streak: 3, tagsAdded: ['unreachable'] });
    expect(last!.body.effects.followUpId).toBeTruthy();
    const lead = await env.admin.get(`/leads/${id}`);
    expect(lead.body).toMatchObject({ slaStatus: 'met', tags: ['unreachable'] });
    const a = await env.admin.post('/activities', { clientId: uid(), recordType: 'lead', recordId: id, type: 'call', status: 'pending' });
    const ok = await env.admin.post(`/activities/${a.body.id}/outcome`, { outcomeId: 'm_callOutcomes_connected' });
    expect(ok.body.effects.streak).toBe(0); // TC-133 reset
    expect((await env.admin.get(`/leads/${id}`)).body.stage).toBe('contacted');
  });

  it('TC-147 FR-050 SLA breach job flags the lead and notifies the owner', async () => {
    const env = await setup();
    const l = await env.admin.post('/leads', { name: 'Waiting', phone: '9811113333' });
    env.clock.t = new Date(env.clock.t.getTime() + 16 * 60_000);
    expect(await runJob(env.ctx, 'sla.check')).toBe(1);
    expect((await env.admin.get(`/leads/${l.body.lead.id}`)).body.slaStatus).toBe('breached');
    expect(env.db.dump('notifications').some((n) => n.event === 'N-004')).toBe(true);
  });

  it('TC-143 / TC-144 / TC-146 FR-049 reminders, overdue list, cancel on Lost', async () => {
    const env = await setup();
    const l = await env.admin.post('/leads', { name: 'Follow Me', phone: '9811114444' });
    await env.admin.post('/follow-ups', { recordType: 'lead', recordId: l.body.lead.id, dueAt: '2026-11-13T05:30:00Z', type: 'call' });
    env.clock.t = new Date('2026-11-13T05:31:00Z');
    expect(await runJob(env.ctx, 'followups.remind')).toBe(1);
    expect(await runJob(env.ctx, 'followups.remind')).toBe(0);
    expect((await env.admin.get('/follow-ups?bucket=overdue')).body.items).toHaveLength(1);
    await env.admin.post(`/leads/${l.body.lead.id}/stage`, { stage: 'junk', reasonId: 'm_junkReasons_spam' });
    expect(env.db.dump('followUps')[0]!.status).toBe('cancelled');
  });

  it('TC-134 / TC-135 FR-046 WhatsApp link with template; invalid phone refused', async () => {
    const env = await setup();
    const l = await env.admin.post('/leads', { name: 'Ravi', phone: '9845012345' });
    const r = await env.admin.post('/messages/whatsapp', { recordType: 'lead', recordId: l.body.lead.id, templateId: 'm_messageTemplates_greeting' });
    expect(r.body.url).toMatch(/^https:\/\/wa\.me\/919845012345\?text=Hi%20Ravi/);
    const bad = await env.admin.post('/leads', { name: 'NoPhone', phone: '12345', email: 'np@x.com' });
    expect((await env.admin.post('/messages/whatsapp', { recordType: 'lead', recordId: bad.body.lead.id, text: 'hi' })).body.code).toBe('PHONE_REQUIRED');
  });

  it('TC-137 / TC-139 / TC-138 FR-047 email: not connected, sent, daily limit', async () => {
    const env = await setup();
    const l = await env.admin.post('/leads', { name: 'Mail', email: 'mail@x.com' });
    const send = () => env.admin.post('/emails', { recordType: 'lead', recordId: l.body.lead.id, to: ['mail@x.com'], subject: 'Hello', html: '<p>Hi</p>' });
    expect((await send()).body.code).toBe('GOOGLE_NOT_CONNECTED');
    await env.google.exchange('code');
    expect((await send()).status).toBe(202);
    await env.tasks.drain();
    expect(env.google.sent).toHaveLength(1);
    expect((await env.admin.get(`/leads/${l.body.lead.id}`)).body.firstContactAt).toBeTruthy();
    env.ctx.cfg.emailDailyLimit = 1;
    expect((await send()).body.code).toBe('EMAIL_DAILY_LIMIT');
  });

  it('TC-238 / TC-239 / TC-240 FR-081 offline outbox: ordered replay, duplicates, kinds not allowed', async () => {
    const env = await setup();
    const l = await env.admin.post('/leads', { name: 'Offline', phone: '9811115555' });
    const callId = uid();
    const items = [
      { clientId: uid(), kind: 'note', payload: { recordType: 'lead', recordId: l.body.lead.id, note: 'Met at site' }, deviceAt: '2026-11-13T04:00:00Z' },
      { clientId: uid(), kind: 'call_outcome', payload: { activityId: callId, recordType: 'lead', recordId: l.body.lead.id, outcomeId: 'm_callOutcomes_connected' } },
      { clientId: uid(), kind: 'invoice', payload: {} },
    ];
    const r = await env.admin.post('/outbox', { items });
    expect(r.body.results.map((x: { status: string }) => x.status)).toEqual(['ok', 'ok', 'rejected']);
    const again = await env.admin.post('/outbox', { items: items.slice(0, 2) });
    expect(again.body.results.map((x: { status: string }) => x.status)).toEqual(['duplicate', 'duplicate']);
  });
});
