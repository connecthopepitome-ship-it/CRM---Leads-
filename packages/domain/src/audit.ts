/** Audit masking and diff (RULE-012, LLD-audit). */
export type PiiKind = 'phone' | 'email' | 'name' | 'address' | 'notes' | 'ip';

export function maskValue(kind: PiiKind, v: unknown): unknown {
  if (v === null || v === undefined || v === '') return v;
  const s = String(v);
  switch (kind) {
    case 'phone': {
      if (s.length <= 6) return '*'.repeat(s.length);
      return s.slice(0, 3) + '*'.repeat(s.length - 6) + s.slice(-3);
    }
    case 'email': {
      const [u = '', d = ''] = s.split('@');
      return `${u.slice(0, 1)}***@${d}`;
    }
    case 'name':
      return s.split(/\s+/).filter(Boolean).map((w) => `${w.slice(0, 1)}***`).join(' ');
    case 'ip': {
      const parts = s.split('.');
      return parts.length === 4 ? `${parts.slice(0, 3).join('.')}.x` : s.replace(/:[^:]*$/, ':x');
    }
    default:
      return '[redacted]';
  }
}

/** Field → PII kind for audited entities (schema metadata). */
export const PII_FIELDS: Record<string, PiiKind> = {
  name: 'name', fullName: 'name', displayName: 'name', legalName: 'name', contactName: 'name',
  phone: 'phone', phoneRaw: 'phone', email: 'email', username: 'name',
  address: 'address', line1: 'address', line2: 'address', billTo: 'address', shipTo: 'address',
  notes: 'notes', note: 'notes', comment: 'notes', pan: 'notes',
};

export interface Change {
  field: string;
  before: unknown;
  after: unknown;
}

const IGNORED = new Set(['version', 'updatedAt', 'searchTokens', 'createdAt']);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function truncate(v: unknown): unknown {
  return typeof v === 'string' && v.length > 200 ? `${v.slice(0, 200)}…` : v;
}

/** Field-level diff with nested maps flattened as a.b, arrays summarised, PII masked, capped at `max`. */
export function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null, max = 50, prefix = ''): Change[] {
  const out: Change[] = [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (IGNORED.has(k)) continue;
    const b = before?.[k];
    const a = after?.[k];
    const path = prefix ? `${prefix}.${k}` : k;
    if (isObj(b) || isObj(a)) {
      if (PII_FIELDS[k]) {
        if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field: path, before: b == null ? b : '[redacted]', after: a == null ? a : '[redacted]' });
      } else out.push(...diff(isObj(b) ? b : null, isObj(a) ? a : null, max, path));
    } else if (Array.isArray(a) || Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        out.push({ field: path, before: Array.isArray(b) ? `${b.length} items` : b, after: Array.isArray(a) ? `${a.length} items` : a });
      }
    } else if (a !== b) {
      const kind = PII_FIELDS[k];
      out.push({ field: path, before: truncate(kind ? maskValue(kind, b) : b), after: truncate(kind ? maskValue(kind, a) : a) });
    }
    if (out.length >= max) return out.slice(0, max);
  }
  return out;
}
