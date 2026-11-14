import { isValidEmail, normaliseEmail, normalisePhone } from './phone.js';

export const SYSTEM_STAGES = ['new', 'won', 'lost', 'junk', 'merged'] as const;
export const CLOSED_STAGES = ['won', 'lost', 'junk', 'merged'];

export interface LeadContactInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface NormalisedContact {
  phone: string | null;
  phoneRaw: string | null;
  phoneValid: boolean;
  email: string | null;
  keys: string[];
  labels: string[];
}

/** Normalise and build dedupe keys (RULE-018, RULE-019). Returns an error code when invalid. */
export function normaliseContact(i: LeadContactInput): NormalisedContact | { error: string } {
  const name = (i.name ?? '').trim();
  if (!name || name.length > 120) return { error: 'LEAD_NAME_REQUIRED' };
  const p = normalisePhone(i.phone);
  const email = normaliseEmail(i.email);
  const emailOk = isValidEmail(email);
  if (!(p?.valid || emailOk)) return { error: 'LEAD_CONTACT_REQUIRED' };
  const keys: string[] = [];
  if (p?.valid && p.e164) keys.push(`p:${p.e164}`);
  if (emailOk && email) keys.push(`e:${email}`);
  return {
    phone: p?.e164 ?? null,
    phoneRaw: p && !p.valid ? p.raw : null,
    phoneValid: !!p?.valid,
    email: emailOk ? email : null,
    keys,
    labels: p && !p.valid ? ['check_number'] : [],
  };
}

export type KeyTarget = { leadId?: string; customerId?: string; contactId?: string };
export interface ExistingLeadState {
  id: string;
  stage: string;
  mergedIntoId?: string | null;
}

export type IntakeDecision =
  | { kind: 'create' }
  | { kind: 'merge'; leadId: string; reopen: boolean }
  | { kind: 'log_only'; leadId: string }
  | { kind: 'link_customer'; customerId: string };

/** RULE-020 / RULE-021: decide how a new enquiry is handled. Customer contacts win over leads. */
export function decideIntake(targets: KeyTarget[], leads: Map<string, ExistingLeadState>): IntakeDecision {
  const customer = targets.find((t) => t.customerId);
  for (const t of targets) {
    if (!t.leadId) continue;
    let lead = leads.get(t.leadId);
    while (lead?.mergedIntoId) lead = leads.get(lead.mergedIntoId);
    if (!lead) continue;
    if (lead.stage === 'won') continue; // converted: handled by the customer contact
    if (lead.stage === 'junk') return { kind: 'log_only', leadId: lead.id };
    return { kind: 'merge', leadId: lead.id, reopen: lead.stage === 'lost' };
  }
  if (customer?.customerId) return { kind: 'link_customer', customerId: customer.customerId };
  return { kind: 'create' };
}

/** Fill only empty fields (RULE-020). */
export function fillEmpty<T extends Record<string, unknown>>(existing: T, incoming: Partial<T>): Partial<T> {
  const patch: Partial<T> = {};
  for (const [k, v] of Object.entries(incoming)) {
    const cur = existing[k];
    if ((cur === null || cur === undefined || cur === '') && v !== null && v !== undefined && v !== '') {
      (patch as Record<string, unknown>)[k] = v;
    }
  }
  return patch;
}

export type Role = 'admin' | 'sales_manager' | 'sales_exec' | 'accounts' | 'project_manager' | 'viewer' | 'support';

/** RULE-023 stage change check. Returns an error code or null. */
export function checkStageChange(from: string, to: string, opts: { reasonId?: string | null; role: Role; auto?: boolean }): string | null {
  if (from === 'merged') return 'LEAD_MERGED';
  if (to === 'won' && !opts.auto) return 'WON_ONLY_BY_CONVERSION';
  if (to === 'merged') return 'VALIDATION_FAILED';
  if ((to === 'lost' || to === 'junk') && !opts.reasonId) return 'LOST_REASON_REQUIRED';
  if (['won', 'lost', 'junk'].includes(from) && from !== to && !opts.auto) {
    if (!['admin', 'sales_manager'].includes(opts.role)) return 'REOPEN_FORBIDDEN';
  }
  return null;
}

// ---- Assignment (RULE-022) ----
export interface AssignmentRule {
  id: string;
  type: 'territory' | 'source' | 'interest';
  pincodeFrom?: string;
  pincodeTo?: string;
  cities?: string[];
  sourceIds?: string[];
  productIds?: string[];
  userIds: string[];
}
export interface AssignableUser {
  id: string;
  active: boolean;
  openLeads: number;
}
export interface AssignmentInput {
  mode: 'solo' | 'team';
  soloUserId: string;
  defaultOwnerId: string;
  strategy: 'round_robin' | 'fewest_open';
  rules: AssignmentRule[];
  users: AssignableUser[];
  lastIndexByRule: Record<string, number>;
  lead: { pincode?: string | null; city?: string | null; sourceId?: string | null; interestProductId?: string | null };
}
export interface AssignmentResult {
  ownerId: string;
  ruleId: string | null;
  fallback: boolean;
  lastIndexByRule: Record<string, number>;
}

function ruleMatches(r: AssignmentRule, l: AssignmentInput['lead']): boolean {
  if (r.type === 'territory') {
    if (l.pincode && r.pincodeFrom && r.pincodeTo && l.pincode >= r.pincodeFrom && l.pincode <= r.pincodeTo) return true;
    return !!(l.city && r.cities?.some((c) => c.toLowerCase() === l.city!.toLowerCase()));
  }
  if (r.type === 'source') return !!(l.sourceId && r.sourceIds?.includes(l.sourceId));
  return !!(l.interestProductId && r.productIds?.includes(l.interestProductId));
}

export function pickOwner(i: AssignmentInput): AssignmentResult {
  if (i.mode === 'solo') return { ownerId: i.soloUserId, ruleId: null, fallback: false, lastIndexByRule: i.lastIndexByRule };
  const order = ['territory', 'source', 'interest'];
  const rules = [...i.rules].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  const rule = rules.find((r) => ruleMatches(r, i.lead));
  const poolIds = rule ? rule.userIds : i.users.map((u) => u.id);
  const ruleKey = rule?.id ?? '_all';
  const eligible = poolIds.map((id) => i.users.find((u) => u.id === id)).filter((u): u is AssignableUser => !!u && u.active);
  if (!eligible.length) return { ownerId: i.defaultOwnerId, ruleId: rule?.id ?? null, fallback: true, lastIndexByRule: i.lastIndexByRule };
  if (i.strategy === 'fewest_open') {
    const u = [...eligible].sort((a, b) => a.openLeads - b.openLeads)[0]!;
    return { ownerId: u.id, ruleId: rule?.id ?? null, fallback: false, lastIndexByRule: i.lastIndexByRule };
  }
  // round-robin over the pool order, skipping inactive users
  const last = i.lastIndexByRule[ruleKey] ?? -1;
  for (let step = 1; step <= poolIds.length; step++) {
    const idx = (last + step) % poolIds.length;
    const u = eligible.find((e) => e.id === poolIds[idx]);
    if (u) return { ownerId: u.id, ruleId: rule?.id ?? null, fallback: false, lastIndexByRule: { ...i.lastIndexByRule, [ruleKey]: idx } };
  }
  return { ownerId: i.defaultOwnerId, ruleId: rule?.id ?? null, fallback: true, lastIndexByRule: i.lastIndexByRule };
}
