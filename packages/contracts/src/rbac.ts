/** Roles, permissions and record scope (FRD §3.2, RULE-011, LLD-identity). */
export const ROLES = ['admin', 'sales_manager', 'sales_exec', 'accounts', 'project_manager', 'viewer', 'support'] as const;
export type RoleId = (typeof ROLES)[number];
export type Scope = 'all' | 'team' | 'own' | 'none';

export const ROLE_LABELS: Record<RoleId, string> = {
  admin: 'Admin', sales_manager: 'Sales Manager', sales_exec: 'Sales Executive', accounts: 'Accounts',
  project_manager: 'Project Manager', viewer: 'Viewer / Auditor', support: 'Support',
};

export type Resource = 'lead' | 'activity' | 'customer' | 'quote' | 'order' | 'invoice' | 'payment' | 'file' | 'finance' | 'report';
export type Action = 'read' | 'create' | 'update' | 'delete';

type Grid = Partial<Record<Resource, Partial<Record<Action, Scope>>>>;
const rcu = (s: Scope) => ({ read: s, create: s, update: s });
const r = (s: Scope) => ({ read: s });

const GRID: Record<RoleId, Grid> = {
  admin: { lead: { ...rcu('all'), delete: 'all' }, activity: { ...rcu('all'), delete: 'all' }, customer: { ...rcu('all'), delete: 'all' }, quote: { ...rcu('all'), delete: 'all' }, order: { ...rcu('all'), delete: 'all' }, invoice: rcu('all'), payment: { read: 'all', create: 'all' }, file: { read: 'all', create: 'all', delete: 'all' }, finance: r('all'), report: r('all') },
  support: {},
  sales_manager: { lead: { ...rcu('team'), delete: 'team' }, activity: rcu('team'), customer: rcu('team'), quote: rcu('team'), order: rcu('team'), invoice: r('team'), payment: { read: 'team', create: 'team' }, file: { read: 'team', create: 'team' }, finance: r('team'), report: r('team') },
  sales_exec: { lead: rcu('own'), activity: rcu('own'), customer: rcu('own'), quote: rcu('own'), order: rcu('own'), invoice: r('own'), payment: { read: 'own', create: 'own' }, file: { read: 'own', create: 'own' }, finance: r('own'), report: r('own') },
  accounts: { lead: r('all'), activity: { read: 'all', create: 'all' }, customer: rcu('all'), quote: r('all'), order: r('all'), invoice: rcu('all'), payment: { read: 'all', create: 'all' }, file: { read: 'all', create: 'all' }, finance: r('all'), report: r('all') },
  project_manager: { lead: r('all'), activity: { read: 'all', create: 'all' }, customer: r('all'), quote: r('all'), order: { read: 'all', update: 'all' }, invoice: r('all'), file: { read: 'all', create: 'all' }, report: r('all') },
  viewer: { lead: r('all'), activity: r('all'), customer: r('all'), quote: r('all'), order: r('all'), invoice: r('all'), payment: r('all'), file: r('all'), finance: r('all'), report: r('all') },
};
GRID.support = GRID.admin;

/** Special permissions (not record-scoped). */
const SPECIAL: Record<string, RoleId[]> = {
  'settings:read': ['admin', 'support', 'viewer'],
  'settings:write': ['admin', 'support'],
  'users:read': ['admin', 'support', 'sales_manager', 'viewer'],
  'users:write': ['admin', 'support'],
  'masters:write:catalogue': ['admin', 'support', 'sales_manager', 'accounts'],
  'masters:write:sales': ['admin', 'support', 'sales_manager'],
  'masters:write:finance': ['admin', 'support', 'accounts'],
  'masters:write:templates': ['admin', 'support'],
  'lead:assign': ['admin', 'support', 'sales_manager'],
  'lead:merge': ['admin', 'support', 'sales_manager'],
  'lead:reopen': ['admin', 'support', 'sales_manager'],
  'lead:import': ['admin', 'support', 'sales_manager'],
  'quote:approve': ['admin', 'support', 'sales_manager'],
  'invoice:issue': ['admin', 'support', 'accounts'],
  'invoice:credit': ['admin', 'support', 'accounts'],
  'invoice:create': ['admin', 'support', 'accounts'],
  'payment:reverse': ['admin', 'support', 'accounts'],
  'payment:utr_override': ['admin', 'support', 'accounts'],
  'order:status': ['admin', 'support', 'project_manager', 'sales_manager', 'sales_exec'],
  'audit:read': ['admin', 'support', 'viewer'],
  'privacy:execute': ['admin'],
  'report:finance': ['admin', 'support', 'accounts', 'viewer', 'sales_manager', 'sales_exec'],
};

export function scopeOf(role: RoleId, res: Resource, action: Action): Scope {
  return GRID[role]?.[res]?.[action] ?? 'none';
}
export function hasPermission(role: RoleId, perm: string): boolean {
  return SPECIAL[perm]?.includes(role) ?? false;
}

/** Discount limits per role default (overridable in settings). */
export const DEFAULT_DISCOUNT_LIMITS: Partial<Record<RoleId, number>> = { sales_exec: 10, sales_manager: 20, admin: 100, support: 100, accounts: 0 };
