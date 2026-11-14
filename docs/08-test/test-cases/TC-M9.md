# Test cases — M9 Invoices & UPI QR

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **Unit+API+E2E** · Risk: **High**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-184 | FR-062 | AC1 | Must | Given pending 6 units, When the user enters 7 on the invoice, Then it is refused with "Only 6 left to invoice". | Unit+API+E2E | | Not run |
| TC-185 | FR-062 | AC2 | Must | Given payment terms "Net 15" and invoice date 01-12-2026, When created, Then the due date is 16-12-2026. | Unit+API+E2E | | Not run |
| TC-186 | FR-063 | AC1 | Must | Given a GST-registered company, When creating an invoice, Then Tax Invoice and Proforma are offered. | Unit+API+E2E | | Not run |
| TC-187 | FR-063 | AC2 | Must | Given a proforma is converted, When the tax invoice is issued, Then the proforma shows "Converted to INV/…" and is excluded from outstanding. | Unit+API+E2E | | Not run |
| TC-188 | FR-064 | AC1 | Must | Given company in Karnataka (29) and place of supply Karnataka, When issued, Then CGST and SGST appear; given Maharashtra (27), Then IGST appears. | Unit+API+E2E | | Not run |
| TC-189 | FR-064 | AC2 | Must | Given a tax invoice line without HSN/SAC, When the user issues the invoice, Then issuing is blocked naming the line. | Unit+API+E2E | | Not run |
| TC-190 | FR-065 | AC1 | Must | Given an issued invoice, When any user tries to edit lines or amounts, Then editing is not available; only notes/attachments may be added. | Unit+API+E2E | | Not run |
| TC-191 | FR-065 | AC2 | Must | Given two users edit the same draft, When the second saves an older version, Then it is refused with "Changed by <user> — reload". | Unit+API+E2E | | Not run |
| TC-192 | FR-065 | AC3 | Must | Given Issue fails before the number and status are committed (e.g. validation or network error), When the user retries, Then no number has been consumed and the invoice is still a Draft. | Unit+API+E2E | | Not run |
| TC-193 | FR-066 | AC1 | Must | Given a ₹10,000 invoice with no payments, When a full credit note is issued, Then balance = 0, the invoice shows "Cancelled by CN/25-26/0003", and the order's pending quantity is restored. | Unit+API+E2E | | Not run |
| TC-194 | FR-066 | AC2 | Must | Given a ₹10,000 invoice with ₹6,000 paid, When a ₹6,000 credit note is issued, Then balance = 0 and ₹2,000 becomes the customer's on-account credit. | Unit+API+E2E | | Not run |
| TC-195 | FR-067 | AC1 | Must | Given an invoice with 40 lines, When rendered, Then it spans pages with repeated table header and "Page x of y" on each. | Unit+API+E2E | | Not run |
| TC-196 | FR-067 | AC2 | Must | Given QR is switched off for the template, When rendered, Then the payment block shows bank details only. | Unit+API+E2E | | Not run |
| TC-197 | FR-068 | AC1 | Must | Given invoice INV/25-26/0142, balance ₹48,380.00, UPI `acme@okhdfcbank`, payee "Acme Interiors", When rendered, Then the QR decodes to `upi://pay?pa=acme@okhdfcbank&pn=Acme%20Interiors&am=48380.00&cu=INR&tn=INV%2F25-26%2F0142&tr=INV2526-0142`. | Unit+API+E2E | | Not run |
| TC-198 | FR-068 | AC2 | Must | Given a part payment of ₹20,000 is recorded, When the invoice is re-shared, Then the QR amount is ₹28,380.00. | Unit+API+E2E | | Not run |
| TC-199 | FR-068 | AC3 | Must | Given balance = 0, When rendered, Then no QR is shown and a PAID stamp appears. | Unit+API+E2E | | Not run |
| TC-200 | FR-068 | AC4 | Must | Given no UPI ID is configured, When rendered, Then no QR is shown and bank details are shown if configured. | Unit+API+E2E | | Not run |
| TC-201 | FR-068 | AC5 | Must | Given the web view is opened on a phone, When "Pay via UPI" is tapped, Then the device offers installed UPI apps. | Unit+API+E2E | | Not run |
| TC-202 | FR-068 | AC6 | Must | Given a payee name of 60 characters, When the payload is built, Then `pn` carries the first 50 characters, URL-encoded. | Unit+API+E2E | | Not run |
| TC-203 | FR-068 | AC7 | Must | Given `tr` is switched off for the UPI ID, When rendered, Then the payload omits `tr` and keeps `tn`. | Unit+API+E2E | | Not run |
| TC-204 | FR-068 | AC8 | Must | Given a proforma invoice, When rendered, Then the QR amount is the proforma grand total, or the advance % of the payment term when one is set (RULE-037). | Unit+API+E2E | | Not run |
| TC-205 | FR-069 | AC1 | Must | Given an invoice is shared on WhatsApp, When the customer opens the link a week later after a part payment, Then the page shows the updated balance and QR. | Unit+API+E2E | | Not run |
