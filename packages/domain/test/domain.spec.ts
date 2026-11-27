import { describe, expect, it } from 'vitest';
import {
  addBusinessMinutes, addMonths, ageingBucket, amountInWords, applyOutcome, autoAllocate, balanceDue, buildStatement, buildUpiUri,
  canAccept, checkStageChange, computeDocument, creditNoteEffect, decideIntake, diff, dueDate, erasurePlan, fillEmpty, formatDocNumber,
  formatINR, fyOf, invoiceStatus, isIntraState, isJunkPurgeDue, maskValue, needsApproval, normaliseContact, normalisePhone, parseRupees,
  paymentBlockMode, pendingQty, pickOwner, placeOfSupply, queryToken, renderTemplate, searchTokens, slaStatus, upiTrRef, validateGstin,
  validateManual, validateSeries, waLink, type AssignmentInput, type LedgerEntry,
} from '../src/index.js';

const intra = { gst: true, intraState: true, roundOff: true };
const line = { qty: 2, rate: 1_000_000, discountPct: 10, taxRatePct: 18, hsnSac: '998314' };

describe('totals and tax (FR-052, RULE-034, RULE-035)', () => {
  it('TC-153 FR-052 AC1 intra-state CGST+SGST', () => {
    const { totals } = computeDocument([line], intra);
    expect(totals.taxable).toBe(1_800_000);
    expect(totals.cgst).toBe(162_000);
    expect(totals.sgst).toBe(162_000);
    expect(totals.grandTotal).toBe(2_124_000);
  });
  it('TC-154 FR-052 AC2 inter-state IGST', () => {
    const { totals } = computeDocument([line], { ...intra, intraState: false });
    expect(totals.igst).toBe(324_000);
    expect(totals.cgst + totals.sgst).toBe(0);
  });
  it('TC-155 FR-052 AC3 round-off and words', () => {
    // taxable 40,999.66 @ 18 % = 7,379.94 → 48,379.60 → round-off +0.40
    const { totals } = computeDocument([{ qty: 1, rate: 4_099_966, taxRatePct: 18 }], intra);
    expect(totals.grandTotal - totals.roundOff).toBe(4_837_960);
    expect(totals.roundOff).toBe(40);
    expect(totals.grandTotal).toBe(4_838_000);
    expect(totals.inWords).toBe('Rupees Forty-Eight Thousand Three Hundred Eighty Only');
  });
  it('TC-156 FR-052 AC4 non-GST install has no tax', () => {
    const { totals } = computeDocument([line], { gst: false, intraState: true, roundOff: false });
    expect(totals.taxTotal).toBe(0);
    expect(totals.taxByRate).toEqual([]);
  });
  it('headings, overall discount, tax summary and discount guard', () => {
    const { totals, lines } = computeDocument(
      [{ kind: 'heading', qty: 0, rate: 0, taxRatePct: 0 }, { qty: 1, rate: 10_000, taxRatePct: 5 }, { qty: 1.5, rate: 333, taxRatePct: 18, discountAmt: 0 }],
      { ...intra, overallDiscountPct: 10, roundOff: false },
    );
    expect(lines[0]!.total).toBe(0);
    expect(totals.taxByRate.map((r) => r.ratePct)).toEqual([5, 18]);
    expect(totals.maxDiscountPct).toBe(10);
    expect(() => computeDocument([{ qty: 1, rate: 100, discountAmt: 200, taxRatePct: 0 }], intra)).toThrow('DISCOUNT_EXCEEDS_GROSS');
  });
  it('TC-188 FR-064 AC1 place of supply decides intra vs inter', () => {
    expect(isIntraState('29', placeOfSupply({ kind: 'services', companyState: '29', billingState: '29' }))).toBe(true);
    expect(isIntraState('29', placeOfSupply({ kind: 'services', companyState: '29', billingState: '27' }))).toBe(false);
    expect(placeOfSupply({ kind: 'services', companyState: '29' })).toBe('29');
    expect(placeOfSupply({ kind: 'goods', companyState: '29', billingState: '27', shippingState: '33' })).toBe('33');
  });
});

