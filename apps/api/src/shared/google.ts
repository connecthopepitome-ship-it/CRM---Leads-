/** Google port (Sheets, Drive, Gmail, OAuth). Production adapter calls Google REST APIs with the refresh token from Secret Manager; tests use FakeGoogle. */
export interface SheetData {
  headers: string[];
  rows: string[][]; // rows after the header, index 0 = sheet row headerRow+1
}
export interface GooglePort {
  connected(): Promise<{ email: string; scopes: string[] } | null>;
  authUrl(state: string): string;
  exchange(code: string): Promise<{ email: string; scopes: string[] }>;
  disconnect(): Promise<void>;
  readSheet(spreadsheetId: string, tab: string, headerRow: number): Promise<SheetData>;
  canEdit(spreadsheetId: string): Promise<boolean>;
  writeCells(spreadsheetId: string, tab: string, updates: { row: number; col: number; value: string }[]): Promise<void>;
  sendEmail(msg: { to: string[]; cc?: string[]; subject: string; html: string; attachments?: { name: string; mimeType: string; data: Buffer }[] }): Promise<string>;
  uploadFile(folderPath: string[], name: string, mimeType: string, data: Buffer, existingId?: string | null): Promise<string>;
  downloadFile(fileId: string): Promise<{ data: Buffer; mimeType: string; name: string }>;
  deleteFile(fileId: string): Promise<void>;
  /** FR-077 AC2: move a file into another folder path (lead → customer Documents). */
  moveFile(fileId: string, folderPath: string[]): Promise<void>;
}

export class GoogleAuthError extends Error {}

/** In-memory fake used in dev without credentials and in tests. */
export class FakeGoogle implements GooglePort {
  conn: { email: string; scopes: string[] } | null = null;
  sheets = new Map<string, SheetData & { editable: boolean }>();
  sent: { to: string[]; subject: string }[] = [];
  files = new Map<string, { data: Buffer; mimeType: string; name: string; path: string[] }>();
  failAuth = false;
  async connected() {
    return this.conn;
  }
  authUrl(state: string) {
    return `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`;
  }
  async exchange(_code: string) {
    this.conn = { email: 'owner@gmail.com', scopes: ['drive.file', 'gmail.send', 'spreadsheets'] };
    return this.conn;
  }
  async disconnect() {
    this.conn = null;
  }
  private sheet(id: string, tab: string) {
    if (this.failAuth) throw new GoogleAuthError('invalid_grant');
    const s = this.sheets.get(`${id}/${tab}`);
    if (!s) throw new Error('Sheet not found');
    return s;
  }
  async readSheet(id: string, tab: string) {
    const s = this.sheet(id, tab);
    return { headers: [...s.headers], rows: s.rows.map((r) => [...r]) };
  }
  async canEdit(id: string) {
    return [...this.sheets.entries()].some(([k, v]) => k.startsWith(`${id}/`) && v.editable);
  }
  async writeCells(id: string, tab: string, updates: { row: number; col: number; value: string }[]) {
    const s = this.sheet(id, tab);
    if (!s.editable) throw new Error('PERMISSION_DENIED');
    for (const u of updates) {
      if (u.row === -1) {
        s.headers[u.col] = u.value;
        continue;
      }
      const r = (s.rows[u.row] ??= []);
      while (r.length <= u.col) r.push('');
      r[u.col] = u.value;
    }
  }
  async sendEmail(msg: { to: string[]; subject: string }) {
    if (!this.conn) throw new GoogleAuthError('not connected');
    this.sent.push({ to: msg.to, subject: msg.subject });
    return `msg_${this.sent.length}`;
  }
  async uploadFile(path: string[], name: string, mimeType: string, data: Buffer, existingId?: string | null) {
    const id = existingId ?? `drv_${this.files.size + 1}`;
    this.files.set(id, { data, mimeType, name, path });
    return id;
  }
  async downloadFile(id: string) {
    const f = this.files.get(id);
    if (!f) throw new Error('not found');
    return f;
  }
  async deleteFile(id: string) {
    this.files.delete(id);
  }
  async moveFile(id: string, path: string[]) {
    const f = this.files.get(id);
    if (f) f.path = path;
  }
}
