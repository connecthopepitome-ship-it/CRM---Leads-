-- Schema and migration for Payments & Credit Notes
CREATE TABLE IF NOT EXISTS allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment ON allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_invoice ON allocations(invoice_id);

INSERT OR IGNORE INTO allocations (id, payment_id, invoice_id, amount, created_at, updated_at)
VALUES ('alloc-1', 'pay-1', 'inv-1', 2950000, '2026-11-15T12:00:00Z', '2026-11-15T12:00:00Z');

CREATE TABLE IF NOT EXISTS credit_notes (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  invoice_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  date TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'partial',
  amount REAL NOT NULL DEFAULT 0,
  taxable_amount REAL NOT NULL DEFAULT 0,
  cgst REAL NOT NULL DEFAULT 0,
  sgst REAL NOT NULL DEFAULT 0,
  igst REAL NOT NULL DEFAULT 0,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  data_json TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer ON credit_notes(customer_id);

CREATE TABLE IF NOT EXISTS number_series (
  prefix TEXT PRIMARY KEY,
  current_seq INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO number_series (prefix, current_seq, updated_at)
VALUES 
  ('RCT/26-27/', 1, '2026-11-27T04:00:00Z'),
  ('CN/26-27/', 0, '2026-11-27T04:00:00Z'),
  ('INV/26-27/', 13, '2026-11-27T04:00:00Z');

CREATE INDEX IF NOT EXISTS idx_payments_receipt_no ON payments(receipt_no);
CREATE INDEX IF NOT EXISTS idx_payments_customer_ref ON payments(customer_id, reference, mode);

-- Cleanup test records as per requirement 13
DELETE FROM invoices WHERE number IN ('INV/26-27/0011', 'INV/26-27/0012', 'INV/26-27/0013');
DELETE FROM customers WHERE id = 'cust-1795698050107';
DELETE FROM payments WHERE id = 'pay-1795698148143';

-- Data correction for partial credit note bug fix
UPDATE invoices SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id IN ('inv-1795755484855', 'inv-1795756110436') AND paid_amount + credited_amount >= grand_total;
UPDATE customers SET state = 'Maharashtra', data_json = '{"contacts":[],"addresses":[],"billing":null,"stateCode":"27","territoryId":null,"customerGroupId":null,"tags":[]}' WHERE id = 'cust-1795756110153';


