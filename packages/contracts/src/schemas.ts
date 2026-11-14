import { z } from 'zod';
import { PAYMENT_MODES } from '@ss/domain';

const id = z.string().min(1).max(128);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const paise = z.number().int();
const optStr = (max = 500) => z.string().trim().max(max).optional().nullable();

// ---- identity ----
export const LoginBody = z.object({ username: z.string().trim().toLowerCase().min(3).max(32), password: z.string().min(1).max(200) });
export const ChangePasswordBody = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(200) });
export const UserCreateBody = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/, '3–32 characters: a–z 0–9 . _ -'),
  fullName: z.string().trim().min(2).max(80),
  role: z.enum(['admin', 'sales_manager', 'sales_exec', 'accounts', 'project_manager', 'viewer']),
  phone: optStr(20),
  email: z.string().email().optional().nullable(),
  teamIds: z.array(id).max(20).optional(),
});
export const UserUpdateBody = UserCreateBody.omit({ username: true }).partial();
export const TeamBody = z.object({ name: z.string().trim().min(2).max(60), managerId: id, memberIds: z.array(id).max(100) });

// ---- masters ----
export const MasterItemBody = z.object({
  key: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().optional(),
  data: z.record(z.unknown()).optional(),
});
export const CompanyBody = z.object({
  legalName: z.string().trim().min(2).max(160),
  tradeName: optStr(160),
  gstRegistered: z.boolean(),
  gstin: z.string().optional().nullable(),
  stateCode: z.string().regex(/^\d{2}$/),
  address: z.string().trim().min(5).max(400),
  phone: optStr(20),
  email: z.string().email().optional().nullable(),
  pan: optStr(10),
  jurisdiction: optStr(80),
  signatory: optStr(80),
  logoDataUrl: z.string().max(400_000, 'Logo must be 300 KB or smaller').regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Logo must be a PNG, JPEG or WebP image').optional().nullable(),
});