describe('money and words', () => {
  it('formats with Indian grouping (RULE-060)', () => {
    expect(formatINR(123_456_700)).toBe('₹12,34,567.00');
    expect(formatINR(-5)).toBe('-₹0.05');
    expect(parseRupees('1,234.5')).toBe(123_450);
    expect(parseRupees('abc')).toBeNull();
  });
  it('words in lakh and crore with paise', () => {
    expect(amountInWords(0)).toBe('Rupees Zero Only');
    expect(amountInWords(12_345_678_905)).toBe('Rupees Twelve Crore Thirty-Four Lakh Fifty-Six Thousand Seven Hundred Eighty-Nine and Five Paise Only');
  });
});

describe('numbering (RULE-003, FR-005)', () => {
  it('TC-014 FR-005 AC1 format and FY from document date (E-21)', () => {
    expect(formatDocNumber({ prefix: 'INV', pad: 4, fyReset: true }, fyOf('2025-11-30'), 142)).toBe('INV/25-26/0142');
    expect(fyOf('2026-03-31')).toBe('25-26');
    expect(fyOf('2026-04-01')).toBe('26-27');
    expect(formatDocNumber({ prefix: 'RCPT', pad: 5, fyReset: false }, '25-26', 7)).toBe('RCPT/00007');
  });
  it('rejects series longer than 16 characters or with bad characters', () => {
    expect(validateSeries({ prefix: 'INVOICE', pad: 5, fyReset: true })).toBe('SERIES_TOO_LONG');
    expect(validateSeries({ prefix: 'IN V', pad: 4, fyReset: true })).toBe('SERIES_INVALID_CHARS');
    expect(validateSeries({ prefix: 'INV', pad: 4, fyReset: true })).toBeNull();
  });
});

describe('UPI (FR-068, RULE-041)', () => {
  const base = { vpa: 'acme@okhdfcbank', payeeName: 'Acme Interiors', docNumber: 'INV/25-26/0142', trEnabled: true };
  it('TC-197 FR-068 AC1 exact payload', () => {
    expect(buildUpiUri({ ...base, amount: 4_838_000 })).toBe(
      'upi://pay?pa=acme@okhdfcbank&pn=Acme%20Interiors&am=48380.00&cu=INR&tn=INV%2F25-26%2F0142&tr=INV2526-0142',
    );
    expect(upiTrRef('INV/25-26/0142')).toBe('INV2526-0142');
  });
  it('TC-198 FR-068 AC2 QR carries the balance after part payment', () => {
    const bal = balanceDue({ grandTotal: 4_838_000, paid: 2_000_000, credited: 0 });
    expect(buildUpiUri({ ...base, amount: bal })).toContain('am=28380.00');
  });
  it('TC-199 / TC-200 FR-068 AC3, AC4 PAID stamp and no-UPI fallback', () => {
    expect(paymentBlockMode(0, true, true)).toBe('paid');
    expect(paymentBlockMode(100, false, true)).toBe('bank');
    expect(paymentBlockMode(100, false, false)).toBe('none');
    expect(paymentBlockMode(100, true, false)).toBe('qr');
  });
  it('TC-202 FR-068 AC6 payee truncated to 50 chars', () => {
    const uri = buildUpiUri({ ...base, payeeName: 'A'.repeat(60), amount: 100 });
    expect(uri).toContain(`pn=${'A'.repeat(50)}&`);
  });
  it('TC-203 FR-068 AC7 tr can be switched off', () => {
    const uri = buildUpiUri({ ...base, trEnabled: false, amount: 100 });
    expect(uri).not.toContain('tr=');
    expect(uri).toContain('tn=INV%2F25-26%2F0142');
  });
});

