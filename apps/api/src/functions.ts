/** Cloud Functions 2nd gen entry points (HLD §7): api, runTask (Cloud Tasks), jobs (Scheduler), pdf (private). */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { CloudTasks, FcmPush, GoogleRest, HttpPdf, SecretStore } from './adapters/prod.js';
import { createApp, runTask as executeTask } from './app.js';
import { assertProductionSecrets, loadConfig, PRODUCTION_SECRETS } from './config.js';
import { FirestoreDb } from './db/firestore.js';
import { runTick } from './jobs.js';

process.env.NODE_ENV = 'production';
const region = 'asia-south1';
const secrets = [...PRODUCTION_SECRETS];

/** Lazy so the `pdf` function (no secrets, no Firestore) never builds the app. */
let built: ReturnType<typeof createApp> | null = null;
function app() {
  if (!built) {
    assertProductionSecrets();
    initializeApp();
    const cfg = loadConfig();
    const db = new FirestoreDb(getFirestore());
    const project = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? '';
    const google = new GoogleRest({ clientId: cfg.googleClientId ?? '', clientSecret: cfg.googleClientSecret ?? '', redirectUri: cfg.googleRedirectUri ?? '', secrets: new SecretStore(project), db, rootName: `SaleSphere – ${process.env.CLIENT_NAME ?? 'Client'}` });
    built = createApp({ db, cfg, google, pdf: cfg.pdfFunctionUrl ? new HttpPdf(cfg.pdfFunctionUrl) : undefined, push: new FcmPush(), tasks: new CloudTasks() });
  }
  return built;
}

export const api = onRequest({ region, memory: '512MiB', concurrency: 40, timeoutSeconds: 60, secrets }, async (req, res) => {
  (await app()).app(req, res);
});

/** Queue name must match CloudTasks.enqueue → `locations/asia-south1/functions/runTask`. */
export const runTask = onTaskDispatched({ region, retryConfig: { maxAttempts: 3, minBackoffSeconds: 30 }, rateLimits: { maxConcurrentDispatches: 10 }, secrets }, async (req) => {
  const { name, payload } = req.data as { name: string; payload: Record<string, unknown> };
  await executeTask((await app()).ctx, name, payload);
});

export const jobsMinute = onSchedule({ region, schedule: 'every 1 minutes', timeZone: 'Asia/Kolkata', secrets }, async () => {
  await runTick((await app()).ctx, 'minute');
});
export const jobsQuotes = onSchedule({ region, schedule: '5 0 * * *', timeZone: 'Asia/Kolkata', secrets }, async () => {
  await runTick((await app()).ctx, 'daily_0005');
});
export const jobsPurge = onSchedule({ region, schedule: '0 2 * * *', timeZone: 'Asia/Kolkata', secrets }, async () => {
  await runTick((await app()).ctx, 'daily_0200');
});

/** Private PDF renderer (invoker = the API service account only). */
export const pdf = onRequest({ region, memory: '2GiB', cpu: 1, concurrency: 1, timeoutSeconds: 60, invoker: 'private' }, async (req, res) => {
  const { renderPdf } = await import('./pdf.js');
  const html = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.rawBody ?? '');
  res.type('application/pdf').send(await renderPdf(html));
});