// ---- leads ----
export const LeadCreateBody = z.object({
  name: z.string().trim().min(1).max(120),
  phone: optStr(30),
  email: optStr(200),
  company: optStr(120),
  city: optStr(80),
  pincode: z.string().regex(/^\d{6}$/).optional().nullable(),
  state: optStr(2),
  interestProductId: optStr(64),
  expectedValue: paise.min(0).optional().nullable(),
  sourceId: z.string().min(1).max(64).optional(),
  notes: optStr(5000),
  tags: z.array(z.string().max(40)).max(20).optional(),
  assignAuto: z.boolean().optional(),
  enquiryAt: z.string().datetime().optional(),
  consent: z.boolean().optional(),
});
export const LeadUpdateBody = LeadCreateBody.omit({ assignAuto: true, enquiryAt: true, consent: true }).partial();
export const StageBody = z.object({ stage: z.string().min(1).max(40), reasonId: optStr(64) });
export const BulkBody = z.object({
  ids: z.array(id).min(1),
  action: z.enum(['assign', 'stage', 'tag']),
  ownerId: id.optional(),
  stage: z.string().optional(),
  reasonId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export const MergeBody = z.object({ survivorId: id, otherId: id, picks: z.record(z.enum(['survivor', 'other'])).optional() });
export const ConvertBody = z.object({ mode: z.enum(['new', 'link']), customerId: id.optional() });
export const FormSubmitBody = z.object({
  fields: z.record(z.string().max(2000)),
  consent: z.boolean().optional(),
  hp: z.string().optional(),
  renderedAt: z.number().int().optional(),
});

// ---- engagement ----
export const ActivityBody = z.object({
  clientId: z.string().min(8).max(64),
  recordType: z.enum(['lead', 'customer']),
  recordId: id,
  type: z.enum(['call', 'whatsapp', 'note', 'visit']),
  status: z.enum(['pending', 'done']).optional(),
  note: optStr(5000),
  deviceAt: z.string().datetime().optional(),
});
export const OutcomeBody = z.object({
  outcomeId: z.string().min(1),
  note: optStr(5000),
  followUp: z.object({ dueAt: z.string().datetime(), type: z.enum(['call', 'whatsapp', 'email', 'visit', 'other']) }).optional().nullable(),
});
export const FollowUpBody = z.object({
  clientId: z.string().min(8).max(64).optional(),
  recordType: z.enum(['lead', 'customer']),
  recordId: id,
  dueAt: z.string().datetime(),
  type: z.enum(['call', 'whatsapp', 'email', 'visit', 'other']),
  note: optStr(1000),
});
export const FollowUpPatchBody = z.object({ action: z.enum(['complete', 'reschedule', 'cancel']), dueAt: z.string().datetime().optional() });
export const WhatsAppBody = z.object({ recordType: z.enum(['lead', 'customer']), recordId: id, templateId: id.optional(), text: optStr(4000), vars: z.record(z.string()).optional() });
export const EmailBody = z.object({
  recordType: z.enum(['lead', 'customer']),
  recordId: id,
  to: z.array(z.string().email()).min(1).max(10),
  cc: z.array(z.string().email()).max(10).optional(),
  subject: z.string().trim().min(1).max(200),
  html: z.string().max(100_000),
  attachments: z.array(z.object({ fileId: id })).max(10).optional(),
});
export const OutboxBody = z.object({
  items: z.array(z.object({ clientId: z.string().min(8).max(64), kind: z.string(), payload: z.record(z.unknown()), deviceAt: z.string().datetime().optional() })).max(50),
});

// ---- sales ----
export const LineBody = z.object({
  kind: z.enum(['item', 'heading']).default('item'),
  productId: optStr(64),
  description: z.string().trim().max(1000).default(''),
  qty: z.number().nonnegative().default(0),
  unit: optStr(20),
  rate: paise.min(0).default(0),
  discountPct: z.number().min(0).max(100).optional().nullable(),
  discountAmt: paise.min(0).optional().nullable(),
  taxRatePct: z.number().min(0).max(100).default(0),
  hsnSac: optStr(8),
  orderLineId: optStr(64),
});
export const QuoteBody = z.object({
  partyType: z.enum(['lead', 'customer']),
  partyId: id,
  date: isoDate.optional(),
  validDays: z.number().int().min(1).max(365).optional(),
  placeOfSupply: z.string().regex(/^\d{2}$/).optional(),
  lines: z.array(LineBody).min(1).max(200),
  overallDiscountPct: z.number().min(0).max(100).optional(),
  paymentTermId: optStr(64),
  termsText: optStr(10_000),
  notes: optStr(2000),
});
export const SendBody = z.object({ channel: z.enum(['whatsapp', 'email', 'link']).default('link') });
export const ApprovalBody = z.object({ decision: z.enum(['approve', 'reject']), comment: optStr(1000) });
export const RespondBody = z.object({ type: z.enum(['accept', 'changes', 'reject']), name: optStr(120), comment: optStr(2000) });
export const OrderBody = z.object({
  quoteId: id.optional(),
  onBehalfNote: optStr(1000),
  customerId: id.optional(),
  lines: z.array(LineBody).max(200).optional(),
  expectedDelivery: isoDate.optional().nullable(),
  customerPoRef: optStr(60),
  notes: optStr(2000),
});
export const OrderStatusBody = z.object({ status: z.enum(['confirmed', 'in_progress', 'on_hold', 'delivered', 'closed', 'cancelled']), reason: optStr(500) });
export const InvoiceBody = z.object({
  type: z.enum(['tax_invoice', 'bill_of_supply', 'proforma']),
  orderId: id.optional(),
  quoteId: id.optional(),
  customerId: id.optional(),
  date: isoDate.optional(),
  lines: z.array(z.object({ orderLineId: id, qty: z.number().positive() })).optional(),
  manualLines: z.array(LineBody).max(200).optional(),
  notes: optStr(2000),
  placeOfSupply: z.string().regex(/^\d{2}$/).optional(),
});
export const InvoicePatchBody = z.object({
  date: isoDate.optional(),
  notes: optStr(2000),
  placeOfSupply: z.string().regex(/^\d{2}$/).optional(),
  manualLines: z.array(LineBody).max(200).optional(),
  lines: z.array(z.object({ orderLineId: id, qty: z.number().positive() })).optional(),
});
export const CreditNoteBody = z.object({
  mode: z.enum(['full', 'lines', 'amount']),
  lines: z.array(z.object({ index: z.number().int().min(0), qty: z.number().positive() })).optional(),
  amount: paise.positive().optional(),
  reason: z.string().trim().min(3).max(500),
  date: isoDate.optional(),
});

// ---- payments ----
export const PaymentBody = z.object({
  customerId: id,
  date: isoDate,
  amount: paise.positive(),
  mode: z.enum(PAYMENT_MODES),
  reference: optStr(60),
  bankAccountId: optStr(64),
  tdsAmount: paise.min(0).optional(),
  tdsSection: optStr(10),
  proofFileId: optStr(64),
  note: optStr(1000),
  allocation: z.object({ mode: z.enum(['auto', 'manual']), preferInvoiceId: id.optional(), items: z.array(z.object({ invoiceId: id, amount: paise.positive() })).optional() }).optional(),
  utrOverrideReason: optStr(500),
});
export const ReverseBody = z.object({ reason: z.string().trim().min(3).max(500) });
export const ApplyAdvanceBody = z.object({ invoiceId: id, amount: paise.positive() });

// ---- customers ----
export const CustomerBody = z.object({
  displayName: z.string().trim().min(1).max(120),
  legalName: optStr(160),
  type: z.enum(['individual', 'business', 'government']).default('business'),
  groupId: optStr(64),
  gstin: z.string().trim().toUpperCase().optional().nullable(),
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional().nullable(),
  ownerId: id.optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  creditDays: z.number().int().min(0).max(365).optional(),
  confirmDuplicate: z.boolean().optional(),
  billing: z.object({ line1: z.string().min(1).max(200), line2: optStr(200), city: z.string().min(1).max(80), stateCode: z.string().regex(/^\d{2}$/), pincode: z.string().regex(/^\d{6}$/).optional().nullable() }).optional(),
  contact: z.object({ name: z.string().min(1).max(120), phone: optStr(30), email: optStr(200), role: z.enum(['decision_maker', 'accounts', 'site', 'other']).optional() }).optional(),
});
export const ContactBody = z.object({ name: z.string().trim().min(1).max(120), role: z.enum(['decision_maker', 'accounts', 'site', 'other']).default('other'), phone: optStr(30), email: optStr(200), isPrimary: z.boolean().optional() });
export const AddressBody = z.object({ type: z.enum(['billing', 'shipping']), line1: z.string().min(1).max(200), line2: optStr(200), city: z.string().min(1).max(80), stateCode: z.string().regex(/^\d{2}$/), pincode: z.string().regex(/^\d{6}$/).optional().nullable(), isDefault: z.boolean().optional() });

// ---- documents / notify / privacy ----
export const ShareLinkBody = z.object({ documentType: z.enum(['quote', 'invoice', 'receipt', 'statement']), documentId: id, from: isoDate.optional(), to: isoDate.optional() });
export const ShareLinkPatchBody = z.object({ action: z.enum(['revoke', 'extend']), expiresAt: z.string().datetime().optional() });
export const PrivacyFindBody = z.object({ phone: optStr(30), email: optStr(200) }).refine((v) => v.phone || v.email, 'Enter a phone or email');
export const PrivacyActBody = z.object({ personKey: id, confirm: z.string().optional() });
export const AuditSearchBody = z.object({
  from: isoDate,
  to: isoDate,
  userId: optStr(64),
  recordType: optStr(40),
  recordId: optStr(64),
  action: optStr(60),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: optStr(200),
});
