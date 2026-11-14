# Test cases — M14 Dashboard & reports

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **API+E2E** · Risk: **Medium**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-247 | FR-084 | AC1 | Must | Given a Sales Executive, When Home opens, Then all tiles show only their own data. | API+E2E | | Not run |
| TC-248 | FR-084 | AC2 | Must | Given a tile is tapped, When opened, Then the underlying filtered list is shown. | API+E2E | | Not run |
| TC-249 | FR-085 | AC1 | Must | Given the Collections & ageing report for "as of 30-11-2026", When run, Then each customer's outstanding is split into Not yet due, 1–30, 31–60, 61–90 and 90+ buckets whose sum equals their outstanding (excluding on-account advances, shown separately). | API+E2E | | Not run |
| TC-250 | FR-085 | AC2 | Must | Given Export is selected, When the file downloads, Then it contains the same rows and columns as on screen and the export is audited. | API+E2E | | Not run |
