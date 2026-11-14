import cookieParser from 'cookie-parser';
import express from 'express';
import { generateKeyPair, importJWK, jwtVerify, SignJWT, type JWK, type KeyLike } from 'jose';
import pino from 'pino';
import type { AppConfig } from './config.js';
import type { Ctx, PdfRenderer, PushSender, TaskQueue } from './context.js';
import type { Db } from './db/types.js';
import { AppError, problemHandler } from './http/errors.js';
import { csrf, edgeSignature, requestContext } from './http/pipeline.js';
import type { GooglePort } from './shared/google.js';
import { auditRoutes } from './modules/audit.js';
import { customersRoutes } from './modules/customers.js';
import { documentsRoutes, moveLeadFilesTask, renderPdfTask } from './modules/documents.js';
import { emailSendTask, engagementRoutes } from './modules/engagement.js';
import { googleRoutes, runSync } from './modules/google.js';
import { identityRoutes } from './modules/identity.js';
import { importsRoutes } from './modules/imports.js';
import { insightsRoutes } from './modules/insights.js';
import { leadsRoutes } from './modules/leads.js';
import { mastersRoutes } from './modules/masters.js';
import { notifyRoutes, pushSendTask } from './modules/notify.js';
import { paymentsRoutes } from './modules/payments.js';
import { platformRoutes } from './modules/platform.js';
import { privacyRoutes } from './modules/privacy.js';
import { salesRoutes } from './modules/sales.js';

export async function makeKeys(jwk: string | null) {
  let priv: KeyLike | Uint8Array;
  let pub: KeyLike | Uint8Array;
  if (jwk) {
    const parsed = JSON.parse(jwk) as JWK;
    priv = await importJWK(parsed, 'EdDSA');
    const { d: _d, ...publicJwk } = parsed;
    pub = await importJWK(publicJwk as JWK, 'EdDSA');
  } else {
    const kp = await generateKeyPair('EdDSA', { extractable: true });
    priv = kp.privateKey;
    pub = kp.publicKey;
  }
  return {
    sign: (payload: Record<string, unknown>, ttlSec: number) => new SignJWT(payload).setProtectedHeader({ alg: 'EdDSA' }).setIssuedAt().setExpirationTime(`${ttlSec}s`).setIssuer('salesphere').sign(priv),
    verify: async (tokenStr: string) => (await jwtVerify(tokenStr, pub, { issuer: 'salesphere' })).payload as Record<string, unknown>,
  };
}

export interface AppDeps {
  db: Db;
  cfg: AppConfig;
  google: GooglePort;
  pdf?: PdfRenderer;
  push?: PushSender;
  tasks?: TaskQueue;
  clock?: Ctx['clock'];
  logLevel?: string;
}

/** In-process task runner (dev/test). Production maps the same names onto Cloud Tasks queues. */
export class InlineTasks implements TaskQueue {
  pending = new Set<Promise<void>>();
  ctx!: Ctx;
  constructor(private sync = false) {}
  async enqueue(name: string, payload: Record<string, unknown>) {
    const run = async () => {
      try {
        await runTask(this.ctx, name, payload);
      } catch (e) {
        this.ctx.log.warn({ task: name, err: (e as Error).message }, 'task failed');
      }
    };
    if (this.sync) return run();
    const p = new Promise<void>((resolve) => setTimeout(() => void run().finally(resolve), 0));
    this.pending.add(p);
    void p.finally(() => this.pending.delete(p));
  }
  async drain() {
    while (this.pending.size) await Promise.all([...this.pending]);
  }
}

export async function runTask(ctx: Ctx, name: string, payload: Record<string, unknown>) {
  switch (name) {
    case 'pdf.render':
      return renderPdfTask(ctx, payload.kind as 'invoice', String(payload.id));
    case 'email.send':
      return emailSendTask(ctx, String(payload.emailId));
    case 'push.send':
      return pushSendTask(ctx, String(payload.notificationId));
    case 'sheet.sync':
      await runSync(ctx, String(payload.syncId), (payload.trigger as 'poll') ?? 'poll');
      return;
    case 'drive.moveLeadFiles':
      return moveLeadFilesTask(ctx, String(payload.leadId), String(payload.customerId));
    case 'drive.rename':
      return; // folder names are derived from code + name on each upload in this adapter
    default:
      ctx.log.warn({ task: name }, 'unknown task');
  }
}

export async function createApp(deps: AppDeps) {
  const keys = await makeKeys(deps.cfg.jwtPrivateJwk);
  const tasks = deps.tasks ?? new InlineTasks();
  const ctx: Ctx = {
    db: deps.db,
    cfg: deps.cfg,
    clock: deps.clock ?? { now: () => new Date() },
    log: pino({ level: deps.logLevel ?? (deps.cfg.env === 'test' ? 'silent' : 'info'), redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.phone', '*.email'] }),
    tasks,
    google: deps.google,
    pdf: deps.pdf ?? { render: async () => null },
    push: deps.push ?? { send: async () => ({ invalid: [] }) },
    keys,
  };
  if (tasks instanceof InlineTasks) tasks.ctx = ctx;

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(requestContext(ctx));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(edgeSignature(ctx));
  // CSRF header on state-changing calls, except public pages and server-to-server hooks
  api.use((req, res, next) => (req.path.startsWith('/public/') || req.path.startsWith('/hooks/') ? next() : csrf(req, res, next)));
  for (const r of [platformRoutes, identityRoutes, auditRoutes, mastersRoutes, importsRoutes, leadsRoutes, engagementRoutes, googleRoutes, salesRoutes, paymentsRoutes, customersRoutes, documentsRoutes, notifyRoutes, insightsRoutes, privacyRoutes]) api.use(r(ctx));
  api.use((_req, _res, next) => next(new AppError('NOT_FOUND')));
  app.use('/api/v1', api);
  app.use(problemHandler);
  return { app, ctx };
}
