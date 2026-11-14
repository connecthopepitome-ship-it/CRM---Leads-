import { appendFileSync } from 'node:fs';
import { AlreadyExists, type Db, type Doc, type Page, type Query, type Tx, type Where } from './types.js';

/** In-memory adapter for local dev and tests. Transactions are serialised (stronger than Firestore). */
export class MemoryDb implements Db {
  private data = new Map<string, Map<string, Record<string, unknown>>>();
  private lock: Promise<void> = Promise.resolve();
  /** SS_RECORD_QUERIES=<file>: append each distinct query shape (JSONL) for infra/gen-indexes.mjs. */
  private recordTo = process.env.SS_RECORD_QUERIES ?? null;
  private seen = new Set<string>();
  private record(col: string, q: Query) {
    if (!this.recordTo) return;
    const shape = JSON.stringify({ col, where: (q.where ?? []).map(([f, op]) => [f, op]), orderBy: q.orderBy ?? [] });
    if (this.seen.has(shape)) return;
    this.seen.add(shape);
    appendFileSync(this.recordTo, `${shape}\n`);
  }

  private col(c: string) {
    let m = this.data.get(c);
    if (!m) this.data.set(c, (m = new Map()));
    return m;
  }

  async get<T extends Doc = Doc>(col: string, id: string): Promise<T | null> {
    const d = this.col(col).get(id);
    return d ? (clone({ ...d, id }) as T) : null;
  }

  async query<T extends Doc = Doc>(col: string, q: Query = {}): Promise<Page<T>> {
    this.record(col, q);
    return runQuery<T>([...this.col(col).entries()].map(([id, d]) => ({ ...clone(d), id }) as T), q);
  }

  async all<T extends Doc = Doc>(col: string, q: Query = {}): Promise<T[]> {
    return (await this.query<T>(col, { ...q, limit: 1_000_000 })).items;
  }

  async count(col: string, q: Query = {}) {
    return (await this.all(col, { where: q.where })).length;
  }

  async sum(col: string, field: string, q: Query = {}) {
    return (await this.all(col, { where: q.where })).reduce((a, d) => a + (Number(getPath(d, field)) || 0), 0);
  }

  async tx<T>(fn: (t: Tx) => Promise<T>): Promise<T> {
    let release!: () => void;
    const prev = this.lock;
    this.lock = new Promise<void>((r) => (release = r));
    await prev;
    try {
      const writes: (() => void)[] = [];
      const pending = new Map<string, Record<string, unknown> | null>(); // key col/id → doc or null (deleted)
      const key = (c: string, i: string) => `${c}\u0000${i}`;
      const current = (c: string, i: string) => (pending.has(key(c, i)) ? pending.get(key(c, i)) ?? undefined : this.col(c).get(i));
      const t: Tx = {
        get: async <D extends Doc = Doc>(c: string, i: string) => {
          const d = current(c, i);
          return d ? (clone({ ...d, id: i }) as D) : null;
        },
        query: async <D extends Doc = Doc>(c: string, q: Query = {}) => {
          this.record(c, q);
          const ids = new Set([...this.col(c).keys(), ...[...pending.keys()].filter((k) => k.startsWith(`${c}\u0000`)).map((k) => k.split('\u0000')[1]!)]);
          const docs = [...ids].map((i) => [i, current(c, i)] as const).filter(([, d]) => d).map(([i, d]) => ({ ...clone(d!), id: i }) as D);
          return runQuery<D>(docs, q);
        },
        create: (c, i, d) => {
          if (current(c, i)) throw new AlreadyExists(c, i);
          pending.set(key(c, i), clone(d));
          writes.push(() => this.col(c).set(i, clone(d)));
        },
        set: (c, i, d) => {
          pending.set(key(c, i), clone(d));
          writes.push(() => this.col(c).set(i, clone(d)));
        },
        update: (c, i, p) => {
          const cur = current(c, i);
          if (!cur) throw new Error(`NOT_FOUND ${c}/${i}`);
          const next = applyPatch(cur, p);
          pending.set(key(c, i), next);
          writes.push(() => this.col(c).set(i, clone(next)));
        },
        delete: (c, i) => {
          pending.set(key(c, i), null);
          writes.push(() => this.col(c).delete(i));
        },
      };
      const result = await fn(t);
      for (const w of writes) w();
      return result;
    } finally {
      release();
    }
  }

