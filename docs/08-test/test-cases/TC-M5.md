# Test cases — M5 Google & Sheet sync

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **API (fake Google)** · Risk: **High**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-109 | FR-037 | AC1 | Must | Given the Admin completes Google consent, When returning to Settings, Then status shows "Connected as <email>" with the granted features. | API (fake Google) | | Not run |
| TC-110 | FR-037 | AC2 | Must | Given the Admin declines one scope (e.g. Gmail), When returning, Then dependent features show "Not available — reconnect to enable" and others work. | API (fake Google) | | Not run |
| TC-111 | FR-037 | AC3 | Must | Given the Admin selects Disconnect, When confirmed, Then the token is revoked and deleted and dependent features stop with a clear message. | API (fake Google) | | Not run |
| TC-112 | FR-038 | AC1 | Must | Given a preview, When neither phone nor email is mapped, Then saving is blocked with "Map a Phone or Email column". | API (fake Google) | | Not run |
| TC-113 | FR-038 | AC2 | Must | Given the sheet's header row changes after mapping, When the next sync runs, Then rows are not imported, the sync is marked "Mapping needs attention", and the Admin is notified. | API (fake Google) | | Not run |
| TC-114 | FR-039 | AC1 | Must | Given webhook mode, When a row is added to the sheet, Then the lead exists in SaleSphere within 1 minute. | API (fake Google) | | Not run |
| TC-115 | FR-039 | AC2 | Must | Given polling mode at 4 minutes, When a row is added, Then the lead exists within 5 minutes. | API (fake Google) | | Not run |
| TC-116 | FR-039 | AC3 | Must | Given the webhook call fails, When the next poll safety-net runs (every 15 minutes in webhook mode), Then the row is still imported. | API (fake Google) | | Not run |
| TC-117 | FR-040 | AC1 | Must | Given webhook and poll process the same row at the same time, When both complete, Then exactly one lead exists. | API (fake Google) | | Not run |
| TC-118 | FR-040 | AC2 | Must | Given a previously imported (stamped) row is edited in the sheet, When the next sync runs, Then no new lead is created and the sync log records "changed after import — ignored". | API (fake Google) | | Not run |
| TC-119 | FR-040 | AC4 | Must | Given the sheet cannot be edited by the connected account, When the mapping is saved, Then saving is blocked with "SaleSphere needs edit access to mark imported rows". | API (fake Google) | | Not run |
| TC-120 | FR-040 | AC5 | Must | Given two identical rows (same values) are added, When synced, Then each row is stamped separately; the second is handled by dedupe (FR-029) as a re-enquiry. | API (fake Google) | | Not run |
| TC-121 | FR-040 | AC3 | Must | Given rows are deleted or re-sorted in the sheet, When the next sync runs, Then already-imported rows are not re-imported. | API (fake Google) | | Not run |
| TC-122 | FR-041 | AC1 | Should | Given write-back is on, When a row is imported, Then the "CRM Lead ID" cell is filled within one sync cycle. | API (fake Google) | | Not run |
| TC-123 | FR-041 | AC2 | Should | Given a write-back fails (e.g. sheet protected), When it happens, Then the import itself is not undone and the failure appears in the sync log. | API (fake Google) | | Not run |
| TC-124 | FR-042 | AC1 | Must | Given a row with an invalid phone and no email, When synced, Then it appears in the error queue with reason "No valid phone or email", and the run shows failed = 1. | API (fake Google) | | Not run |
| TC-125 | FR-042 | AC2 | Must | Given the Admin corrects the value in the queue and selects Retry, When processed, Then the lead is created and the error is closed. | API (fake Google) | | Not run |
| TC-126 | FR-043 | AC1 | Must | Given the Google token is revoked, When the next sync, upload or email attempt fails with an auth error, Then the Admin sees "Google connection lost — reconnect" within 15 minutes and sync status turns red. | API (fake Google) | | Not run |
| TC-127 | FR-043 | AC2 | Must | Given reconnection succeeds, When the next sync runs, Then rows added during the outage are imported. | API (fake Google) | | Not run |
