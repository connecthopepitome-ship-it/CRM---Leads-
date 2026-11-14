/** Local development server: in-memory DB (or Firestore emulator when FIRESTORE_EMULATOR_HOST is set) + fake Google. */
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { MemoryDb } from './db/memory.js';
import type { Db } from './db/types.js';
import { runTick } from './jobs.js';
import { seedInstall } from './seed.js';
import { FakeGoogle } from './shared/google.js';

const cfg = loadConfig();
let db: Db = new MemoryDb();
if (process.env.FIRESTORE_EMULATOR_HOST) {
  const { initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { FirestoreDb } = await import('./db/firestore.js');
  initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'salesphere-dev' });
  db = new FirestoreDb(getFirestore());
}
const google = new FakeGoogle();
google.sheets.set('demo-sheet/Leads', { headers: ['Timestamp', 'Full Name', 'Phone', 'Email', 'City'], rows: [], editable: true });
const { app, ctx } = await createApp({ db, cfg, google, logLevel: 'info' });
const pw = process.env.DEV_ADMIN_PASSWORD ?? 'ChangeMe!2026';
await seedInstall(ctx, { adminUsername: 'admin', adminName: 'Owner Admin', adminPassword: pw, webCatalogue: true });
setInterval(() => void runTick(ctx, 'minute'), 60_000);
const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.warn(`SaleSphere API on http://localhost:${port}/api/v1 — sign in as "admin" with DEV_ADMIN_PASSWORD (default ChangeMe!2026, must change on first login)`);
});
