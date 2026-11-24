-- Schema for SaleSphere CRM Cloudflare D1 Database
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  stage TEXT NOT NULL DEFAULT 'new',
  sla_status TEXT NOT NULL DEFAULT 'pending',
  sla_due_at TEXT,
  expected_value REAL,
  notes TEXT,
  customer_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  legal_name TEXT,
  gstin TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  data_json TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  display_number TEXT NOT NULL,
  party_type TEXT NOT NULL DEFAULT 'customer',
  party_id TEXT NOT NULL,
  party_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  date TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  grand_total REAL NOT NULL DEFAULT 0,
  sub_total REAL NOT NULL DEFAULT 0,
  taxable REAL NOT NULL DEFAULT 0,
  cgst REAL NOT NULL DEFAULT 0,
  sgst REAL NOT NULL DEFAULT 0,
  igst REAL NOT NULL DEFAULT 0,
  data_json TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  quote_id TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  date TEXT NOT NULL,
  expected_delivery TEXT,
  grand_total REAL NOT NULL DEFAULT 0,
  data_json TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  order_id TEXT,
  type TEXT NOT NULL DEFAULT 'tax_invoice',
  status TEXT NOT NULL DEFAULT 'issued',
  date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  grand_total REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  credited_amount REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  data_json TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  receipt_no TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  invoice_id TEXT,
  date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  tds_amount REAL NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'neft',
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  advance REAL NOT NULL DEFAULT 0,
  data_json TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS timeline (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT,
  user_name TEXT NOT NULL DEFAULT 'Owner Admin',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  party_name TEXT,
  type TEXT NOT NULL DEFAULT 'call',
  due_at TEXT NOT NULL,
  note TEXT,
  assignee TEXT DEFAULT 'Owner Admin',
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_record ON follow_ups(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_due ON follow_ups(due_at);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  link TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS masters (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  key TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_default INTEGER NOT NULL DEFAULT 0,
  data_json TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  password_hash TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  record_type TEXT,
  record_id TEXT,
  changes_json TEXT,
  ip_masked TEXT
);

-- Seed initial records
INSERT OR IGNORE INTO leads (id, name, company, phone, email, city, stage, sla_status, sla_due_at, expected_value, created_at, updated_at)
VALUES
  ('lead-1', 'Sharma Textiles', 'Sharma Textiles Ltd', '+91 98450 11108', 'contact@sharmatextiles.in', 'Kochi', 'new', 'met', '2026-11-20T10:15:00Z', 35000000, '2026-11-20T10:00:00Z', '2026-11-20T10:00:00Z'),
  ('lead-2', 'Iyer Consultancy', 'Iyer Consultancy LLP', '+91 94480 98765', 'rajesh@iyerconsulting.com', 'Bengaluru', 'contacted', 'met', '2026-11-18T14:45:00Z', 24000000, '2026-11-18T14:30:00Z', '2026-11-18T14:30:00Z'),
  ('lead-3', 'Nair Foods', 'Nair Foods International', '+91 98200 55443', 'mohan@nairfoods.in', 'Navi Mumbai', 'interested', 'met', '2026-11-15T09:30:00Z', 18000000, '2026-11-15T09:15:00Z', '2026-11-15T09:15:00Z');

INSERT OR IGNORE INTO customers (id, code, display_name, legal_name, gstin, phone, email, address, city, state, data_json, created_at, updated_at)
VALUES
  ('cust-1', 'C-0001', 'Sharma Textiles', 'Sharma Textiles Private Limited', '27AABCD1234F1Z5', '+91 98450 11108', 'contact@sharmatextiles.in', 'MG Road, Ernakulam, Kochi', 'Kochi', 'Kerala', '{"contacts":[{"id":"cnt-1","name":"Ramesh Sharma","role":"Director","phone":"+91 98450 11108","email":"ramesh@sharmatextiles.in","isPrimary":true}],"addresses":[{"line1":"MG Road, Ernakulam","city":"Kochi"}]}', '2026-11-10T10:00:00Z', '2026-11-10T10:00:00Z'),
  ('cust-2', 'C-0002', 'Iyer Consultancy', 'Iyer Consulting Services LLP', '29AAACI9876Q1Z2', '+91 94480 98765', 'rajesh@iyerconsulting.com', 'Outer Ring Road, Bengaluru', 'Bengaluru', 'Karnataka', '{"contacts":[{"id":"cnt-2","name":"Rajesh Iyer","role":"Managing Partner","phone":"+91 94480 98765","email":"rajesh@iyerconsulting.com","isPrimary":true}],"addresses":[{"line1":"Outer Ring Road","city":"Bengaluru"}]}', '2026-11-12T10:00:00Z', '2026-11-12T10:00:00Z');

INSERT OR IGNORE INTO quotes (id, display_number, party_type, party_id, party_name, status, date, valid_until, grand_total, sub_total, taxable, cgst, sgst, igst, data_json, created_at, updated_at)
VALUES
  ('qt-1', 'QT/26-27/0001', 'customer', 'cust-1', 'Sharma Textiles', 'accepted', '2026-11-14', '2026-11-29', 2950000, 2500000, 2500000, 225000, 225000, 0, '{"lines":[{"id":"ln-1","kind":"item","description":"Enterprise CRM Implementation","qty":1,"rate":2500000,"amount":2500000,"taxRatePct":18}],"pdf":{"status":"ready"},"revisions":[]}', '2026-11-14T10:00:00Z', '2026-11-14T10:00:00Z');

INSERT OR IGNORE INTO orders (id, number, customer_id, customer_name, quote_id, status, date, expected_delivery, grand_total, data_json, created_at, updated_at)
VALUES
  ('ord-1', 'SO/26-27/0001', 'cust-1', 'Sharma Textiles', 'qt-1', 'confirmed', '2026-11-15', '2026-12-15', 2950000, '{"lines":[{"id":"oln-1","kind":"item","description":"Enterprise CRM Implementation","qty":1,"unit":"service","invoicedQty":1,"pendingQty":0}]}', '2026-11-15T10:00:00Z', '2026-11-15T10:00:00Z');

INSERT OR IGNORE INTO invoices (id, number, customer_id, customer_name, order_id, type, status, date, due_date, grand_total, paid_amount, credited_amount, balance_due, data_json, created_at, updated_at)
VALUES
  ('inv-1', 'INV/26-27/0001', 'cust-1', 'Sharma Textiles', 'ord-1', 'tax_invoice', 'paid', '2026-11-15', '2026-11-30', 2950000, 2950000, 0, 0, '{"lines":[{"id":"ln-1","kind":"item","description":"Enterprise CRM Implementation","qty":1,"rate":2500000,"amount":2500000,"taxRatePct":18}],"pdf":{"status":"ready"},"creditNotes":[]}', '2026-11-15T11:00:00Z', '2026-11-15T11:00:00Z');

INSERT OR IGNORE INTO payments (id, receipt_no, customer_id, customer_name, invoice_id, date, amount, tds_amount, mode, reference, status, advance, data_json, created_at, updated_at)
VALUES
  ('pay-1', 'RCT/26-27/0001', 'cust-1', 'Sharma Textiles', 'inv-1', '2026-11-15', 2950000, 0, 'neft', 'NEFT98234710', 'active', 0, '{"allocations":[{"invoiceId":"inv-1","number":"INV/26-27/0001","amount":2950000}]}', '2026-11-15T12:00:00Z', '2026-11-15T12:00:00Z');

INSERT OR IGNORE INTO notifications (id, title, message, is_read, link, created_at)
VALUES
  ('notif-1', 'Payment Recorded', 'Payment of ₹29,500 recorded for Sharma Textiles against INV/26-27/0001.', 0, '/sales/payments/pay-1', '2026-11-15T12:05:00Z'),
  ('notif-2', 'Quotation Accepted', 'Quotation QT/26-27/0001 was accepted by Sharma Textiles.', 1, '/sales/quotes/qt-1', '2026-11-14T15:30:00Z');

INSERT OR IGNORE INTO users (id, username, full_name, role, status, created_at)
VALUES
  ('u_admin', 'admin', 'Owner Admin', 'admin', 'active', '2026-11-01T00:00:00Z'),
  ('u_sales_mgr', 'manager', 'Suresh Kumar', 'sales_manager', 'active', '2026-11-01T00:00:00Z');

