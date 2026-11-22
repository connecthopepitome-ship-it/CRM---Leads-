import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ERRORS, type ErrorCode } from '@ss/contracts';
import { AlreadyExists } from '../db/types.js';

/** Application error mapped to RFC 7807 problem+json with a stable `code`. */
export class AppError extends Error {
  constructor(public code: ErrorCode, public detail?: string, public extra?: Record<string, unknown>, public statusOverride?: number) {
    super(code);
  }
  get status() {
    return this.statusOverride ?? ERRORS[this.code][0];
  }
}

export function fail(code: ErrorCode, detail?: string, extra?: Record<string, unknown>): never {
  throw new AppError(code, detail, extra);
}

export const problemHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = (req as { id?: string }).id;
  let e: AppError;
  if (err instanceof AppError) e = err;
  else if (err instanceof ZodError) {
    e = new AppError('VALIDATION_FAILED', undefined, { errors: err.issues.map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message })) });
  } else if (err instanceof AlreadyExists) e = new AppError('VERSION_CONFLICT', 'Concurrent change — retry');
  else if (err instanceof SyntaxError && 'body' in err) e = new AppError('VALIDATION_FAILED', 'Malformed JSON');
  else if (err instanceof RangeError && err.message in ERRORS) e = new AppError(err.message as ErrorCode);
  else {
    (req as { log?: { error: (o: unknown, m: string) => void } }).log?.error({ err: { message: (err as Error)?.message, stack: (err as Error)?.stack } }, 'unhandled');
    console.error('Unhandled internal error on', req.method, req.url, ':', (err as Error)?.message);
    e = new AppError('INTERNAL', (err as Error)?.message || 'Internal error');
  }
  res.status(e.status).type('application/problem+json').json({
    type: `https://salesphere.app/problems/${e.code.toLowerCase()}`,
    title: e.detail ?? ERRORS[e.code][1],
    status: e.status,
    code: e.code,
    requestId,
    ...e.extra,
  });
};
