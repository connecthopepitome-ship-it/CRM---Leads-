import { displayDate, formatINR, istDate } from '@ss/domain';

export const money = (paise: number | null | undefined) => formatINR(Number(paise ?? 0));

export const date = (d: string | null | undefined) => {
  if (!d) return '—';
  try {
    const s = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return displayDate(s);
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return displayDate(istDate(parsed));
    }
    return s.slice(0, 10);
  } catch {
    return String(d).slice(0, 10) || '—';
  }
};

export function dateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    let s = String(iso).trim();
    if (!s.endsWith('Z') && !s.includes('+')) {
      s = s.includes('T') ? s + 'Z' : s.replace(' ', 'T') + 'Z';
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(iso).slice(0, 16);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(iso).slice(0, 16) || '—';
  }
}

export function relative(iso: string | null | undefined) {
  if (!iso) return '';
  try {
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    const abs = Math.abs(s);
    const f = (n: number, u: string) => `${n} ${u}${n === 1 ? '' : 's'}`;
    const v = abs < 60 ? 'just now' : abs < 3600 ? f(Math.round(abs / 60), 'min') : abs < 86400 ? f(Math.round(abs / 3600), 'hour') : f(Math.round(abs / 86400), 'day');
    return abs < 60 ? v : s >= 0 ? `${v} ago` : `in ${v}`;
  } catch {
    return '';
  }
}

export const today = () => {
  try {
    return istDate(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const label = (s: string | null | undefined) => (s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '');
/** rupees string → paise */
export const toPaise = (v: string | number) => Math.round(Number(String(v).replace(/[₹,\s]/g, '')) * 100) || 0;

export const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  quotation_sent: 'Quotation Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
  junk: 'Junk',
};

export function getStageLabel(stage: string | null | undefined): string {
  if (!stage) return 'New';
  return STAGE_LABELS[stage.toLowerCase()] ?? label(stage);
}

export function formatSla(status?: string | null, dueAt?: string | null): { text: string; tone: 'warning' | 'danger' | 'success' | 'neutral' } {
  if (status === 'met') return { text: 'Met SLA', tone: 'success' };
  if (status === 'breached') return { text: 'Breached SLA', tone: 'danger' };
  if (!dueAt) return { text: status ? label(status) : '—', tone: 'neutral' };

  try {
    const rel = relative(dueAt);
    const isPast = new Date(dueAt).getTime() < Date.now();
    if (isPast) {
      return { text: `Overdue (${rel})`, tone: 'danger' };
    }
    const cleanRel = rel.replace(/^in\s+/, '');
    return { text: `Due in ${cleanRel}`, tone: 'warning' };
  } catch {
    return { text: 'Pending SLA', tone: 'warning' };
  }
}