describe('leads (FR-028, FR-029, FR-031, FR-033)', () => {
  it('TC-087 FR-028 AC1 normalises Indian numbers to E.164', () => {
    expect(normalisePhone('098450 12345')?.e164).toBe('+919845012345');
  });
  it('TC-088 FR-028 AC2 keeps invalid numbers raw and flagged', () => {
    const c = normaliseContact({ name: 'X', phone: '12345', email: 'x@y.in' });
    expect('error' in c).toBe(false);
    if (!('error' in c)) {
      expect(c.phoneRaw).toBe('12345');
      expect(c.labels).toContain('check_number');
      expect(c.keys).toEqual(['e:x@y.in']);
    }
  });
  it('TC-077 FR-025 AC1 needs phone or email', () => {
    expect(normaliseContact({ name: 'Ravi' })).toEqual({ error: 'LEAD_CONTACT_REQUIRED' });
    expect(normaliseContact({ name: '', phone: '9845012345' })).toEqual({ error: 'LEAD_NAME_REQUIRED' });
  });
  it('TC-089 / TC-090 / TC-091 FR-029 dedupe decisions', () => {
    const leads = new Map([
      ['L1', { id: 'L1', stage: 'contacted' }],
      ['L2', { id: 'L2', stage: 'lost' }],
      ['L3', { id: 'L3', stage: 'junk' }],
      ['L4', { id: 'L4', stage: 'merged', mergedIntoId: 'L1' }],
    ]);
    expect(decideIntake([{ leadId: 'L1' }], leads)).toEqual({ kind: 'merge', leadId: 'L1', reopen: false });
    expect(decideIntake([{ leadId: 'L2' }], leads)).toEqual({ kind: 'merge', leadId: 'L2', reopen: true });
    expect(decideIntake([{ leadId: 'L3' }], leads)).toEqual({ kind: 'log_only', leadId: 'L3' });
    expect(decideIntake([{ leadId: 'L4' }], leads)).toEqual({ kind: 'merge', leadId: 'L1', reopen: false });
    expect(decideIntake([{ customerId: 'C1', contactId: 'k' }], leads)).toEqual({ kind: 'link_customer', customerId: 'C1' });
    expect(decideIntake([], leads)).toEqual({ kind: 'create' });
    expect(fillEmpty<Record<string, string | null>>({ a: 'x', b: null, c: '' }, { a: 'y', b: 'z', c: 'w' })).toEqual({ b: 'z', c: 'w' });
  });
  const base: AssignmentInput = {
    mode: 'team', soloUserId: 'admin', defaultOwnerId: 'mgr', strategy: 'round_robin', rules: [], lastIndexByRule: { _all: 1 },
    users: [{ id: 'A', active: true, openLeads: 5 }, { id: 'B', active: true, openLeads: 1 }, { id: 'C', active: true, openLeads: 3 }],
    lead: { pincode: '560034' },
  };
  it('TC-093 FR-031 AC1 round-robin after B goes to C', () => {
    expect(pickOwner(base).ownerId).toBe('C');
  });
  it('TC-094 FR-031 AC2 territory rule', () => {
    const r = pickOwner({ ...base, rules: [{ id: 'south', type: 'territory', pincodeFrom: '560001', pincodeTo: '560099', userIds: ['A'] }] });
    expect(r).toMatchObject({ ownerId: 'A', ruleId: 'south' });
  });
  it('TC-095 FR-031 AC3 all inactive → default owner fallback', () => {
    const r = pickOwner({ ...base, users: base.users.map((u) => ({ ...u, active: false })) });
    expect(r).toMatchObject({ ownerId: 'mgr', fallback: true });
  });
  it('TC-096 FR-031 AC4 Solo mode owns everything; fewest-open strategy', () => {
    expect(pickOwner({ ...base, mode: 'solo' }).ownerId).toBe('admin');
    expect(pickOwner({ ...base, strategy: 'fewest_open' }).ownerId).toBe('B');
  });
  it('TC-099 / TC-100 FR-033 stage rules', () => {
    expect(checkStageChange('contacted', 'lost', { role: 'sales_exec' })).toBe('LOST_REASON_REQUIRED');
    expect(checkStageChange('contacted', 'won', { role: 'admin' })).toBe('WON_ONLY_BY_CONVERSION');
    expect(checkStageChange('lost', 'new', { role: 'sales_exec' })).toBe('REOPEN_FORBIDDEN');
    expect(checkStageChange('lost', 'new', { role: 'sales_manager' })).toBeNull();
    expect(checkStageChange('contacted', 'interested', { role: 'sales_exec' })).toBeNull();
    expect(checkStageChange('merged', 'new', { role: 'admin' })).toBe('LEAD_MERGED');
  });
});

