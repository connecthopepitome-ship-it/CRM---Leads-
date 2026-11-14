# Test cases — M11 Customers & Customer 360

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **Unit+API** · Risk: **Medium**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-217 | FR-074 | AC1 | Must | Given a GSTIN is entered, When saved, Then its state code must match the billing address state. | Unit+API | | Not run |
| TC-218 | FR-074 | AC2 | Must | Given a customer already has the same GSTIN, When a new customer is saved, Then the user is warned of the possible duplicate. | Unit+API | | Not run |
| TC-219 | FR-075 | AC1 | Must | Given a payment is recorded, When Customer 360 is reopened, Then Total received, Outstanding and Overdue reflect it immediately. | Unit+API | | Not run |
| TC-220 | FR-075 | AC2 | Must | Given an invoice 45 days past due, When the Invoices tab is viewed, Then it is in the 31–60 bucket. | Unit+API | | Not run |
| TC-221 | FR-075 | AC3 | Must | Given a Project Manager, When opening Customer 360, Then profile, Orders, Quotations, Activities and Documents are shown, while financial KPI tiles and the Invoices, Payments and Ledger tabs are not shown (§3.2). | Unit+API | | Not run |
| TC-222 | FR-076 | AC1 | Must | Given opening balance ₹10,000, invoices ₹20,000, payments ₹15,000 in range, When produced, Then closing balance = ₹15,000. | Unit+API | | Not run |
| TC-223 | FR-076 | AC2 | Must | Given proforma invoices exist, When the statement is produced, Then they are excluded. | Unit+API | | Not run |
| TC-224 | FR-076 | AC3 | Must | Given a ₹10,000 invoice settled by ₹9,000 payment + ₹1,000 TDS, When the statement is produced, Then it shows the invoice debit, the payment credit and a separate TDS credit, and the closing balance is ₹0. | Unit+API | | Not run |
