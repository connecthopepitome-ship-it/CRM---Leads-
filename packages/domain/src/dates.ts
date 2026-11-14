/** Dates: stored UTC, business dates are IST calendar dates 'YYYY-MM-DD' (RULE-061). */
export const IST_OFFSET_MIN = 330;

export type IsoDate = string; // YYYY-MM-DD

/** IST calendar date of a UTC instant. */
export function istDate(at: Date | number = Date.now()): IsoDate {
  const ms = (typeof at === 'number' ? at : at.getTime()) + IST_OFFSET_MIN * 60_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function parseIsoDate(d: IsoDate): { y: number; m: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Invalid date ${d}`);
  return { y: Number(m[1]), m: Number(m[2]), day: Number(m[3]) };
}

export function addDays(d: IsoDate, days: number): IsoDate {
  const { y, m, day } = parseIsoDate(d);
  return new Date(Date.UTC(y, m - 1, day + days)).toISOString().slice(0, 10);
}

/** Calendar months; clamps to month end (31-01 + 1 month = 28/29-02). */
export function addMonths(d: IsoDate, months: number): IsoDate {
  const { y, m, day } = parseIsoDate(d);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Whole days b − a. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const pa = parseIsoDate(a);
  const pb = parseIsoDate(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.day) - Date.UTC(pa.y, pa.m - 1, pa.day)) / 86_400_000);
}

/** End of an IST day as a UTC instant (validity ends at end of day IST, RULE-029). */
export function endOfIstDay(d: IsoDate): Date {
  const { y, m, day } = parseIsoDate(d);
  return new Date(Date.UTC(y, m - 1, day, 23, 59, 59, 999) - IST_OFFSET_MIN * 60_000);
}

/** DD-MM-YYYY display. */
export function displayDate(d: IsoDate): string {
  const { y, m, day } = parseIsoDate(d);
  return `${String(day).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
}
