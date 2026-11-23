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
  DB?: any;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return onRequest({ request, env });

    const response = await env.ASSETS.fetch(request);

    // Ensure HTML and Service Worker are NEVER cached by browser or intermediate caches
    const isHtmlOrSw =
      url.pathname === '/' ||
      url.pathname === '/sw.js' ||
      url.pathname === '/manifest.webmanifest' ||
      url.pathname.endsWith('.html') ||
      !url.pathname.includes('.');

    if (isHtmlOrSw) {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
      headers.set('CDN-Cache-Control', 'no-cache, no-store');
      headers.set('Cloudflare-CDN-Cache-Control', 'no-cache, no-store');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  },
};
