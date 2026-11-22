/** Local & staging server: Auto-detects Live Cloud Firestore, Emulator, or Memory DB + fake/real Google. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { MemoryDb } from './db/memory.js';
import type { Db } from './db/types.js';
import { runTick } from './jobs.js';
import { seedInstall } from './seed.js';
import { FakeGoogle } from './shared/google.js';

async function initDb(): Promise<{ db: Db; mode: 'firestore' | 'emulator' | 'memory'; projectId?: string }> {
  // 1. Check Firestore Emulator
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const { initializeApp, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { FirestoreDb } = await import('./db/firestore.js');
    if (!getApps().length) {
      initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'salesphere-dev' });
    }
    return { db: new FirestoreDb(getFirestore()), mode: 'emulator', projectId: process.env.GCLOUD_PROJECT ?? 'salesphere-dev' };
  }

  // 2. Check Service Account Key for Live Cloud Firestore
  const potentialKeyPaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    resolve(process.cwd(), 'serviceAccountKey.json'),
    resolve(process.cwd(), 'service-account.json'),
    resolve(process.cwd(), 'firebase-service-account.json'),
    resolve(process.cwd(), '../../serviceAccountKey.json'),
  ].filter(Boolean) as string[];

  const keyPath = potentialKeyPaths.find((p) => existsSync(p));

  if (keyPath || process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const { cert, initializeApp, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { FirestoreDb } = await import('./db/firestore.js');

    let serviceAccount: any;
    if (keyPath) {
      serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } catch {
        serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8'));
      }
    }

    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id ?? process.env.GCLOUD_PROJECT,
      });
    }
    return { db: new FirestoreDb(getFirestore()), mode: 'firestore', projectId: serviceAccount.project_id };
  }

  // 3. Fallback to in-memory DB for local development
  return { db: new MemoryDb(), mode: 'memory' };
}

const cfg = loadConfig();
const { db, mode, projectId } = await initDb();

if (mode === 'firestore') {
  console.log(`\x1b[32m✔ [Database] Connected to Live Cloud Firestore (Project: ${projectId})\x1b[0m`);
} else if (mode === 'emulator') {
  console.log(`\x1b[36m⚡ [Database] Connected to Firestore Emulator (${process.env.FIRESTORE_EMULATOR_HOST})\x1b[0m`);
} else {
  console.log(`\x1b[33mℹ [Database] Running in In-Memory mode. To connect to Cloud Firestore, place serviceAccountKey.json in apps/api/ or set GOOGLE_APPLICATION_CREDENTIALS.\x1b[0m`);
}

const google = new FakeGoogle();
google.sheets.set('demo-sheet/Leads', { headers: ['Timestamp', 'Full Name', 'Phone', 'Email', 'City'], rows: [], editable: true });

const { app, ctx } = await createApp({ db, cfg, google, logLevel: 'info' });
const pw = process.env.DEV_ADMIN_PASSWORD ?? 'ChangeMe!2026';
const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`SaleSphere API ready on http://localhost:${port}/api/v1 (Admin: "admin" / pw: "${pw}")`);
});

seedInstall(ctx, { adminUsername: 'admin', adminName: 'Owner Admin', adminPassword: pw, webCatalogue: true }).catch((err) => {
  console.warn('Seed install notice:', err?.message);
});

setInterval(() => void runTick(ctx, 'minute'), 60_000);
