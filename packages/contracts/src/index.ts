export * from './errors.js';
export * from './rbac.js';
export * from './schemas.js';

/** Audit action catalogue `<entity>.<verb>` (LLD-audit TBL-020). Kept open-ended as string for module growth. */
export type AuditAction = `${string}.${string}`;

export const NOTIFICATION_EVENTS = {
  'N-001': 'Lead assigned',
  'N-002': 'Re-enquiry on existing lead',
  'N-003': 'Follow-up due',
  'N-004': 'First-contact SLA breached',
  'N-005': 'Discount approval requested',
  'N-006': 'Approval decided',
  'N-007': 'Quote first viewed',
  'N-008': 'Quote accepted / changes requested / rejected',
  'N-009': 'Payment recorded on my customer',
  'N-010': 'Google connection lost',
  'N-011': 'Sync run had failures',
  'N-012': 'Support access enabled / expired',
  'N-013': 'Account locked',
} as const;
export type NotificationEvent = keyof typeof NOTIFICATION_EVENTS;
