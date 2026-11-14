/**
 * Cloudflare Pages Function: same-origin proxy for /api/* (HLD §5, ADR-006).
 * - Blocks /api/internal/* (Cloud Tasks / scheduler only).
 * - Signs every request: X-SS-Edge-Ts + X-SS-Edge-Sig = HMAC-SHA256(EDGE_HMAC_SECRET, `${ts}.${METHOD}.${path}`)
 *   — verified by apps/api/src/http/pipeline.ts `edgeSignature` (±60 s).
 * - Forwards CF-Connecting-IP; strips any client-supplied edge headers.
 * - CORS only for the public website form endpoint (FR-027); everything else is same-origin.
 * Env (Pages project settings → secrets): API_ORIGIN (Cloud Run URL of the `api` function), EDGE_HMAC_SECRET.
 * Global rate limit (60 req/min/IP) is a Cloudflare WAF rate-limiting rule — see docs/10-ops/RUNBOOK.md.
 */
interface Env {
  API_ORIGIN: string;
  EDGE_HMAC_SECRET: string;
}
interface Ctx {
  request: Request;
  env: Env;
}

const PUBLIC_FORM = /^\/api\/v1\/public\/forms\/[^/]+\/submit$/;
const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

async function sign(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const problem = (status: number, title: string, code: string) =>
  new Response(JSON.stringify({ type: 'about:blank', title, status, code }), { status, headers: { 'Content-Type': 'application/problem+json', ...SECURITY_HEADERS } });

export const onRequest = async ({ request, env }: Ctx): Promise<Response> => {
  const url = new URL(request.url);
  const cors = PUBLIC_FORM.test(url.pathname);
  const corsHeaders: Record<string, string> = cors ? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } : {};

  if (url.pathname.startsWith('/api/internal/')) return problem(404, 'Not found', 'NOT_FOUND');
  if (request.method === 'OPTIONS') return cors ? new Response(null, { status: 204, headers: corsHeaders }) : problem(405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
  if (!env.API_ORIGIN || !env.EDGE_HMAC_SECRET) return problem(503, 'Service is not configured yet', 'EDGE_NOT_CONFIGURED');

  const headers = new Headers(request.headers);
  for (const h of ['x-ss-edge-ts', 'x-ss-edge-sig', 'x-forwarded-for', 'host']) headers.delete(h);
  const ts = String(Date.now());
  headers.set('X-SS-Edge-Ts', ts);
  headers.set('X-SS-Edge-Sig', await sign(env.EDGE_HMAC_SECRET, `${ts}.${request.method}.${url.pathname}`));
  headers.set('CF-Connecting-IP', request.headers.get('CF-Connecting-IP') ?? '');
  headers.set('X-Forwarded-Host', url.host);

  const upstream = await fetch(`${env.API_ORIGIN.replace(/\/$/, '')}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  });
  const out = new Response(upstream.body, upstream);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...corsHeaders })) out.headers.set(k, v);
  return out;
};
