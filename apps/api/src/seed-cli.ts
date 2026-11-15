/** Provision a new install against Firestore (FR-002): `pnpm seed -- --admin admin --name "Owner" --catalogue web`.
 * Auto-detects serviceAccountKey.json, Application Default Credentials, or FIRESTORE_EMULATOR_HOST. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { FirestoreDb } from './db/firestore.js';
import { seedInstall } from './seed.js';
import { FakeGoogle } from './shared/google.js';

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? (process.argv[i + 1] ?? d) : d;
};

// Check for service account key file
const potentialKeyPaths = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  resolve(process.cwd(), 'serviceAccountKey.json'),
  resolve(process.cwd(), 'service-account.json'),
  resolve(process.cwd(), 'firebase-service-account.json'),
  resolve(process.cwd(), '../../serviceAccountKey.json'),
].filter(Boolean) as string[];

const keyPath = potentialKeyPaths.find((p) => existsSync(p));

if (!getApps().length) {
  if (keyPath) {
    const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id ?? process.env.GCLOUD_PROJECT,
    });
    console.log(`Using credentials from: ${keyPath} (Project: ${serviceAccount.project_id})`);
  } else {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  }
}

const { ctx } = await createApp({ db: new FirestoreDb(getFirestore()), cfg: loadConfig(), google: new FakeGoogle() });
const password = `${randomBytes(6).toString('base64url')}-${randomBytes(4).toString('base64url')}`;
const id = await seedInstall(ctx, { adminUsername: arg('admin', 'admin'), adminName: arg('name', 'Owner'), adminPassword: password, webCatalogue: arg('catalogue', 'none') === 'web' });
console.warn(id ? `Admin created. Temporary password (change at first sign-in): ${password}` : 'Install already provisioned — nothing changed.');