describe('engagement (FR-045, FR-046, FR-050)', () => {
  // 10:00 IST = 04:30Z
  it('TC-147 FR-050 AC1 15 business minutes', () => {
    const due = addBusinessMinutes(new Date('2026-11-13T04:30:00Z'), 15);
    expect(due.toISOString()).toBe('2026-11-13T04:45:00.000Z');
    expect(slaStatus(new Date('2026-11-13T04:46:00Z'), due, null)).toBe('breached');
    expect(slaStatus(new Date('2026-11-13T04:40:00Z'), due, null)).toBe('pending');
    expect(slaStatus(new Date(), due, new Date('2026-11-13T04:40:00Z'))).toBe('met');
  });
  it('TC-148 FR-050 AC2 after-hours lead starts next morning', () => {
    // 21:00 IST Fri 13-11-2026 = 15:30Z → Sat 09:15 IST = 03:45Z
    expect(addBusinessMinutes(new Date('2026-11-13T15:30:00Z'), 15).toISOString()).toBe('2026-11-14T03:45:00.000Z');
    // Sat 18:50 IST + 15 → Mon 09:05 IST
    expect(addBusinessMinutes(new Date('2026-11-14T13:20:00Z'), 15).toISOString()).toBe('2026-11-16T03:35:00.000Z');
    // Sunday 08:00 IST start → Mon 09:15
    expect(addBusinessMinutes(new Date('2026-11-15T02:30:00Z'), 15).toISOString()).toBe('2026-11-16T03:45:00.000Z');
  });
  it('TC-132 / TC-133 FR-045 consecutive no-answer rule and reset', () => {
    const rule = { count: 3, tag: 'unreachable', followUpDays: 2 };
    expect(applyOutcome(2, 'no_answer', [], rule)).toMatchObject({ streak: 3, tagsAdded: ['unreachable'], followUpDays: 2 });
    expect(applyOutcome(2, 'connected', [{ outcomeId: 'connected', stage: 'contacted' }], rule)).toMatchObject({ streak: 0, stage: 'contacted' });
    expect(applyOutcome(0, 'busy', [], rule).streak).toBe(1);
  });
  it('TC-134 FR-046 AC1 template + wa.me link', () => {
    const text = renderTemplate('Hi {{name}}, here is your quote {{link}} {{missing}}', { name: 'Ravi', link: 'https://x/s/abc' });
    expect(text).toBe('Hi Ravi, here is your quote https://x/s/abc ');
    expect(waLink('+919845012345', 'a & b')).toBe('https://wa.me/919845012345?text=a%20%26%20b');
  });
});

describe('sales (FR-053, FR-057, FR-061, FR-062, FR-066)', () => {
  it('TC-157 / TC-160 / TC-161 FR-053 approval rules', () => {
    expect(needsApproval({ mode: 'team', maxDiscountPct: 15, roleLimitPct: 10 })).toBe(true);
    expect(needsApproval({ mode: 'team', maxDiscountPct: 15, roleLimitPct: 10, approvedMaxPct: 15 })).toBe(false);
    expect(needsApproval({ mode: 'team', maxDiscountPct: 18, roleLimitPct: 10, approvedMaxPct: 15 })).toBe(true);
    expect(needsApproval({ mode: 'solo', maxDiscountPct: 50, roleLimitPct: 0 })).toBe(false);
  });
  it('TC-169 / TC-171 FR-057 only latest unexpired sent/viewed can be accepted', () => {
    expect(canAccept({ status: 'sent', isLatest: true, validUntil: '2026-11-30' }, '2026-11-30')).toBe(true);
    expect(canAccept({ status: 'sent', isLatest: true, validUntil: '2026-11-30' }, '2026-12-01')).toBe(false);
    expect(canAccept({ status: 'superseded', isLatest: false, validUntil: '2026-11-30' }, '2026-11-01')).toBe(false);
  });
  it('TC-182 / TC-183 FR-061 pending quantity incl. credit notes', () => {
    expect(pendingQty({ qty: 10, invoicedQty: 4, creditedQty: 0 })).toBe(6);
    expect(pendingQty({ qty: 10, invoicedQty: 4, creditedQty: 2 })).toBe(8);
  });
  it('TC-185 FR-062 AC2 due date Net 15', () => {
    expect(dueDate('2026-12-01', 15)).toBe('2026-12-16');
  });
  it('TC-193 / TC-194 FR-066 credit notes', () => {
    expect(invoiceStatus({ grandTotal: 1_000_000, paid: 0, credited: 1_000_000 })).toBe('cancelled');
    expect(creditNoteEffect({ grandTotal: 1_000_000, paid: 600_000, credited: 0 }, 600_000)).toEqual({ ok: true, onAccount: 200_000 });
    expect(creditNoteEffect({ grandTotal: 1_000_000, paid: 0, credited: 900_000 }, 200_000).ok).toBe(false);
    expect(invoiceStatus({ grandTotal: 1_000_000, paid: 400_000, credited: 0 })).toBe('partly_paid');
    expect(invoiceStatus({ grandTotal: 1_000_000, paid: 1_000_000, credited: 0 })).toBe('paid');
    expect(invoiceStatus({ grandTotal: 1_000_000, paid: 0, credited: 0 })).toBe('issued');
  });
  it('TC-220 FR-075 AC2 ageing buckets', () => {
    expect(ageingBucket('2026-10-01', '2026-11-15')).toBe('d31_60');
    expect(ageingBucket('2026-11-15', '2026-11-15')).toBe('not_due');
    expect(ageingBucket('2026-11-14', '2026-11-15')).toBe('d1_30');
    expect(ageingBucket('2026-08-01', '2026-11-15')).toBe('d90_plus');
    expect(ageingBucket('2026-09-01', '2026-11-15')).toBe('d61_90');
  });
});

