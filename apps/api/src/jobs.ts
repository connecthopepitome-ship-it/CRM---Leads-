import type { Ctx } from './context.js';
import { followUpReminderJob, slaCheckJob } from './modules/engagement.js';
import { pollSheetsJob } from './modules/google.js';
import { expireSupportAccess } from './modules/identity.js';
import { retentionPurgeJob } from './modules/privacy.js';
import { expireQuotes } from './modules/sales.js';
import { nowIso } from './shared/core.js';

/** Scheduler ticks (Cloud Scheduler → Pub/Sub → `jobs` function). A lease doc per tick avoids double runs. */
export const SCHEDULE = {
  minute: ['sla.check', 'followups.remind', 'sheets.poll', 'support.expire'],
  daily_0005: ['quotes.expire'],
  daily_0200: ['retention.purge'],
} as const;

async function lease(ctx: Ctx, key: string, seconds: number) {
  return ctx.db.tx(async (t) => {
    const cur = await t.get('jobLeases', key);
    if (cur && new Date(String(cur.until)) > ctx.clock.now()) return false;
    t.set('jobLeases', key, { until: new Date(ctx.clock.now().getTime() + seconds * 1000).toISOString(), at: nowIso(ctx) });
    return true;
  });
}

export async function runTick(ctx: Ctx, tick: keyof typeof SCHEDULE) {
  const results: Record<string, number | string> = {};
  for (const job of SCHEDULE[tick]) {
    if (!(await lease(ctx, `${job}`, tick === 'minute' ? 50 : 3600))) {
      results[job] = 'skipped';
      continue;
    }
    try {
      results[job] = await runJob(ctx, job);
    } catch (e) {
      results[job] = `error: ${(e as Error).message}`;
      ctx.log.error({ job, err: (e as Error).message }, 'job failed');
    }
  }
  return results;
}

export async function runJob(ctx: Ctx, job: string): Promise<number> {
  switch (job) {
    case 'sla.check': return slaCheckJob(ctx);
    case 'followups.remind': return followUpReminderJob(ctx);
    case 'sheets.poll': return pollSheetsJob(ctx);
    case 'support.expire': await expireSupportAccess(ctx); return 0;
    case 'quotes.expire': return expireQuotes(ctx);
    case 'retention.purge': return retentionPurgeJob(ctx);
    default: return 0;
  }
}
