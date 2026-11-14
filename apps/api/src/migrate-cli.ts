/** Runs pending migrations against a client's Firestore (deploy.yml step, before functions deploy). FR-006.
 * Uses Application Default Credentials (WIF in CI) and GCLOUD_PROJECT, or FIRESTORE_EMULATOR_HOST locally. */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreDb } from './db/firestore.js';
import { runMigrations } from './migrations.js';

initializeApp({ projectId: process.env.GCLOUD_PROJECT });
try {
  const r = await runMigrations(new FirestoreDb(getFirestore()));
  console.warn(`migrations: applied [${r.applied.join(', ') || 'none'}], already applied [${r.alreadyApplied.join(', ')}]`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
