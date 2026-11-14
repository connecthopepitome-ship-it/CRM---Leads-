#!/usr/bin/env node
/**
 * Generates infra/firestore.indexes.json (LLD-common §6: "every list query names its index").
 *
 * Sources
 *  1. infra/query-shapes.jsonl — every distinct query the API ran under the API + E2E suites
 *     (record with: SS_RECORD_QUERIES=<abs path> pnpm test && pnpm test:e2e).
 *  2. FAMILIES below — list endpoints whose optional filters/sorts are not all exercised by tests.
 *
 * Strategy: Firestore merges composite indexes that share the same sort suffix (zig-zag merge),
 * so each equality / array-contains field gets ONE index `(field, ...suffix)` instead of one index
 * per filter combination. The suffix is the orderBy fields, then any inequality fields not ordered.
 *
 * Usage: node infra/gen-indexes.mjs   (then review the diff and commit)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const C = (f) => ({ field: f, contains: true });

/** collection → { prefixes: equality / contains fields, sorts: orderBy lists, ranges?: [rangeField, sort][] } */
const FAMILIES = {
  leads: { // API-071 list (FR-028), board, due-today filter
    prefixes: ['ownerId', 'stage', 'sourceId', 'slaStatus', C('tags'), C('searchTokens')],
    sorts: [[['createdAt', 'desc']], [['name', 'asc']], [['nextFollowUpAt', 'asc']], [['updatedAt', 'desc']]],
    ranges: [['nextFollowUpAt', [['createdAt', 'desc']]]],
  },
  customers: { prefixes: ['archived', 'ownerId', C('searchTokens')], sorts: [[['displayName', 'asc']]] },
  followUps: { prefixes: ['ownerId', 'status', 'recordId'], sorts: [[['dueAt', 'asc']]] },
  activities: { prefixes: ['recordId', 'customerId', 'type', 'ownerId'], sorts: [[['occurredAt', 'desc']]] },
  quotations: { prefixes: ['ownerId', 'status', 'partyId', 'customerId', 'isLatest', C('searchTokens')], sorts: [[['updatedAt', 'desc']]] },
  salesOrders: { prefixes: ['ownerId', 'status', 'customerId'], sorts: [[['createdAt', 'desc']]] },
  invoices: { prefixes: ['ownerId', 'type', 'status', 'customerId', C('searchTokens')], sorts: [[['createdAt', 'desc']], [['dueDate', 'asc']]] },
  payments: { prefixes: ['ownerId', 'customerId', 'mode', 'status', C('searchTokens')], sorts: [[['date', 'desc']]] },
  auditLog: { prefixes: ['userId', 'recordType', 'recordId', 'action'], sorts: [[['at', 'desc']]] },
  importErrors: { prefixes: ['status', 'syncId'], sorts: [[['createdAt', 'desc']]] },
  notifications: { prefixes: ['userId', 'readAt'], sorts: [[['createdAt', 'desc']]] },
  sessions: { prefixes: ['userId', 'revokedAt'], sorts: [[['lastUsedAt', 'desc']]] },
  files: { prefixes: ['recordType', 'recordId', 'customerId'], sorts: [[['createdAt', 'desc']]] },
};

const EQ = new Set(['==', 'in']);
const CONTAINS = new Set(['array-contains', 'array-contains-any']);
const indexes = new Map();

function add(col, fields) {
  const seen = new Set();
  const uniq = fields.filter((f) => f.field !== 'id' && !seen.has(f.field) && seen.add(f.field));
  if (uniq.length < 2) return; // single-field indexes are automatic
  const out = uniq.map((f) => (f.contains ? { fieldPath: f.field, arrayConfig: 'CONTAINS' } : { fieldPath: f.field, order: f.dir === 'desc' ? 'DESCENDING' : 'ASCENDING' }));
  indexes.set(`${col}|${JSON.stringify(out)}`, { collectionGroup: col, queryScope: 'COLLECTION', fields: out });
}

function fromShape(col, where, orderBy) {
  const prefixes = [];
  const ineq = [];
  for (const [f, op] of where) {
    if (EQ.has(op)) prefixes.push({ field: f });
    else if (CONTAINS.has(op)) prefixes.push({ field: f, contains: true });
    else if (!ineq.includes(f)) ineq.push(f);
  }
  const suffix = orderBy.map(([f, dir = 'asc']) => ({ field: f, dir }));
  for (const f of ineq) if (!suffix.some((s) => s.field === f)) suffix.push({ field: f, dir: 'asc' });
  if (!suffix.length) return; // equality-only: served by merging single-field indexes
  if (!prefixes.length) add(col, suffix);
  for (const p of prefixes) if (!suffix.some((s) => s.field === p.field)) add(col, [p, ...suffix]);
}

const shapesFile = join(here, 'query-shapes.jsonl');
let recorded = 0;
if (existsSync(shapesFile)) {
  for (const line of readFileSync(shapesFile, 'utf8').split('\n').filter(Boolean)) {
    const s = JSON.parse(line);
    fromShape(s.col, s.where, s.orderBy);
    recorded++;
  }
}
for (const [col, fam] of Object.entries(FAMILIES)) {
  const pre = fam.prefixes.map((p) => (typeof p === 'string' ? [p, '=='] : [p.field, 'array-contains']));
  for (const sort of fam.sorts) for (const p of pre) fromShape(col, [p], sort);
  for (const [rangeField, sort] of fam.ranges ?? []) for (const p of pre) fromShape(col, [p, [rangeField, '<=']], sort);
}

const sorted = [...indexes.values()].sort((a, b) => (a.collectionGroup + JSON.stringify(a.fields)).localeCompare(b.collectionGroup + JSON.stringify(b.fields)));
if (sorted.length > 200) throw new Error(`${sorted.length} composite indexes exceeds Firestore's 200 limit`);
writeFileSync(join(here, 'firestore.indexes.json'), `${JSON.stringify({ indexes: sorted, fieldOverrides: [] }, null, 2)}\n`);
console.warn(`firestore.indexes.json: ${sorted.length} composite indexes (${recorded} recorded shapes + ${Object.keys(FAMILIES).length} list families)`);
