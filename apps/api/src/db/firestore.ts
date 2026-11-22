import { FieldValue, Firestore, Timestamp, type Query as FsQuery, type Transaction } from 'firebase-admin/firestore';
import { AlreadyExists, type Db, type Doc, type Page, type Query, type Tx } from './types.js';

/** Firestore adapter (asia-south1, deny-all client rules; server SDK only). */
export class FirestoreDb implements Db {
  constructor(private fs: Firestore) {
    try {
      this.fs.settings({ ignoreUndefinedProperties: true });
    } catch {
      // ignore if settings already frozen
    }
  }

  async get<T extends Doc = Doc>(col: string, id: string): Promise<T | null> {
    const s = await this.fs.collection(col).doc(id).get();
    return s.exists ? (fromFs({ ...s.data(), id: s.id }) as T) : null;
  }

  async query<T extends Doc = Doc>(col: string, q: Query = {}): Promise<Page<T>> {
    return runFsQuery<T>(this.build(col, q), q, (qq) => qq.get(), this.buildWhereOnly(col, q));
  }

  async all<T extends Doc = Doc>(col: string, q: Query = {}): Promise<T[]> {
    const out: T[] = [];
    let cursor: string | null = null;
    do {
      const page: Page<T> = await this.query<T>(col, { ...q, limit: 500, cursor });
      out.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return out;
  }

  async count(col: string, q: Query = {}) {
    const s = await this.build(col, { where: q.where }).count().get();
    return s.data().count;
  }

  async sum(col: string, field: string, q: Query = {}) {
    const { AggregateField } = await import('firebase-admin/firestore');
    const s = await this.build(col, { where: q.where }).aggregate({ total: AggregateField.sum(field) }).get();
    return Number(s.data().total) || 0;
  }

  private build(col: string, q: Query): FsQuery {
    let ref: FsQuery = this.fs.collection(col);
    for (const [f, op, v] of q.where ?? []) ref = ref.where(f === 'id' ? '__name__' : f, op, v);
    for (const [f, dir = 'asc'] of q.orderBy ?? []) ref = ref.orderBy(f === 'id' ? '__name__' : f, dir);
    return ref;
  }

  private buildWhereOnly(col: string, q: Query): FsQuery {
    let ref: FsQuery = this.fs.collection(col);
    for (const [f, op, v] of q.where ?? []) ref = ref.where(f === 'id' ? '__name__' : f, op, v);
    return ref;
  }

  async tx<T>(fn: (t: Tx) => Promise<T>): Promise<T> {
    return this.fs.runTransaction(async (trx: Transaction) => {
      const ops: ((trx: Transaction) => void)[] = [];
      const created = new Set<string>();
      const pending = new Map<string, Record<string, unknown> | null>();
      const cached = new Map<string, Record<string, unknown>>();
      const key = (c: string, i: string) => `${c}/${i}`;

      const t: Tx = {
        get: async <D extends Doc = Doc>(c: string, i: string) => {
          const k = key(c, i);
          if (pending.has(k)) {
            const p = pending.get(k);
            return p ? (fromFs({ ...p, id: i }) as D) : null;
          }
          const s = await trx.get(this.fs.collection(c).doc(i));
          if (!s.exists) return null;
          const data = fromFs({ ...s.data(), id: s.id }) as D;
          cached.set(k, { ...data });
          return data;
        },
        query: async <D extends Doc = Doc>(c: string, q: Query = {}) => runFsQuery<D>(this.build(c, q), q, (qq) => trx.get(qq), this.buildWhereOnly(c, q)),
        create: (c, i, d) => {
          const k = key(c, i);
          if (created.has(k)) throw new AlreadyExists(c, i);
          created.add(k);
          pending.set(k, { ...d });
          ops.push((x) => x.create(this.fs.collection(c).doc(i), toFs(d)));
        },
        set: (c, i, d) => {
          pending.set(key(c, i), { ...d });
          ops.push((x) => x.set(this.fs.collection(c).doc(i), toFs(d)));
        },
        update: (c, i, p) => {
          const k = key(c, i);
          const current = pending.get(k) ?? cached.get(k);
          if (current) {
            pending.set(k, { ...current, ...p });
          }
          ops.push((x) => x.update(this.fs.collection(c).doc(i), toFs(p) as FirebaseFirestore.DocumentData));
        },
        delete: (c, i) => {
          pending.set(key(c, i), null);
          ops.push((x) => x.delete(this.fs.collection(c).doc(i)));
        },
      };
      const result = await fn(t);
      for (const op of ops) op(trx);
      return result;
    }).catch((e: { code?: number }) => {
      if (e?.code === 6) throw new AlreadyExists('?', '?'); // gRPC ALREADY_EXISTS on create()
      throw e;
    });
  }
}

async function runFsQuery<T extends Doc>(
  ref: FsQuery,
  q: Query,
  exec: (q: FsQuery) => Promise<FirebaseFirestore.QuerySnapshot>,
  fallbackRef?: FsQuery,
): Promise<Page<T>> {
  const limit = q.limit ?? 50;
  let r = ref;
  if (q.cursor) {
    try {
      const values = JSON.parse(Buffer.from(q.cursor, 'base64url').toString()) as unknown[];
      r = r.startAfter(...values);
    } catch {
      // ignore
    }
  }

  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await exec(r.limit(limit + 1));
  } catch (err: any) {
    if ((err?.code === 9 || String(err?.message).includes('index')) && fallbackRef) {
      console.warn(`[Firestore] Composite index missing for query. Gracefully sorting in memory.`);
      snap = await exec(fallbackRef.limit(500));
      let docs = snap.docs.map((d) => fromFs({ ...d.data(), id: d.id }) as T);
      if (q.orderBy && q.orderBy.length > 0) {
        docs.sort((a, b) => {
          for (const [f, dir = 'asc'] of q.orderBy!) {
            const va = (a as any)[f];
            const vb = (b as any)[f];
            if (va === vb) continue;
            const cmp = va > vb ? 1 : -1;
            return dir === 'desc' ? -cmp : cmp;
          }
          return 0;
        });
      }
      return { items: docs.slice(0, limit), nextCursor: null };
    }
    throw err;
  }