describe('payments (FR-071)', () => {
  const inv = [
    { id: 'B', number: 'INV/25-26/0002', date: '2026-10-25', dueDate: '2026-11-10', balance: 1_500_000 },
    { id: 'A', number: 'INV/25-26/0001', date: '2026-10-15', dueDate: '2026-11-01', balance: 1_000_000 },
  ];
  it('TC-210 FR-071 AC1 oldest due first', () => {
    expect(autoAllocate(inv, 2_000_000)).toEqual({ allocations: [{ invoiceId: 'A', amount: 1_000_000 }, { invoiceId: 'B', amount: 1_000_000 }], advance: 0 });
  });
  it('TC-211 FR-071 AC2 remainder is an advance', () => {
    expect(autoAllocate(inv, 3_000_000).advance).toBe(500_000);
  });
  it('TC-210a FR-070 AC1 opened from an invoice → that invoice first, remainder oldest-first', () => {
    expect(autoAllocate(inv, 2_000_000, 'B')).toEqual({ allocations: [{ invoiceId: 'B', amount: 1_500_000 }, { invoiceId: 'A', amount: 500_000 }], advance: 0 });
  });
  it('TC-212 FR-071 AC3 TDS counts toward settlement', () => {
    const plan = autoAllocate([inv[1]!], 900_000 + 100_000);
    expect(plan.allocations[0]!.amount).toBe(1_000_000);
  });
  it('TC-213 FR-071 AC4 manual allocations over the amount are rejected', () => {
    expect(validateManual(inv, 1_000_000, [{ invoiceId: 'A', amount: 1_000_000 }, { invoiceId: 'B', amount: 1 }])).toEqual({ error: 'ALLOCATION_EXCEEDS_AMOUNT' });
    expect(validateManual(inv, 5_000_000, [{ invoiceId: 'A', amount: 1_000_001 }])).toMatchObject({ error: 'ALLOCATION_EXCEEDS_BALANCE' });
    expect(validateManual(inv, 1_000_000, [{ invoiceId: 'A', amount: 600_000 }])).toEqual({ allocations: [{ invoiceId: 'A', amount: 600_000 }], advance: 400_000 });
    expect(validateManual(inv, 1_000_000, [{ invoiceId: 'Z', amount: 1 }])).toMatchObject({ error: 'NOT_FOUND' });
  });
});

describe('customers (FR-074, FR-076)', () => {
  it('TC-217 FR-074 AC1 GSTIN state must match', () => {
    expect(validateGstin('29ABCDE1234F1ZW', '29')).toBeNull();
    expect(validateGstin('29ABCDE1234F1ZW', '27')).toBe('GSTIN_STATE_MISMATCH');
    expect(validateGstin('29ABCDE1234F1X5')).toBe('GSTIN_INVALID');
  });
  const e = (date: string, kind: LedgerEntry['kind'], debit: number, credit: number, seq = 0): LedgerEntry => ({ date, kind, docNumber: kind, debit, credit, seq });
  it('TC-222 FR-076 AC1 opening, entries, closing', () => {
    const s = buildStatement([e('2026-09-01', 'invoice', 1_000_000, 0), e('2026-10-05', 'invoice', 2_000_000, 0), e('2026-10-20', 'payment', 0, 1_500_000)], '2026-10-01', '2026-10-31');
    expect(s.opening).toBe(1_000_000);
    expect(s.closing).toBe(1_500_000);
    expect(s.rows.map((r) => r.balance)).toEqual([3_000_000, 1_500_000]);
  });
  it('TC-224 FR-076 AC3 TDS on its own line, closing 0', () => {
    const s = buildStatement([e('2026-10-01', 'invoice', 1_000_000, 0, 1), e('2026-10-10', 'payment', 0, 900_000, 2), e('2026-10-10', 'tds', 0, 100_000, 3)], '2026-10-01', '2026-10-31');
    expect(s.rows.map((r) => r.kind)).toEqual(['invoice', 'payment', 'tds']);
    expect(s.closing).toBe(0);
  });
});

