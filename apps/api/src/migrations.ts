/**
 * FR-006 upgrade migrations (HLD §12 "run pending migrations, expand only").
 * - Ordered by id; each runs once (state in `migrations/{id}`), so re-deploying a release runs nothing (AC3).
 * - A failure stops the run and is recorded; the deploy job then stops before shipping code, leaving the
 *   install on its previous version while other client environments proceed independently (AC2).
 * - Migrations must be expand-only (add fields / backfill) so old code keeps working until the deploy finishes.
 */
import type { Db } from './db/types.js';

export interface Migration {
  id: string;
  description: string;
  up(db: Db): Promise<void>;
}

/** Append new migrations at the end; never edit or reorder released ones. */
export const MIGRATIONS: Migration[] = [
  { id: '001-initial', description: 'Initial schema (created by seedInstall)', up: async () => {} },
];

const STALE_MS = 10 * 60_000;

export async function runMigrations(db: Db, opts: { list?: Migration[]; now?: () => Date } = {}): Promise<{ applied: string[]; alreadyApplied: string[] }> {
  const list = [...(opts.list ?? MIGRATIONS)].sort((a, b) => a.id.localeCompare(b.id));
  const now = opts.now ?? (() => new Date());
  const applied: string[] = [];
  const alreadyApplied: string[] = [];
  for (const m of list) {
    const claimed = await db.tx(async (t) => {
      const cur = await t.get('migrations', m.id);
      if (cur && (cur.status === 'done' || (cur.status === undefined && cur.appliedAt))) return false;
      if (cur?.status === 'running' && now().getTime() - Date.parse(String(cur.startedAt)) < STALE_MS) throw new Error(`Migration ${m.id} is already running`);
      t.set('migrations', m.id, { status: 'running', description: m.description, startedAt: now().toISOString() });
      return true;
    });
    if (!claimed) {
      alreadyApplied.push(m.id);
      continue;
    }
    try {
      await m.up(db);
    } catch (e) {
      await db.tx(async (t) => t.set('migrations', m.id, { status: 'failed', description: m.description, failedAt: now().toISOString(), error: e instanceof Error ? e.message : String(e) }));
      throw new Error(`Migration ${m.id} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    await db.tx(async (t) => t.set('migrations', m.id, { status: 'done', description: m.description, appliedAt: now().toISOString() }));
    applied.push(m.id);
  }
  return { applied, alreadyApplied };
}
