# Test cases — M6 One-tap actions & follow-ups

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **Unit+API** · Risk: **Medium**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-128 | FR-044 | AC1 | Must | Given a lead with a valid phone, When the user taps Call and returns to the app, Then the outcome sheet opens pre-filled with the lead and call start time. | Unit+API | | Not run |
| TC-129 | FR-044 | AC2 | Must | Given the user dismisses the sheet, When they return to the lead, Then a "Call — outcome not recorded" activity exists and a reminder chip asks for the outcome. | Unit+API | | Not run |
| TC-130 | FR-044 | AC3 | Must | Given the first call activity on a new lead, When saved, Then the first-contact SLA timer stops (FR-050). | Unit+API | | Not run |
| TC-131 | FR-044 | AC4 | Must | Given a desktop browser without a dialer, When the user taps Call, Then the number is shown with Copy and the outcome sheet is still offered. | Unit+API | | Not run |
| TC-132 | FR-045 | AC1 | Should | Given rule "3 × No answer → Unreachable, follow-up in 2 days", When the 3rd consecutive No answer is logged, Then the lead is tagged Unreachable and a follow-up is created for 2 days later. | Unit+API | | Not run |
| TC-133 | FR-045 | AC2 | Should | Given a Connected outcome between No answers, When counted, Then the consecutive counter resets. | Unit+API | | Not run |
| TC-134 | FR-046 | AC1 | Must | Given template "Hi {{name}}, here is your quote {{link}}", When used for Ravi with quote QT/25-26/0007, Then WhatsApp opens with Ravi's number and the text containing his name and the quote's share link. | Unit+API | | Not run |
| TC-135 | FR-046 | AC2 | Must | Given a lead without a valid phone, When WhatsApp is tapped, Then the user is told "Add a valid mobile number first". | Unit+API | | Not run |
| TC-136 | FR-046 | AC3 | Must | Given the message is opened, When the activity is logged, Then it states "opened" (delivery cannot be confirmed without the Business API). | Unit+API | | Not run |
| TC-137 | FR-047 | AC1 | Must | Given a quotation PDF is attached, When the email is sent, Then the recipient receives it from the client's Gmail address and the timeline shows "Email sent" with subject. | Unit+API | | Not run |
| TC-138 | FR-047 | AC2 | Must | Given the daily send limit is reached, When the user sends, Then the email is not sent and the user sees "Daily email limit reached — try tomorrow or use WhatsApp". | Unit+API | | Not run |
| TC-139 | FR-047 | AC3 | Must | Given Gmail is not connected, When the user opens the composer, Then they see "Email not set up — ask your admin" and a mailto fallback. | Unit+API | | Not run |
| TC-140 | FR-047 | AC4 | Must | Given Gmail returns a temporary error, When sending, Then the system retries up to 3 times over 5 minutes before marking the email "Failed" with Retry. | Unit+API | | Not run |
| TC-141 | FR-048 | AC1 | Must | Given a customer with an address, When Directions is tapped, Then Maps opens with the address as destination. | Unit+API | | Not run |
| TC-142 | FR-048 | AC2 | Must | Given the device is offline, When a note is saved, Then it shows "Will sync" and is synced when back online (FR-081). | Unit+API | | Not run |
| TC-143 | FR-049 | AC1 | Must | Given a follow-up due at 11:00, When 11:00 arrives, Then the owner receives a push notification that opens the record. | Unit+API | | Not run |
| TC-144 | FR-049 | AC2 | Must | Given a follow-up passes its due time uncompleted, When the owner opens Home, Then it appears in "Overdue" in red. | Unit+API | | Not run |
| TC-145 | FR-049 | AC3 | Must | Given a lead is reassigned, When saved, Then its open follow-ups move to the new owner. | Unit+API | | Not run |
| TC-146 | FR-049 | AC4 | Must | Given a lead is set to Lost or Junk, When saved, Then its open follow-ups are cancelled automatically. | Unit+API | | Not run |
| TC-147 | FR-050 | AC1 | Must | Given SLA 15 minutes and a lead created at 10:00 on a working day, When no contact is logged by 10:15, Then the lead shows "SLA breached" and the owner is notified. | Unit+API | | Not run |
| TC-148 | FR-050 | AC2 | Must | Given a lead created at 21:00 with business hours 09:00–19:00, When the next day starts, Then the timer begins at 09:00. | Unit+API | | Not run |
| TC-149 | FR-050 | AC3 | Must | Given the SLA report, When run for a period, Then it shows % of leads contacted within SLA (OBJ-002). | Unit+API | | Not run |
