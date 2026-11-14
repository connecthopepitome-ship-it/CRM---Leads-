# Test cases — M13 App experience

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **E2E** · Risk: **Medium**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-233 | FR-080 | AC1 | Must | Given Android Chrome, When the user opens the app twice, Then an "Install app" prompt is offered and the installed app opens full-screen with the client icon. | E2E | | Not run |
| TC-234 | FR-080 | AC2 | Must | Given iOS Safari, When the user opens the app, Then an install guide ("Share → Add to Home Screen") is shown once. | E2E | | Not run |
| TC-235 | FR-080 | AC3 | Must | Given a lead row on a phone, When swiped right, Then the Call flow (FR-044) starts. | E2E | | Not run |
| TC-236 | FR-080 | AC4 | Must | Given the device is in dark mode, When the app opens, Then the dark theme is applied with text contrast ≥ 4.5:1. | E2E | | Not run |
| TC-237 | FR-081 | AC1 | Must | Given the phone is offline, When the user opens a recently viewed lead, Then its details and timeline (as last synced) are shown with an "Offline" banner. | E2E | | Not run |
| TC-238 | FR-081 | AC2 | Must | Given a call outcome saved offline, When connectivity returns, Then it syncs within 1 minute and the "pending" badge clears. | E2E | | Not run |
| TC-239 | FR-081 | AC3 | Must | Given the user tries to create an invoice offline, When tapped, Then the app explains "Needs internet connection". | E2E | | Not run |
| TC-240 | FR-081 | AC4 | Must | Given a queued note's lead was reassigned in the meantime, When it syncs, Then the note is still added to the lead's timeline under the author's name. | E2E | | Not run |
| TC-241 | FR-082 | AC1 | Must | Given a lead is assigned to Priya with push enabled, When assignment completes, Then Priya's device shows "New lead: <name> from <source>" within 1 minute, opening the lead on tap. | E2E | | Not run |
| TC-242 | FR-082 | AC2 | Must | Given push permission is denied, When an event occurs, Then it still appears in the in-app notification centre. | E2E | | Not run |
| TC-243 | FR-082 | AC3 | Must | Given Priya opts out of "Quote viewed", When a quote is viewed, Then no push is sent but the in-app item is created. | E2E | | Not run |
| TC-244 | FR-083 | AC1 | Must | Given a customer with phone +919845012345, When the user searches "98450 12345", Then the customer is found. | E2E | | Not run |
| TC-245 | FR-083 | AC2 | Must | Given the user searches "0142", When results appear, Then invoice INV/25-26/0142 is listed. | E2E | | Not run |
| TC-246 | FR-083 | AC3 | Must | Given a Sales Executive searches a name owned by another executive, When results appear, Then that record is not listed. | E2E | | Not run |
