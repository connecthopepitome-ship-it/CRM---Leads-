# Test cases — M4 Leads

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **Unit+API** · Risk: **Medium**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-077 | FR-025 | AC1 | Must | Given name and neither phone nor email, When saved, Then it is rejected with "Add a phone number or email". | Unit+API | | Not run |
| TC-078 | FR-025 | AC2 | Must | Given the phone matches an existing lead, When saved, Then the user is shown the existing lead and can open it or add this as a re-enquiry (FR-029). | Unit+API | | Not run |
| TC-079 | FR-025 | AC3 | Must | Given a Sales Executive creates a lead in Team mode, When saved, Then the executive is the owner unless they choose "assign automatically". | Unit+API | | Not run |
| TC-080 | FR-026 | AC1 | Must | Given a file with 2 rows duplicating existing leads by phone, When imported, Then those 2 are merged as re-enquiries and reported as "merged". | Unit+API | | Not run |
| TC-081 | FR-026 | AC2 | Must | Given two rows within the same file share a phone, When imported, Then one lead is created and the second is merged into it. | Unit+API | | Not run |
| TC-082 | FR-027 | AC1 | Must | Given a valid webhook call with API key and idempotency key, When the same call is repeated within 24 h, Then only one lead exists and the second call returns the first lead's ID. | Unit+API | | Not run |
| TC-083 | FR-027 | AC2 | Must | Given an invalid or revoked API key on the webhook, When called, Then it is rejected with 401 and no lead is created. | Unit+API | | Not run |
| TC-084 | FR-027 | AC5 | Must | Given a form submission from an origin not on the allowed list, or with the honeypot filled, When received, Then it is rejected silently (no lead) and counted in the source's spam log. | Unit+API | | Not run |
| TC-085 | FR-027 | AC3 | Must | Given the embedded form, When submitted without ticking the consent checkbox (if configured as required), Then it is not accepted. | Unit+API | | Not run |
| TC-086 | FR-027 | AC4 | Must | Given more than 60 submissions per minute from one source, When exceeded, Then extra requests are rejected with 429. | Unit+API | | Not run |
| TC-087 | FR-028 | AC1 | Must | Given phone "098450 12345", When saved, Then it is stored as "+919845012345". | Unit+API | | Not run |
| TC-088 | FR-028 | AC2 | Must | Given phone "12345", When saved, Then it is stored as entered, flagged "Check number", and excluded from phone dedupe. | Unit+API | | Not run |
| TC-089 | FR-029 | AC1 | Must | Given an open lead with phone +919845012345, When a Sheet row arrives with the same phone, Then no new lead is created, a "Re-enquired via Google Sheet" activity is added, and the owner is notified. | Unit+API | | Not run |
| TC-090 | FR-029 | AC2 | Must | Given the match is a lead in Lost stage, When a new enquiry arrives, Then the lead is reopened to New, keeps its owner if active, and gets a "Re-enquired" activity. | Unit+API | | Not run |
| TC-091 | FR-029 | AC3 | Must | Given the match is a contact of customer "Acme", When the enquiry arrives, Then a new lead linked to Acme is created and labelled "Existing customer". | Unit+API | | Not run |
| TC-092 | FR-030 | AC1 | Should | Given leads L1 and L2, When merged with L1 surviving, Then L2's activities appear on L1's timeline and opening L2 redirects to L1. | Unit+API | | Not run |
| TC-093 | FR-031 | AC1 | Must | Given round-robin among A, B, C and the last lead went to B, When a new lead arrives, Then it is assigned to C. | Unit+API | | Not run |
| TC-094 | FR-031 | AC2 | Must | Given a territory rule "560001–560099 → Team South" and a lead with pincode 560034, When it arrives, Then it is assigned within Team South. | Unit+API | | Not run |
| TC-095 | FR-031 | AC3 | Must | Given all eligible users are inactive, When a lead arrives, Then it is assigned to the default owner and flagged "Unassigned rule fallback". | Unit+API | | Not run |
| TC-096 | FR-031 | AC4 | Must | Given Solo mode, When any lead arrives, Then it is owned by the single user. | Unit+API | | Not run |
| TC-097 | FR-032 | AC1 | Must | Given 50 selected leads, When reassigned to user D, Then all 50 show owner D, each gets an activity, and D receives one summary notification. | Unit+API | | Not run |
| TC-098 | FR-032 | AC2 | Must | Given 3 of the selected leads are outside the manager's team scope, When the bulk action runs, Then those 3 are skipped and reported. | Unit+API | | Not run |
| TC-099 | FR-033 | AC1 | Must | Given a lead, When the user selects Lost without a reason, Then the change is refused until a reason is chosen. | Unit+API | | Not run |
| TC-100 | FR-033 | AC2 | Must | Given a lead, When the user tries to set Won directly, Then they are directed to "Convert to customer". | Unit+API | | Not run |
| TC-101 | FR-033 | AC3 | Must | Given a stage change, When saved, Then a "Stage: Contacted → Interested" activity with user and time is added. | Unit+API | | Not run |
| TC-102 | FR-034 | AC1 | Must | Given a saved filter "My hot leads", When the user reopens the app, Then the filter is available in one tap. | Unit+API | | Not run |
| TC-103 | FR-034 | AC2 | Must | Given a card is dragged to "Lost", When dropped, Then the lost-reason prompt appears before the move is saved. | Unit+API | | Not run |
| TC-104 | FR-034 | AC3 | Must | Given 2,000 leads in scope, When the list opens, Then the first page renders within NFR-001 targets using pagination. | Unit+API | | Not run |
| TC-105 | FR-035 | AC1 | Must | Given a lead converted to a customer, When the customer timeline opens, Then the lead's past activities are included. | Unit+API | | Not run |
| TC-106 | FR-036 | AC1 | Must | Given a lead whose phone matches an existing customer's contact, When converting, Then the user is offered "Link to existing customer" or "Create new". | Unit+API | | Not run |
| TC-107 | FR-036 | AC2 | Must | Given conversion succeeds, When complete, Then the customer opens in Customer 360, the lead shows "Converted to <customer>", and open follow-ups move to the customer. | Unit+API | | Not run |
| TC-108 | FR-036 | AC3 | Must | Given a lead with an open quotation, When converted, Then the quotation is linked to the new customer. | Unit+API | | Not run |
