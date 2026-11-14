import { IST_OFFSET_MIN } from './dates.js';
import { waDigits } from './phone.js';

// ---- First-contact SLA (RULE-025) ----
export interface BusinessCalendar {
  days: number[]; // ISO weekday 1 = Monday … 7 = Sunday
  start: string; // "09:00" IST
  end: string; // "19:00" IST
}
export const DEFAULT_CALENDAR: BusinessCalendar = { days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '19:00' };

const toMin = (hhmm: string) => {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
};

/** Adds business minutes to a UTC instant, counting only working hours in IST. */
export function addBusinessMinutes(startUtc: Date, minutes: number, cal: BusinessCalendar = DEFAULT_CALENDAR): Date {
  const off = IST_OFFSET_MIN * 60_000;
  let local = new Date(startUtc.getTime() + off); // "IST wall clock" in UTC fields
  let remaining = minutes;
  const s = toMin(cal.start);
  const e = toMin(cal.end);
  for (let guard = 0; guard < 400; guard++) {
    const dow = ((local.getUTCDay() + 6) % 7) + 1;
    const minOfDay = local.getUTCHours() * 60 + local.getUTCMinutes() + local.getUTCSeconds() / 60;
    const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    if (!cal.days.includes(dow) || minOfDay >= e) {
      local = new Date(dayStart + 86_400_000 + s * 60_000);
      continue;
    }
    if (minOfDay < s) local = new Date(dayStart + s * 60_000);
    const cur = local.getUTCHours() * 60 + local.getUTCMinutes() + local.getUTCSeconds() / 60;
    const avail = e - cur;
    if (remaining <= avail) return new Date(local.getTime() + remaining * 60_000 - off);
    remaining -= avail;
    local = new Date(dayStart + 86_400_000 + s * 60_000);
  }
  throw new Error('Calendar has no working time');
}

export function slaStatus(now: Date, dueAt: Date, firstContactAt: Date | null): 'pending' | 'met' | 'breached' {
  if (firstContactAt) return firstContactAt <= dueAt ? 'met' : 'breached';
  return now > dueAt ? 'breached' : 'pending';
}

export const CONTACT_ACTIVITY_TYPES = ['call', 'whatsapp', 'email'];

// ---- Call outcome rules (RULE-026) ----
export interface OutcomeRule {
  outcomeId: string;
  stage?: string;
  followUpDays?: number;
}
export interface StreakRule {
  count: number;
  tag: string;
  followUpDays: number;
}
export interface OutcomeEffects {
  streak: number;
  stage: string | null;
  followUpDays: number | null;
  tagsAdded: string[];
}
export const NO_ANSWER_CODES = ['no_answer', 'busy'];

export function applyOutcome(prevStreak: number, outcomeCode: string, rules: OutcomeRule[], streakRule: StreakRule | null): OutcomeEffects {
  const streak = NO_ANSWER_CODES.includes(outcomeCode) ? prevStreak + 1 : 0;
  const rule = rules.find((r) => r.outcomeId === outcomeCode);
  const eff: OutcomeEffects = { streak, stage: rule?.stage ?? null, followUpDays: rule?.followUpDays ?? null, tagsAdded: [] };
  if (streakRule && streak > 0 && streak === streakRule.count) {
    eff.tagsAdded.push(streakRule.tag);
    eff.followUpDays = streakRule.followUpDays;
  }
  return eff;
}

// ---- Templates and click-to-chat (FR-046) ----
/** FR-021 AC1 allow-list (LLD-masters §6). */
export const TEMPLATE_VARIABLES = ['name', 'company', 'amount', 'due_date', 'doc_no', 'link', 'pay_link', 'owner_name'] as const;
export function unknownTemplateVariables(tpl: string): string[] {
  const found = [...tpl.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!);
  return [...new Set(found.filter((v) => !(TEMPLATE_VARIABLES as readonly string[]).includes(v)))];
}

export function renderTemplate(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => {
    const v = vars[k];
    return v === null || v === undefined ? '' : String(v);
  });
}

export function waLink(e164: string, text: string): string {
  return `https://wa.me/${waDigits(e164)}?text=${encodeURIComponent(text)}`;
}

export function mapsLink(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
