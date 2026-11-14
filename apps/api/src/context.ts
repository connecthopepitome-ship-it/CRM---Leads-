import type { Logger } from 'pino';
import type { RoleId } from '@ss/contracts';
import type { AppConfig } from './config.js';
import type { Db } from './db/types.js';
import type { GooglePort } from './shared/google.js';

export interface Clock {
  now(): Date;
}

export interface TaskQueue {
  /** Fire-and-forget background work (Cloud Tasks in production, in-process in dev/test). */
  enqueue(name: string, payload: Record<string, unknown>): Promise<void>;
}

export interface PdfRenderer {
  render(html: string): Promise<Buffer | null>;
}

export interface PushSender {
  send(tokens: string[], payload: { title: string; link: string }): Promise<{ invalid: string[] }>;
}

export interface Ctx {
  db: Db;
  cfg: AppConfig;
  clock: Clock;
  log: Logger;
  tasks: TaskQueue;
  google: GooglePort;
  pdf: PdfRenderer;
  push: PushSender;
  keys: { sign(payload: Record<string, unknown>, ttlSec: number): Promise<string>; verify(token: string): Promise<Record<string, unknown>> };
}

export interface Principal {
  userId: string;
  role: RoleId;
  name: string;
  /** users whose records a team manager may see (incl. self) */
  teamUserIds: string[];
  isSupport: boolean;
  sessionId: string | null;
}
