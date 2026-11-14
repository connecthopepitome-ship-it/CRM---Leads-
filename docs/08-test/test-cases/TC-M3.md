# Test cases — M3 Master data

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **API** · Risk: **Low**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-059 | FR-017 | AC1 | Must | Given a GSTIN whose first two digits do not match the selected state's GST code, When saved, Then it is rejected with "GSTIN does not match state". | API | | Not run |
| TC-060 | FR-017 | AC2 | Must | Given the company is marked "Not GST-registered", When invoices are created, Then only Bill of Supply and Proforma types are offered (FR-063). | API | | Not run |
| TC-061 | FR-018 | AC1 | Must | Given a VPA without "@" or with spaces, When saved, Then it is rejected with an example of a valid UPI ID. | API | | Not run |
| TC-062 | FR-018 | AC2 | Must | Given a second UPI ID is marked default, When saved, Then the previous default is unset. | API | | Not run |
| TC-063 | FR-018 | AC3 | Must | Given an IFSC not matching `^[A-Z]{4}0[A-Z0-9]{6}$`, When saved, Then it is rejected. | API | | Not run |
| TC-064 | FR-019 | AC1 | Must | Given a duplicate item code, When saved, Then it is rejected. | API | | Not run |
| TC-065 | FR-019 | AC2 | Must | Given the company is GST-registered and HSN/SAC is blank, When the item is saved, Then the system warns that it cannot be used on a tax invoice until filled. | API | | Not run |
| TC-066 | FR-019 | AC3 | Must | Given an item used on any document, When the user tries to delete it, Then only deactivation is offered. | API | | Not run |
| TC-067 | FR-020 | AC1 | Must | Given a lock date of 31-03-2026, When any user creates, edits or issues a document dated on or before it, Then the action is refused with "Period locked". | API | | Not run |
| TC-068 | FR-020 | AC2 | Must | Given payment mode "UPI" with reference required, When a payment in UPI mode is saved without UTR, Then it is rejected. | API | | Not run |
| TC-069 | FR-021 | AC1 | Must | Given a template containing an unknown variable, When saved, Then it is rejected listing the valid variables. | API | | Not run |
| TC-070 | FR-021 | AC2 | Must | Given a template is used, When a variable has no value for that record, Then it is replaced by an empty string and the user sees the preview before sending. | API | | Not run |
| TC-071 | FR-022 | AC1 | Must | Given a stage is in use by open leads, When the Admin tries to delete it, Then they must choose a stage to move those leads to, or deactivate instead. | API | | Not run |
| TC-072 | FR-022 | AC2 | Must | Given stages are reordered, When saved, Then Kanban columns follow the new order. | API | | Not run |
| TC-073 | FR-023 | AC1 | Must | Given a file with 100 rows of which 3 have invalid GSTINs, When imported, Then a preview shows 97 valid and 3 failed with reasons, and only on confirmation are the 97 created. | API | | Not run |
| TC-074 | FR-023 | AC2 | Must | Given a row whose code matches an existing product, When "update existing" is chosen, Then that product is updated; otherwise it is skipped. | API | | Not run |
| TC-075 | FR-023 | AC3 | Must | Given a file over 5,000 rows, When uploaded, Then it is rejected with "Split into files of up to 5,000 rows". | API | | Not run |
| TC-076 | FR-024 | AC1 | Must | Given a deactivated tax rate, When a user creates a new quotation line, Then that rate is not offered, but existing documents still display it. | API | | Not run |
