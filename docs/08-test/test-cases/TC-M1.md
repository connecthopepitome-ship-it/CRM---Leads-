# Test cases — M1 Install & configuration

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **API** · Risk: **Low**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-001 | FR-001 | AC1 | Must | Given a config file that passes schema validation, When the build runs for that client ID, Then the app is produced with the client's name, colours, logo and PWA manifest. | API | | Not run |
| TC-002 | FR-001 | AC2 | Must | Given a config file with a missing mandatory key or invalid value, When the build or provisioning runs, Then it stops with an error naming the key, and nothing is deployed. | API | | Not run |
| TC-003 | FR-001 | AC3 | Must | Given two client folders, When both are built, Then no file, setting or secret of one appears in the other's output. | API | | Not run |
| TC-004 | FR-002 | AC1 | Must | Given a valid client config and empty project, When provisioning runs, Then roles, number series, seed masters and one Admin user exist, and a run report lists every step as succeeded. | API | | Not run |
| TC-005 | FR-002 | AC2 | Must | Given provisioning is re-run on an already provisioned project, When it runs, Then existing data is not duplicated or overwritten (idempotent) and the report says "already present" per step. | API | | Not run |
| TC-006 | FR-002 | AC3 | Must | Given a step fails, When provisioning stops, Then the report names the failed step and re-running resumes from it. | API | | Not run |
| TC-007 | FR-003 | AC1 | Must | Given the Admin renames "Lead" to "Enquiry", When any user opens the app, Then menus, headings, buttons and empty states show "Enquiry". | API | | Not run |
| TC-008 | FR-003 | AC2 | Must | Given a new logo is uploaded, When a new document is issued, Then it uses the new logo; documents already issued keep their original branding, even when their payment block is refreshed (FR-068). | API | | Not run |
| TC-009 | FR-003 | AC3 | Must | Given a colour pair whose text contrast is below 4.5:1, When the Admin saves, Then the system warns and suggests an accessible alternative. | API | | Not run |
| TC-010 | FR-004 | AC1 | Must | Given Solo mode, When the user opens Settings or a lead, Then no team, assignment-rule or approval options are shown, and new leads are owned by the user. | API | | Not run |
| TC-011 | FR-004 | AC2 | Must | Given Solo mode with one active user, When the Admin tries to create a second active user, Then the system explains that Team mode is needed and offers to switch. | API | | Not run |
| TC-012 | FR-004 | AC3 | Must | Given Team mode with more than one active user, When the Admin tries to switch to Solo, Then it is blocked until only one active user remains. | API | | Not run |
| TC-013 | FR-004 | AC4 | Must | Given a module is switched off, When a user navigates or calls its API, Then it is hidden and the API returns "module not enabled". | API | | Not run |
| TC-014 | FR-005 | AC1 | Must | Given series `INV/{FY}/{0000}` with next number 142 in FY 2025-26, When an invoice is issued, Then it is numbered `INV/25-26/0142` and next becomes 143. | API | | Not run |
| TC-015 | FR-005 | AC2 | Must | Given two users issue invoices at the same moment, When both complete, Then they receive different consecutive numbers. | API | | Not run |
| TC-016 | FR-005 | AC3 | Must | Given the date crosses 1 April, When the first invoice of the new FY is issued, Then numbering restarts at 1 with the new FY token. | API | | Not run |
| TC-017 | FR-005 | AC4 | Must | Given a draft is deleted, When the next document is issued, Then no number is skipped (drafts hold no number). | API | | Not run |
| TC-018 | FR-005 | AC5 | Must | Given prefix "QUOTATION-WEB" with FY token and 4-digit padding, When the series is saved, Then it is rejected because numbers would exceed 16 characters. | API | | Not run |
| TC-019 | FR-005 | AC6 | Must | Given an invoice dated 28-03-2026 is issued on 02-04-2026, When numbered, Then it uses the FY 2025-26 series. | API | | Not run |
| TC-020 | FR-006 | AC1 | Must | Given release v1.1.0 with two new migrations, When deployed to an install on v1.0.0, Then both migrations run once in order and the install reports v1.1.0. | API | | Not run |
| TC-021 | FR-006 | AC2 | Must | Given a migration fails on one install, When the deploy continues, Then that install is left on its previous version, other installs proceed, and the failure is reported per install. | API | | Not run |
| TC-022 | FR-006 | AC3 | Must | Given the same release is deployed again, When it runs, Then no migration runs twice. | API | | Not run |