describe('privacy (FR-088, FR-090)', () => {
  it('TC-254 / TC-256 FR-088 AC1, AC3 delete when no financial documents', () => {
    const p = erasurePlan({ leadIds: ['L1'], contactRefs: [], quoteIds: ['Q1'], orderIds: [], financialDocCount: 0 });
    expect(p).toMatchObject({ mode: 'delete', deleteLeads: ['L1'], deleteQuotes: ['Q1'] });
  });
  it('TC-255 FR-088 AC2 anonymise when invoices exist', () => {
    const p = erasurePlan({ leadIds: [], contactRefs: [{ customerId: 'C1', contactId: 'k1' }], quoteIds: ['Q1'], orderIds: ['O1'], financialDocCount: 2 });
    expect(p).toMatchObject({ mode: 'anonymise', anonymiseQuotes: ['Q1'], deleteQuotes: [] });
  });
  it('TC-260 FR-090 AC1 more than 3 calendar months', () => {
    expect(isJunkPurgeDue('2026-08-01', '2026-11-02')).toBe(true);
    expect(isJunkPurgeDue('2026-08-15', '2026-11-15')).toBe(false);
    expect(isJunkPurgeDue('2026-08-15', '2026-11-16')).toBe(true);
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
});

describe('search (FR-083)', () => {
  const tokens = searchTokens({ names: ['Ravi Kumar'], phones: ['+919845012345'], docNumbers: ['INV/25-26/0142'], emails: ['R@X.com'] });
  it('TC-244 FR-083 AC1 phone in any format', () => {
    expect(tokens).toContain(queryToken('98450 12345'));
    expect(tokens).toContain(queryToken('+91 98450-12345'));
  });
  it('TC-245 FR-083 AC2 document number fragment', () => {
    expect(tokens).toContain(queryToken('0142'));
    expect(tokens).toContain(queryToken('INV/25-26/0142'));
  });
  it('names and emails', () => {
    expect(tokens).toContain(queryToken('rav'));
    expect(tokens).toContain(queryToken('r@x.com'));
    expect(queryToken('a')).toBeNull();
  });
});

describe('audit (RULE-012, FR-015)', () => {
  it('masks PII', () => {
    expect(maskValue('phone', '+919845012345')).toBe('+91*******345');
    expect(maskValue('email', 'ravi@x.com')).toBe('r***@x.com');
    expect(maskValue('name', 'Ravi Kumar')).toBe('R*** K***');
    expect(maskValue('address', '1 MG Road')).toBe('[redacted]');
    expect(maskValue('ip', '49.37.12.200')).toBe('49.37.12.x');
  });
  it('TC-057 FR-016 diff with masking, nested maps and arrays', () => {
    const c = diff(
      { phone: '+919845012345', stage: 'new', totals: { outstanding: 1 }, lines: [1], version: 1, billTo: { a: 1 } },
      { phone: '+919845012346', stage: 'contacted', totals: { outstanding: 2 }, lines: [1, 2, 3], version: 2, billTo: { a: 2 } },
    );
    expect(c).toEqual([
      { field: 'phone', before: '+91*******345', after: '+91*******346' },
      { field: 'stage', before: 'new', after: 'contacted' },
      { field: 'totals.outstanding', before: 1, after: 2 },
      { field: 'lines', before: '1 items', after: '3 items' },
      { field: 'billTo', before: '[redacted]', after: '[redacted]' },
    ]);
    expect(diff({ a: 'x'.repeat(300) }, { a: 'y' })[0]!.before).toHaveLength(201);
  });
});
