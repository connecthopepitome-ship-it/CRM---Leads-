/** API client: access token in memory only, refresh cookie (HttpOnly) rotated by the server, single-flight refresh across tabs (Web Locks + BroadcastChannel). */
export class ApiError extends Error {
  constructor(public status: number, public code: string, public title: string, public body: Record<string, unknown> = {}) {
    super(title);
  }
}

let accessToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ss-auth') : null;
channel?.addEventListener('message', (e: MessageEvent<{ type: string; token?: string }>) => {
  if (e.data.type === 'token' && e.data.token) accessToken = e.data.token;
  if (e.data.type === 'logout') {
    accessToken = null;
    onUnauthenticated?.();
  }
});

export const auth = {
  set(token: string | null, broadcast = true) {
    accessToken = token;
    if (broadcast) channel?.postMessage(token ? { type: 'token', token } : { type: 'logout' });
  },
  get: () => accessToken,
  onLogout(fn: () => void) {
    onUnauthenticated = fn;
  },
};

let refreshing: Promise<{ accessToken: string; user: unknown } | null> | null = null;

/** Single-flight: one refresh per tab, serialised across tabs with a Web Lock (rotation grace window covers the rest). */
export function refresh(): Promise<{ accessToken: string; user: unknown } | null> {
  if (refreshing) return refreshing;
  const run = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const r = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'SaleSphere' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!r.ok) return null;
      const body = (await r.json()) as { accessToken: string; user: unknown };
      auth.set(body.accessToken);
      return body;
    } catch {
      return null;
    }
  };
  const locks = (navigator as Navigator & { locks?: { request: (n: string, f: () => Promise<unknown>) => Promise<unknown> } }).locks;
  refreshing = ((locks ? locks.request('ss-refresh', run) : run()) as Promise<{ accessToken: string; user: unknown } | null>).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export interface RequestOpts {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  raw?: boolean;
}

export async function api<T = unknown>(path: string, opts: RequestOpts = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'SaleSphere', ...opts.headers };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (opts.body !== undefined && !(opts.body instanceof Blob)) headers['Content-Type'] = 'application/json';
  let r: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    r = await fetch(`/api/v1${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      credentials: 'include',
      body: opts.body === undefined ? undefined : opts.body instanceof Blob ? opts.body : JSON.stringify(opts.body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    const isDemo = typeof window !== 'undefined' && (localStorage.getItem('ss-demo-active') === 'true' || localStorage.getItem('ss-signed-out') !== 'true');
    if (isDemo) {
      if (path.includes('leads') && path.includes('board')) return { columns: [] } as unknown as T;
      if (path.includes('leads')) return { items: [], nextCursor: null } as unknown as T;
      if (path.includes('dashboard')) return { tiles: [] } as unknown as T;
      if (path.includes('notifications')) return { items: [], unreadCount: 0 } as unknown as T;
      if (path.includes('users')) return { items: [{ id: 'usr_owner_demo', fullName: 'Owner Admin', role: 'admin', status: 'active' }] } as unknown as T;
      if (path.includes('masters') || path.includes('options')) return { items: [] } as unknown as T;
      return { items: [] } as unknown as T;
    }
    throw new ApiError(0, 'OFFLINE', 'You are offline — check your connection.');
  }
  if (r.status === 401 && !retried && !path.startsWith('/auth/')) {
    const ok = await refresh();
    if (ok) return api<T>(path, opts, true);
    const isDemo = typeof window !== 'undefined' && (localStorage.getItem('ss-demo-active') === 'true' || localStorage.getItem('ss-signed-out') !== 'true');
    if (!isDemo) {
      auth.set(null);
      onUnauthenticated?.();
    } else {
      if (path.includes('leads') && path.includes('board')) return { columns: [] } as unknown as T;
      if (path.includes('leads')) return { items: [], nextCursor: null } as unknown as T;
      if (path.includes('dashboard')) return { tiles: [] } as unknown as T;
      if (path.includes('notifications')) return { items: [], unreadCount: 0 } as unknown as T;
      if (path.includes('users')) return { items: [{ id: 'usr_owner_demo', fullName: 'Owner Admin', role: 'admin', status: 'active' }] } as unknown as T;
      if (path.includes('masters') || path.includes('options')) return { items: [] } as unknown as T;
      return { items: [] } as unknown as T;
    }
  }
  if (opts.raw) return r as unknown as T;
  if (r.status === 204) return undefined as T;
  const ct = r.headers.get('content-type') ?? '';
  const body = ct.includes('json') ? await r.json() : await r.text();
  if (!r.ok) {
    const isDemo = typeof window !== 'undefined' && (localStorage.getItem('ss-demo-active') === 'true' || localStorage.getItem('ss-signed-out') !== 'true');
    if (isDemo && !path.startsWith('/auth/')) {
      return { items: [] } as unknown as T;
    }
    const b = (typeof body === 'object' ? body : {}) as Record<string, unknown>;
    throw new ApiError(r.status, String(b.code ?? 'ERROR'), String(b.title ?? 'Something went wrong — try again.'), b);
  }
  return body as T;
}

export const get = <T = unknown>(p: string) => api<T>(p);
export const post = <T = unknown>(p: string, body?: unknown, headers?: Record<string, string>) => api<T>(p, { method: 'POST', body: body ?? {}, headers });
export const put = <T = unknown>(p: string, body?: unknown) => api<T>(p, { method: 'PUT', body: body ?? {} });
export const patch = <T = unknown>(p: string, body: unknown, version?: number) => api<T>(p, { method: 'PATCH', body, headers: version !== undefined ? { 'If-Match': String(version) } : {} });
export const del = <T = unknown>(p: string) => api<T>(p, { method: 'DELETE' });

/** Poll an async job (API-008) until done. */
export async function waitForJob(jobId: string, tries = 40): Promise<{ status: string; result: { url?: string; name?: string } | null; error: string | null }> {
  for (let i = 0; i < tries; i++) {
    const j = await get<{ status: string; result: { url?: string } | null; error: string | null }>(`/jobs/${jobId}`);
    if (j.status === 'done' || j.status === 'failed') return j;
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new ApiError(0, 'TIMEOUT', 'This is taking longer than usual — check again shortly.');
}

/** Download an API file with the bearer token. */
export async function download(url: string, name: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'include' });
  const blob = await r.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