  const docs = snap.docs.slice(0, limit);
  const items = docs.map((d) => fromFs({ ...d.data(), id: d.id }) as T);
  let nextCursor: string | null = null;
  const last = docs[docs.length - 1];
  if (snap.docs.length > limit && last) {
    const vals = (q.orderBy ?? []).map(([f]) => (f === 'id' ? last.id : last.get(f)));
    if (!q.orderBy?.length) vals.push(last.id);
    nextCursor = Buffer.from(JSON.stringify(vals.map(toFsValue))).toString('base64url');
  }
  return { items, nextCursor };
}

function toFsValue(v: unknown): unknown {
  return v instanceof Timestamp ? v.toDate().toISOString() : v;
}

/** Map our field ops onto Firestore FieldValues and recursively sanitize undefined. */
function toFs(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === 'id') continue;
    if (v === undefined) continue;
    if (v && typeof v === 'object' && '__inc' in v) out[k] = FieldValue.increment((v as { __inc: number }).__inc);
    else if (v && typeof v === 'object' && '__union' in v) out[k] = FieldValue.arrayUnion(...(v as { __union: unknown[] }).__union);
    else if (v && typeof v === 'object' && '__remove' in v) out[k] = FieldValue.arrayRemove(...(v as { __remove: unknown[] }).__remove);
    else if (k === 'expireAt' && typeof v === 'string') out[k] = Timestamp.fromDate(new Date(v));
    else if (Array.isArray(v)) out[k] = v.map((item) => (item && typeof item === 'object' ? cleanUndefined(item) : (item === undefined ? null : item)));
    else if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof Timestamp)) out[k] = cleanUndefined(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

function cleanUndefined(obj: any): any {
  if (Array.isArray(obj)) return obj.map((item) => (item === undefined ? null : cleanUndefined(item)));
  if (obj && typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof Timestamp)) {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) res[k] = cleanUndefined(v);
    }
    return res;
  }
  return obj;
}

function fromFs(o: Record<string, unknown>): Record<string, unknown> {
  for (const [k, v] of Object.entries(o)) if (v instanceof Timestamp) o[k] = v.toDate().toISOString();
  return o;
}
