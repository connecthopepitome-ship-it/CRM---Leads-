# Test cases — M15 Privacy & retention

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **Unit+API** · Risk: **High**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-251 | FR-086 | AC1 | Must | Given a lead from the web form with consent ticked, When saved, Then consent basis = "Web-form consent" with timestamp. | Unit+API | | Not run |
| TC-252 | FR-086 | AC2 | Must | Given a CSV import, When rows are created, Then consent basis = "Imported by business" and the importing user is recorded. | Unit+API | | Not run |
| TC-253 | FR-087 | AC1 | Must | Given a phone number, When "Export personal data" runs, Then a file lists every lead, contact and activity for that phone and the action is audited. | Unit+API | | Not run |
| TC-254 | FR-088 | AC1 | Must | Given a lead with no quotes or invoices, When erased, Then the lead, its activities and files are deleted and only a non-personal tombstone (ID, date, "erased on request") remains in the audit log. | Unit+API | | Not run |
| TC-255 | FR-088 | AC2 | Must | Given a contact on an issued invoice, When erased, Then the invoice keeps the billed name and address, while the contact's phone, email, notes and activities are removed. | Unit+API | | Not run |
| TC-256 | FR-088 | AC3 | Must | Given a lead with a quotation but no invoice, When erased, Then the lead, quotation and files are deleted. | Unit+API | | Not run |
| TC-257 | FR-088 | AC4 | Must | Given audit entries for the erased person, When viewed, Then they show only masked values (RULE-012). | Unit+API | | Not run |
| TC-258 | FR-089 | AC1 | Must | Given the Admin enables support access for 2 days, When 2 days pass, Then the support user is disabled and its sessions are revoked. | Unit+API | | Not run |
| TC-259 | FR-089 | AC2 | Must | Given a Solo-mode install, When the Admin enables support access, Then it is allowed and the install stays in Solo mode. | Unit+API | | Not run |
| TC-260 | FR-090 | AC1 | Must | Given a lead marked Junk on 01-08-2026, When the purge runs on 02-11-2026, Then the lead is deleted; a lead marked Junk on 15-08-2026 remains until the run on 16-11-2026. | Unit+API | | Not run |
| TC-261 | FR-090 | AC2 | Must | Given a Junk lead is reopened before 3 months, When the purge runs, Then it is not deleted. | Unit+API | | Not run |
