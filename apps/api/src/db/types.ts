/** Persistence port (hexagonal; ADR on Firestore). Documents are plain JSON; timestamps are ISO strings. */
export type Doc = Record<string, unknown> & { id: string };
export type Op = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains' | 'array-contains-any';
export type Where = [field: string, op: Op, value: unknown];

export interface Query {
  where?: Where[];
  orderBy?: [field: string, dir?: 'asc' | 'desc'][];
  limit?: number;
  /** opaque cursor from a previous page */
  cursor?: string | null;
}
export interface Page<T = Doc> {
  items: T[];
  nextCursor: string | null;
}

export interface Reader {
  get<T extends Doc = Doc>(col: string, id: string): Promise<T | null>;
  query<T extends Doc = Doc>(col: string, q?: Query): Promise<Page<T>>;
}

export interface Tx extends Reader {
  /** Fails with ALREADY_EXISTS when the doc exists (used for uniqueness and claims). */
  create(col: string, id: string, data: Record<string, unknown>): void;
  set(col: string, id: string, data: Record<string, unknown>): void;
  update(col: string, id: string, patch: Record<string, unknown>): void;
  delete(col: string, id: string): void;
}

export interface Db extends Reader {
  tx<T>(fn: (t: Tx) => Promise<T>): Promise<T>;
  count(col: string, q?: Query): Promise<number>;
  sum(col: string, field: string, q?: Query): Promise<number>;
  /** All matching docs (pages internally); for jobs and reports only. */
  all<T extends Doc = Doc>(col: string, q?: Query): Promise<T[]>;
}

export class AlreadyExists extends Error {
  constructor(public col: string, public docId: string) {
    super(`ALREADY_EXISTS ${col}/${docId}`);
  }
}
