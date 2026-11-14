/** Provision a new install against Firestore (FR-002): `pnpm seed -- --admin admin --name "Owner" --catalogue web`.
 * Uses Application Default Credentials (or FIRESTORE_EMULATOR_HOST). Prints the temporary admin password once. */
import { randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
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
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const { ctx } = await createApp({ db: new FirestoreDb(getFirestore()), cfg: loadConfig(), google: new FakeGoogle() });
const password = `${randomBytes(6).toString('base64url')}-${randomBytes(4).toString('base64url')}`;
const id = await seedInstall(ctx, { adminUsername: arg('admin', 'admin'), adminName: arg('name', 'Owner'), adminPassword: password, webCatalogue: arg('catalogue', 'none') === 'web' });
console.warn(id ? `Admin created. Temporary password (change at first sign-in): ${password}` : 'Install already provisioned — nothing changed.');
