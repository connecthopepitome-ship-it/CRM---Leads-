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
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 16);
    const t = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    return `${displayDate(istDate(d))} ${t}`;
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
