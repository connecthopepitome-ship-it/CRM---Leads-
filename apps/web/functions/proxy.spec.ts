// @vitest-environment node
/** Edge proxy contract with apps/api edgeSignature (HLD §5): signature format, internal block, CORS scope. */
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from './api/[[path]]';

const env = { API_ORIGIN: 'https://api.example.run.app', EDGE_HMAC_SECRET: 'test-secret' };

afterEach(() => vi.unstubAllGlobals());

describe('edge proxy', () => {
  it('signs ts.METHOD.path exactly as the API verifies it and strips spoofed headers', async () => {
    const seen: { url: string; headers: Headers }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      seen.push({ url, headers: new Headers(init.headers) });
      return new Response('{}', { status: 200 });
    }));
    const req = new Request('https://crm.example.com/api/v1/leads?stage=new', { headers: { 'X-SS-Edge-Sig': 'forged', 'CF-Connecting-IP': '203.0.113.9' } });
    const res = await onRequest({ request: req, env });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const { url, headers } = seen[0]!;
    expect(url).toBe('https://api.example.run.app/api/v1/leads?stage=new');
    const ts = headers.get('X-SS-Edge-Ts')!;
    expect(headers.get('X-SS-Edge-Sig')).toBe(createHmac('sha256', env.EDGE_HMAC_SECRET).update(`${ts}.GET./api/v1/leads`).digest('hex'));
    expect(headers.get('CF-Connecting-IP')).toBe('203.0.113.9');
  });

  it('blocks /api/internal/* at the edge', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await onRequest({ request: new Request('https://crm.example.com/api/internal/tasks/run', { method: 'POST' }), env });
    expect(res.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers CORS preflight only for the public form endpoint (FR-027)', async () => {
    const ok = await onRequest({ request: new Request('https://crm.example.com/api/v1/public/forms/f1/submit', { method: 'OPTIONS' }), env });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const no = await onRequest({ request: new Request('https://crm.example.com/api/v1/leads', { method: 'OPTIONS' }), env });
    expect(no.status).toBe(405);
    expect(no.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
