# Test cases — M10 Payments

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **Unit+API+E2E** · Risk: **High**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-206 | FR-070 | AC1 | Must | Given an invoice with balance ₹28,380, When "Record payment" is opened from it, Then amount = ₹28,380 and the invoice is pre-selected for allocation. | Unit+API+E2E | | Not run |
| TC-207 | FR-070 | AC2 | Must | Given a UTR already recorded on another payment, When saved, Then the user is warned "UTR already used on RCPT/…"; only Admin/Accounts can override with a reason. | Unit+API+E2E | | Not run |
| TC-208 | FR-070 | AC3 | Must | Given a future payment date, When saved, Then it is rejected. | Unit+API+E2E | | Not run |
| TC-209 | FR-070 | AC4 | Must | Given a network retry submits the same payment twice, When processed, Then only one payment exists (idempotency key). | Unit+API+E2E | | Not run |
| TC-210 | FR-071 | AC1 | Must | Given invoices A (₹10,000, due 1 Nov) and B (₹15,000, due 10 Nov) and a ₹20,000 payment, When auto-allocated, Then A = paid, B balance = ₹5,000. | Unit+API+E2E | | Not run |
| TC-211 | FR-071 | AC2 | Must | Given a ₹30,000 payment against ₹25,000 outstanding, When saved, Then ₹5,000 is kept as advance and shown in Customer 360. | Unit+API+E2E | | Not run |
| TC-212 | FR-071 | AC3 | Must | Given ₹9,000 received and ₹1,000 TDS on a ₹10,000 invoice, When allocated, Then the invoice is fully settled and TDS ₹1,000 is reported separately. | Unit+API+E2E | | Not run |
| TC-213 | FR-071 | AC4 | Must | Given manual allocations exceeding the payment amount, When saved, Then it is rejected. | Unit+API+E2E | | Not run |
| TC-214 | FR-072 | AC1 | Must | Given a payment is saved, When complete, Then a receipt RCPT/25-26/nnnn exists and "Share receipt" is offered. | Unit+API+E2E | | Not run |
| TC-215 | FR-073 | AC1 | Must | Given a payment allocated to invoice A, When reversed, Then A's balance is restored, the QR on A shows the restored amount, and the receipt shows "Cancelled — <reason>". | Unit+API+E2E | | Not run |
| TC-216 | FR-073 | AC2 | Must | Given a Sales Executive, When they open a payment, Then Reverse is not available. | Unit+API+E2E | | Not run |
