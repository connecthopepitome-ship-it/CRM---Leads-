/** Offline outbox (FR-081, RULE-051): notes, call outcomes and follow-ups queued in IndexedDB, replayed in order. */
import { openDB, type IDBPDatabase } from 'idb';
import { api } from './api';
import { uid } from './format';

export interface OutboxItem {
  clientId: string;
  kind: 'note' | 'call_outcome' | 'follow_up';
  payload: Record<string, unknown>;
  deviceAt: string;
  seq: number;
  status: 'pending' | 'failed';
  error?: string;
}

let dbp: Promise<IDBPDatabase> | null = null;
const db = () => (dbp ??= openDB('salesphere', 1, { upgrade: (d) => {
  d.createObjectStore('outbox', { keyPath: 'clientId' });
  d.createObjectStore('cache');
} }));

const listeners = new Set<() => void>();
export const onOutboxChange = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const emit = () => listeners.forEach((f) => f());

export async function enqueue(kind: OutboxItem['kind'], payload: Record<string, unknown>, clientId = uid()) {
  const d = await db();
  await d.put('outbox', { clientId, kind, payload, deviceAt: new Date().toISOString(), seq: Date.now(), status: 'pending' } satisfies OutboxItem);
  emit();
  void flush();
  return clientId;
}

export async function pending(): Promise<OutboxItem[]> {
  const all = (await (await db()).getAll('outbox')) as OutboxItem[];
  return all.sort((a, b) => a.seq - b.seq);
}

let flushing = false;
export async function flush() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const items = (await pending()).filter((i) => i.status === 'pending');
    if (!items.length) return;
    const r = await api<{ results: { clientId: string; status: string; error?: string }[] }>('/outbox', { method: 'POST', body: { items: items.slice(0, 50).map(({ clientId, kind, payload, deviceAt }) => ({ clientId, kind, payload, deviceAt })) } });
    const d = await db();
    for (const res of r.results) {
      if (res.status === 'rejected') {
        const it = (await d.get('outbox', res.clientId)) as OutboxItem | undefined;
        if (it) await d.put('outbox', { ...it, status: 'failed', error: res.error });
      } else await d.delete('outbox', res.clientId);
    }
    emit();
  } catch {
    /* stay queued */
  } finally {
    flushing = false;
  }
}

/** Read-through cache of recently viewed records for offline viewing (last 200). */
export async function cachePut(key: string, value: unknown) {
  const d = await db();
  await d.put('cache', { value, at: Date.now() }, key);
  const keys = await d.getAllKeys('cache');
  if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) await d.delete('cache', k);
}
export async function cacheGet<T>(key: string): Promise<T | null> {
  const v = (await (await db()).get('cache', key)) as { value: T } | undefined;
  return v?.value ?? null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush());
  setInterval(() => void flush(), 30_000);
}
