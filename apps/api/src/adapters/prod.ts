/** Production adapters (no extra SDKs: Google REST + metadata server for credentials). */
import type { Ctx, PdfRenderer, PushSender, TaskQueue } from '../context.js';
import type { Db } from '../db/types.js';
import { GoogleAuthError, type GooglePort, type SheetData } from '../shared/google.js';

const META = 'http://metadata.google.internal/computeMetadata/v1';
async function metadataToken(): Promise<string> {
  const r = await fetch(`${META}/instance/service-accounts/default/token`, { headers: { 'Metadata-Flavor': 'Google' } });
  return ((await r.json()) as { access_token: string }).access_token;
}
async function idToken(audience: string): Promise<string> {
  const r = await fetch(`${META}/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`, { headers: { 'Metadata-Flavor': 'Google' } });
  return r.text();
}

/** Secret Manager (refresh token storage). */
export class SecretStore {
  constructor(private project: string) {}
  private base(name: string) {
    return `https://secretmanager.googleapis.com/v1/projects/${this.project}/secrets/${name}`;
  }
  async get(name: string): Promise<string | null> {
    const r = await fetch(`${this.base(name)}/versions/latest:access`, { headers: { Authorization: `Bearer ${await metadataToken()}` } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`secret ${r.status}`);
    return Buffer.from(((await r.json()) as { payload: { data: string } }).payload.data, 'base64').toString('utf8');
  }
  async put(name: string, value: string) {
    const auth = { Authorization: `Bearer ${await metadataToken()}`, 'Content-Type': 'application/json' };
    await fetch(`https://secretmanager.googleapis.com/v1/projects/${this.project}/secrets?secretId=${name}`, { method: 'POST', headers: auth, body: JSON.stringify({ replication: { userManaged: { replicas: [{ location: 'asia-south1' }] } } }) });
    const r = await fetch(`${this.base(name)}:addVersion`, { method: 'POST', headers: auth, body: JSON.stringify({ payload: { data: Buffer.from(value).toString('base64') } }) });
    if (!r.ok) throw new Error(`secret add ${r.status}`);
  }
  async destroy(name: string) {
    await fetch(this.base(name), { method: 'DELETE', headers: { Authorization: `Bearer ${await metadataToken()}` } });
  }
}

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/spreadsheets'];
const colLetter = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

export class GoogleRest implements GooglePort {
  private access: { token: string; exp: number } | null = null;
  private headerRows = new Map<string, number>();
  constructor(private o: { clientId: string; clientSecret: string; redirectUri: string; secrets: SecretStore; db: Db; rootName: string }) {}

