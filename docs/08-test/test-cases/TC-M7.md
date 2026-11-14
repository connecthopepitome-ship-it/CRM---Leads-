# Test cases — M7 Quotations

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **Unit+API+E2E** · Risk: **High**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-150 | FR-051 | AC1 | Must | Given a catalogue item is added, When selected, Then description, unit, rate, tax rate and HSN/SAC are copied from the master and remain editable on the line. | Unit+API+E2E | | Not run |
| TC-151 | FR-051 | AC2 | Must | Given a quotation for a lead without company/GSTIN, When saved as draft, Then it is allowed (B2C) and the place of supply defaults per RULE-034 (lead's state if known, else company state). | Unit+API+E2E | | Not run |
| TC-152 | FR-051 | AC3 | Must | Given a draft, When saved, Then it has no number until sent (RULE-003) and shows "Draft". | Unit+API+E2E | | Not run |
| TC-153 | FR-052 | AC1 | Must | Given 2 × ₹10,000 at 10 % discount and 18 % GST, intra-state, When calculated, Then taxable = ₹18,000.00, CGST = ₹1,620.00, SGST = ₹1,620.00, total = ₹21,240.00. | Unit+API+E2E | | Not run |
| TC-154 | FR-052 | AC2 | Must | Given the same line inter-state, When calculated, Then IGST = ₹3,240.00 and no CGST/SGST. | Unit+API+E2E | | Not run |
| TC-155 | FR-052 | AC3 | Must | Given a grand total of ₹48,379.60 and round-off on, When calculated, Then round-off = +₹0.40 and grand total = ₹48,380.00, in words "Rupees Forty-Eight Thousand Three Hundred Eighty Only". | Unit+API+E2E | | Not run |
| TC-156 | FR-052 | AC4 | Must | Given a non-GST install, When calculated, Then no tax lines appear. | Unit+API+E2E | | Not run |
| TC-157 | FR-053 | AC1 | Must | Given a 15 % discount and a 10 % role limit, When the executive selects Send, Then the quote moves to "Pending approval" and the manager is notified. | Unit+API+E2E | | Not run |
| TC-158 | FR-053 | AC2 | Must | Given the manager approves, When saved, Then the executive is notified and can send; given they reject, Then the quote returns to Draft with the comment. | Unit+API+E2E | | Not run |
| TC-159 | FR-053 | AC3 | Must | Given the approver is the quote owner, When they try to approve their own quote, Then it is refused (Admin may approve any). | Unit+API+E2E | | Not run |
| TC-160 | FR-053 | AC4 | Must | Given the approved quote is edited to a higher discount, When re-sent, Then approval is required again. | Unit+API+E2E | | Not run |
| TC-161 | FR-053 | AC5 | Must | Given Solo mode, When sending any discount, Then no approval is required. | Unit+API+E2E | | Not run |
| TC-162 | FR-054 | AC1 | Must | Given QT/25-26/0007 R0 was sent, When the user selects Revise, Then a draft R1 is created with R0's contents, and R0 becomes Superseded when R1 is sent. | Unit+API+E2E | | Not run |
| TC-163 | FR-054 | AC2 | Must | Given a customer opens R0's link after R1 was sent, When the page loads, Then it shows "This quotation has been updated" with a link to R1, and Accept is not available on R0. | Unit+API+E2E | | Not run |
| TC-164 | FR-054 | AC3 | Must | Given Compare is opened, When R0 and R1 are shown, Then changed lines and totals are highlighted. *(Compare view: Should.)* | Unit+API+E2E | | Not run |
| TC-165 | FR-055 | AC1 | Must | Given a quote is sent, When the PDF is generated, Then it contains logo, company details, quote number and revision, customer, lines, totals, validity, terms and signature block. | Unit+API+E2E | | Not run |
| TC-166 | FR-055 | AC2 | Must | Given the number has been allocated on Send, When PDF generation fails, Then the quote is still Sent with its number (number and status commit together, RULE-003), the share link works as a web view, the PDF shows "PDF pending", and generation is retried in the background up to 3 times before alerting the user with "Regenerate PDF". | Unit+API+E2E | | Not run |
| TC-167 | FR-056 | AC1 | Must | Given an approved/allowed draft, When the user sends via WhatsApp, Then the number is allocated, the link is generated, WhatsApp opens with the quote template, and status is Sent. | Unit+API+E2E | | Not run |
| TC-168 | FR-056 | AC2 | Must | Given the lead is in a stage before "Quotation Sent", When the quote is sent, Then the lead moves to "Quotation Sent". | Unit+API+E2E | | Not run |
| TC-169 | FR-057 | AC1 | Must | Given a valid, unexpired latest revision, When the customer accepts with name "Ravi Kumar", Then the quote becomes Accepted, further responses are disabled, the owner gets a push notification, and a lead (if any) is converted to a customer and set Won. | Unit+API+E2E | | Not run |
| TC-170 | FR-057 | AC2 | Must | Given the customer requests changes, When submitted, Then the quote shows "Changes requested" with the comment and the owner is notified. | Unit+API+E2E | | Not run |
| TC-171 | FR-057 | AC3 | Must | Given the quote has expired, When the link opens, Then the page shows "This quotation expired on <date> — contact <owner>" and no actions. | Unit+API+E2E | | Not run |
| TC-172 | FR-057 | AC4 | Must | Given the customer double-taps Accept, When processed, Then only one acceptance is recorded. | Unit+API+E2E | | Not run |
| TC-173 | FR-058 | AC1 | Must | Given the customer opens the link three times, When the owner views the quote, Then it shows "Viewed 3 times, last 2 h ago". | Unit+API+E2E | | Not run |
| TC-174 | FR-058 | AC2 | Must | Given validity ends 30-11-2026, When 01-12-2026 begins (IST), Then status is Expired. | Unit+API+E2E | | Not run |
| TC-175 | FR-058 | AC3 | Must | Given an internal user opens the share link while logged in, When counted, Then the view is not counted as a customer view. | Unit+API+E2E | | Not run |