  /** test helper */
  dump(col: string): Doc[] {
    return [...this.col(col).entries()].map(([id, d]) => ({ ...d, id }) as Doc);
  }
}

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

export function getPath(o: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((a, k) => (a && typeof a === 'object' ? (a as Record<string, unknown>)[k] : undefined), o);
}

function applyPatch(cur: Record<string, unknown>, patch: Record<string, unknown>) {
  const next = clone(cur);
  for (const [k, v] of Object.entries(patch)) {
    const parts = k.split('.');
    let o: Record<string, unknown> = next;
    for (const p of parts.slice(0, -1)) {
      if (typeof o[p] !== 'object' || o[p] === null) o[p] = {};
      o = o[p] as Record<string, unknown>;
    }
    const last = parts[parts.length - 1]!;
    if (v && typeof v === 'object' && '__inc' in (v as object)) o[last] = (Number(o[last]) || 0) + Number((v as { __inc: number }).__inc);
    else if (v && typeof v === 'object' && '__union' in (v as object)) o[last] = [...new Set([...((o[last] as unknown[]) ?? []), ...(v as { __union: unknown[] }).__union])];
    else if (v && typeof v === 'object' && '__remove' in (v as object)) o[last] = ((o[last] as unknown[]) ?? []).filter((x) => !(v as { __remove: unknown[] }).__remove.includes(x));
    else if (v === undefined) delete o[last];
    else o[last] = clone(v);
  }
  return next;
}

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  return (a as number) < (b as number) ? -1 : 1;
}

function matches(d: Record<string, unknown>, [f, op, v]: Where): boolean {
  const x = getPath(d, f);
  switch (op) {
    case '==': return x === v;
    case '!=': return x !== v && x !== undefined;
    case '<': return x !== undefined && x !== null && cmp(x, v) < 0;
    case '<=': return x !== undefined && x !== null && cmp(x, v) <= 0;
    case '>': return x !== undefined && x !== null && cmp(x, v) > 0;
    case '>=': return x !== undefined && x !== null && cmp(x, v) >= 0;
    case 'in': return (v as unknown[]).includes(x);
    case 'array-contains': return Array.isArray(x) && x.includes(v);
    case 'array-contains-any': return Array.isArray(x) && (v as unknown[]).some((y) => x.includes(y));
  }
}

function runQuery<T extends Doc>(docs: T[], q: Query): Page<T> {
  const out = docs.filter((d) => (q.where ?? []).every((w) => matches(d, w)));
  const order = q.orderBy?.length ? q.orderBy : [['id', 'asc'] as [string, 'asc']];
  out.sort((a, b) => {
    for (const [f, dir = 'asc'] of order) {
      const c = cmp(getPath(a, f), getPath(b, f));
      if (c) return dir === 'desc' ? -c : c;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const start = q.cursor ? Number(Buffer.from(q.cursor, 'base64url').toString()) || 0 : 0;
  const limit = q.limit ?? 50;
  const items = out.slice(start, start + limit);
  const next = start + limit < out.length ? Buffer.from(String(start + limit)).toString('base64url') : null;
  return { items, nextCursor: next };
}

/** Field-value helpers understood by both adapters. */
export const FieldOps = {
  inc: (n: number) => ({ __inc: n }),
  union: (...v: unknown[]) => ({ __union: v }),
  remove: (...v: unknown[]) => ({ __remove: v }),
};
