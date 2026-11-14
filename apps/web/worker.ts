/**
 * Cloudflare Worker entry (Workers + static assets; alternative to a Pages project — ADR-006 note in RUNBOOK §3).
 * /api/* → the same signed edge proxy used by Pages Functions (functions/api/[[path]].ts);
 * everything else → the built PWA in apps/web/dist (SPA fallback + _headers handled by the assets service).
 * Config: /wrangler.jsonc (run_worker_first: ["/api/*"]).
 */
import { onRequest } from './functions/api/[[path]]';

export interface WorkerEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  API_ORIGIN: string;
  EDGE_HMAC_SECRET: string;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/api/')) return onRequest({ request, env });
    return env.ASSETS.fetch(request);
  },
};