  private async token(): Promise<string> {
    if (this.access && this.access.exp > Date.now() + 300_000) return this.access.token;
    const rt = await this.o.secrets.get('google-refresh-token');
    if (!rt) throw new GoogleAuthError('not connected');
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: this.o.clientId, client_secret: this.o.clientSecret, refresh_token: rt, grant_type: 'refresh_token' }) });
    const j = (await r.json()) as { access_token?: string; expires_in?: number; error?: string };
    if (!r.ok || !j.access_token) throw new GoogleAuthError(j.error ?? 'refresh failed');
    this.access = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return j.access_token;
  }
  private async call(url: string, init: RequestInit = {}): Promise<Response> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await this.token()}` } });
      if (r.status === 401) throw new GoogleAuthError('unauthorised');
      if (r.status === 429 || r.status >= 500) {
        await new Promise((s) => setTimeout(s, 500 * 2 ** attempt));
        continue;
      }
      if (!r.ok) throw new Error(`google ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return r;
    }
    throw new Error('google unavailable');
  }

  async connected() {
    const d = await this.o.db.get('integrations', 'google');
    return d?.status === 'connected' ? { email: String(d.email), scopes: (d.scopes as string[]) ?? [] } : null;
  }
  authUrl(state: string) {
    const q = new URLSearchParams({ client_id: this.o.clientId, redirect_uri: this.o.redirectUri, response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  async exchange(code: string) {
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ code, client_id: this.o.clientId, client_secret: this.o.clientSecret, redirect_uri: this.o.redirectUri, grant_type: 'authorization_code' }) });
    const j = (await r.json()) as { access_token: string; refresh_token?: string; scope: string; expires_in: number };
    if (!r.ok || !j.refresh_token) throw new GoogleAuthError('No refresh token — remove SaleSphere from your Google account permissions and connect again');
    await this.o.secrets.put('google-refresh-token', j.refresh_token);
    this.access = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    const info = (await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${j.access_token}` } })).json()) as { email: string };
    return { email: info.email, scopes: j.scope.split(' ') };
  }
  async disconnect() {
    const rt = await this.o.secrets.get('google-refresh-token');
    if (rt) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(rt)}`, { method: 'POST' });
    await this.o.secrets.destroy('google-refresh-token');
    this.access = null;
  }
  async readSheet(id: string, tab: string, headerRow: number): Promise<SheetData> {
    this.headerRows.set(`${id}/${tab}`, headerRow);
    const r = await this.call(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`${tab}!A${headerRow}:ZZ`)}`);
    const values = ((await r.json()) as { values?: string[][] }).values ?? [];
    return { headers: (values[0] ?? []).map((h) => String(h).trim()), rows: values.slice(1).map((row) => row.map(String)) };
  }
  async canEdit(id: string) {
    const r = await this.call(`https://www.googleapis.com/drive/v3/files/${id}?fields=capabilities/canEdit`);
    return !!((await r.json()) as { capabilities?: { canEdit?: boolean } }).capabilities?.canEdit;
  }
  async writeCells(id: string, tab: string, updates: { row: number; col: number; value: string }[]) {
    const headerRow = this.headerRows.get(`${id}/${tab}`) ?? 1;
    const data = updates.map((u) => ({ range: `${tab}!${colLetter(u.col)}${u.row === -1 ? headerRow : headerRow + 1 + u.row}`, values: [[u.value]] }));
    await this.call(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valueInputOption: 'RAW', data }) });
  }
  async sendEmail(m: { to: string[]; cc?: string[]; subject: string; html: string; attachments?: { name: string; mimeType: string; data: Buffer }[] }) {
    const b = `ss_${Date.now().toString(36)}`;
    const enc = (s: string) => `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`;
    const parts = [`To: ${m.to.join(', ')}`, ...(m.cc?.length ? [`Cc: ${m.cc.join(', ')}`] : []), `Subject: ${enc(m.subject)}`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${b}"`, '', `--${b}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(m.html).toString('base64')];
    for (const a of m.attachments ?? []) parts.push(`--${b}`, `Content-Type: ${a.mimeType}; name="${a.name}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${a.name}"`, '', a.data.toString('base64'));
    parts.push(`--${b}--`);
    const raw = Buffer.from(parts.join('\r\n')).toString('base64url');
    const r = await this.call('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }) });
    return ((await r.json()) as { id: string }).id;
  }
  private async folder(path: string[]): Promise<string> {
    let parent = 'root';
    const full = [this.o.rootName, ...path];
    for (let i = 0; i < full.length; i++) {
      const key = full.slice(0, i + 1).join('/');
      const cached = await this.o.db.get('driveFolders', Buffer.from(key).toString('base64url'));
      if (cached) {
        parent = String(cached.folderId);
        continue;
      }
      const r = await this.call('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: full[i], mimeType: 'application/vnd.google-apps.folder', parents: [parent] }) });
      parent = ((await r.json()) as { id: string }).id;
      await this.o.db.tx(async (t) => t.set('driveFolders', Buffer.from(key).toString('base64url'), { folderId: parent, name: full[i] }));
    }
    return parent;
  }
  async uploadFile(path: string[], name: string, mimeType: string, data: Buffer, existingId?: string | null) {
    const b = `ss_${Date.now().toString(36)}`;
    const meta = existingId ? { name } : { name, parents: [await this.folder(path)] };
    const body = Buffer.concat([Buffer.from(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${mimeType}\r\n\r\n`), data, Buffer.from(`\r\n--${b}--`)]);
    const url = existingId ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=id` : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
    const r = await this.call(url, { method: existingId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body });
    return ((await r.json()) as { id: string }).id;
  }
  async downloadFile(id: string) {
    const r = await this.call(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
    return { data: Buffer.from(await r.arrayBuffer()), mimeType: r.headers.get('content-type') ?? 'application/octet-stream', name: id };
  }
  async deleteFile(id: string) {
    await this.call(`https://www.googleapis.com/drive/v3/files/${id}`, { method: 'DELETE' });
  }
  async moveFile(id: string, path: string[]) {
    const cur = (await (await this.call(`https://www.googleapis.com/drive/v3/files/${id}?fields=parents`)).json()) as { parents?: string[] };
    const target = await this.folder(path);
    const remove = (cur.parents ?? []).filter((x) => x !== target).join(',');
    await this.call(`https://www.googleapis.com/drive/v3/files/${id}?addParents=${target}${remove ? `&removeParents=${remove}` : ''}&fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  }
}

export class HttpPdf implements PdfRenderer {
  constructor(private url: string) {}
  async render(html: string) {
    const r = await fetch(this.url, { method: 'POST', headers: { Authorization: `Bearer ${await idToken(this.url)}`, 'Content-Type': 'text/html' }, body: html });
    if (!r.ok) throw new Error(`pdf ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
}

export class FcmPush implements PushSender {
  async send(tokens: string[], payload: { title: string; link: string }) {
    const { getMessaging } = await import('firebase-admin/messaging');
    const out = await getMessaging().sendEachForMulticast({ tokens, webpush: { notification: { title: payload.title, icon: '/icon-192.png' }, fcmOptions: { link: payload.link } } });
    return { invalid: out.responses.map((r, i) => (r.error?.code === 'messaging/registration-token-not-registered' ? tokens[i]! : null)).filter((x): x is string => !!x) };
  }
}

export class CloudTasks implements TaskQueue {
  async enqueue(name: string, payload: Record<string, unknown>) {
    const { getFunctions } = await import('firebase-admin/functions');
    const delay = Number(payload.delaySeconds ?? 0);
    await getFunctions().taskQueue('locations/asia-south1/functions/runTask').enqueue({ name, payload }, delay ? { scheduleDelaySeconds: delay } : {});
  }
}

export type { Ctx };
