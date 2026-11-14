# Test cases — M8 Sales orders

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **API** · Risk: **Medium**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-176 | FR-059 | AC1 | Must | Given an accepted quote, When "Create order" is selected, Then an order with identical lines and totals is created, numbered, and linked to the quote. | API | | Not run |
| TC-177 | FR-059 | AC2 | Must | Given an order already exists for that quote, When "Create order" is selected again, Then the existing order is opened instead. | API | | Not run |
| TC-178 | FR-059 | AC3 | Must | Given a Sent (not accepted) quote, When the user creates an order, Then they must confirm "Mark as accepted on customer's behalf" with a note, which is audited. | API | | Not run |
| TC-179 | FR-059 | AC4 | Must | Given the Sales Orders module is switched off (e.g. Solo freelancer), When the user selects "Create invoice" on an accepted quote, Then an order is created in the background (hidden from navigation) and the invoice is raised from it, so invoiced-vs-pending still reconciles (Q-021). | API | | Not run |
| TC-180 | FR-060 | AC1 | Must | Given an order with an issued, not fully credited invoice, When the user tries to cancel it, Then it is blocked with "Credit the invoices first". | API | | Not run |
| TC-181 | FR-060 | AC2 | Must | Given all lines are fully invoiced and paid, When the order is Delivered, Then the user is prompted to Close it. | API | | Not run |
| TC-182 | FR-061 | AC1 | Must | Given an order of 10 units with 4 invoiced, When viewed, Then pending shows 6 units and invoiced 40 %. | API | | Not run |
| TC-183 | FR-061 | AC2 | Must | Given a credit note cancels 2 invoiced units, When viewed, Then invoiced becomes 2 and pending 8. | API | | Not run |
