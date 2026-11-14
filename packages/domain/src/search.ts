/** Search tokens stored on records (array-contains), see LLD-insights §2. */

function wordPrefixes(text: string): string[] {
  const out = new Set<string>();
  for (const w of text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    for (let i = 2; i <= Math.min(w.length, 12); i++) out.add(`w:${w.slice(0, i)}`);
  }
  return [...out];
}

export interface Searchable {
  names?: (string | null | undefined)[];
  phones?: (string | null | undefined)[];
  emails?: (string | null | undefined)[];
  docNumbers?: (string | null | undefined)[];
  codes?: (string | null | undefined)[];
}

export function searchTokens(s: Searchable): string[] {
  const t = new Set<string>();
  for (const n of s.names ?? []) if (n) wordPrefixes(n).forEach((x) => t.add(x));
  for (const p of s.phones ?? []) {
    if (!p) continue;
    const d = p.replace(/\D/g, '');
    if (d.length >= 10) t.add(`p:${d.slice(-10)}`);
    if (d.length >= 4) t.add(`n:${d.slice(-4)}`);
  }
  for (const e of s.emails ?? []) if (e) t.add(`e:${e.toLowerCase()}`);
  for (const dn of s.docNumbers ?? []) {
    if (!dn) continue;
    t.add(`doc:${dn.toLowerCase()}`);
    const last = dn.split('/').pop();
    if (last) t.add(`n:${last.toLowerCase()}`);
  }
  for (const c of s.codes ?? []) if (c) t.add(`doc:${c.toLowerCase()}`);
  return [...t];
}

/** The single token a query maps to (Firestore allows one array-contains). */
export function queryToken(q: string): string | null {
  const s = q.trim();
  if (s.length < 2) return null;
  const digits = s.replace(/[\s+()-]/g, '');
  if (/^\d+$/.test(digits)) {
    if (digits.length >= 10) return `p:${digits.slice(-10)}`;
    return `n:${digits}`;
  }
  if (s.includes('@')) return `e:${s.toLowerCase()}`;
  if (/^[A-Za-z]+[/-]/.test(s) && /\d/.test(s)) return `doc:${s.toLowerCase()}`;
  const w = s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)[0];
  return w ? `w:${w.slice(0, 12)}` : null;
}
