# Test cases — M12 Documents

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **API** · Risk: **Medium**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-225 | FR-077 | AC1 | Must | Given a new customer's first document, When generated, Then the customer folder and subfolders exist and the PDF is in the right subfolder. | API | | Not run |
| TC-226 | FR-077 | AC2 | Must | Given a lead converts to a customer, When files exist in the lead folder, Then they are moved to the customer's Documents folder. | API | | Not run |
| TC-227 | FR-078 | AC1 | Must | Given a 30 MB file, When uploaded, Then it is rejected with "Files must be 25 MB or smaller". | API | | Not run |
| TC-228 | FR-078 | AC2 | Must | Given an `.exe` file, When uploaded, Then it is rejected. | API | | Not run |
| TC-229 | FR-078 | AC3 | Must | Given a user without access to the record, When they request the file URL, Then access is refused. | API | | Not run |
| TC-230 | FR-078 | AC4 | Must | Given the upload is interrupted, When the connection returns within the session, Then the upload resumes. | API | | Not run |
| TC-231 | FR-079 | AC1 | Must | Given a revoked link, When opened, Then the page shows "This link is no longer active — contact <company>". | API | | Not run |
| TC-232 | FR-079 | AC2 | Must | Given a share link, When opened, Then only that document is visible and no other record or navigation is reachable. | API | | Not run |
