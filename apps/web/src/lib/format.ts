import { displayDate, formatINR, istDate } from '@ss/domain';

export const money = (paise: number | null | undefined) => formatINR(Number(paise ?? 0));
export const date = (d: string | null | undefined) => (d ? displayDate(d.length > 10 ? istDate(new Date(d)) : d) : '—');
export function dateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  const t = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${displayDate(istDate(d))} ${t}`;
}
export function relative(iso: string | null | undefined) {
  if (!iso) return '';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const abs = Math.abs(s);
  const f = (n: number, u: string) => `${n} ${u}${n === 1 ? '' : 's'}`;
  const v = abs < 60 ? 'just now' : abs < 3600 ? f(Math.round(abs / 60), 'min') : abs < 86400 ? f(Math.round(abs / 3600), 'hour') : f(Math.round(abs / 86400), 'day');
  return abs < 60 ? v : s >= 0 ? `${v} ago` : `in ${v}`;
}
export const today = () => istDate(new Date());
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const label = (s: string | null | undefined) => (s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '');
/** rupees string → paise */
export const toPaise = (v: string | number) => Math.round(Number(String(v).replace(/[₹,\s]/g, '')) * 100) || 0;
