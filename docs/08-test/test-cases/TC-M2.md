# Test cases — M2 Authentication, users & audit

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA) | Generated 1:1 from FRD v0.3 acceptance criteria; steps follow Given / When / Then |

Default level: **API** · Risk: **High**. Preconditions default to "signed in with a permitted role (FRD §3.2) on a seeded install (TEST-STRATEGY §3)". Expected result = the *Then* clause. Automated location is filled in during build.

| TC | FR | AC | Priority | Scenario (Given / When / Then) | Level | Automated in | Status |
|---|---|---|---|---|---|---|---|
| TC-023 | FR-007 | AC1 | Must | Given a valid username in any letter case and correct password, When the user signs in, Then they reach their home dashboard and a session record exists. | API | | Not run |
| TC-024 | FR-007 | AC2 | Must | Given a wrong password, When the user signs in, Then the message "Username or password is incorrect" is shown without revealing which, and the failed attempt is counted and audited. | API | | Not run |
| TC-025 | FR-007 | AC3 | Must | Given a deactivated user, When they sign in with correct credentials, Then access is refused with "Your account is inactive — contact your admin". | API | | Not run |
| TC-026 | FR-007 | AC4 | Must | Given any login request, When it is logged, Then the password never appears in logs, audit or error output. | API | | Not run |
| TC-027 | FR-007 | AC5 | Must | Given a username that does not exist, When the user signs in, Then the same generic message is shown, the response time is comparable to a wrong-password attempt, and the attempt is audited as "unknown user". | API | | Not run |
| TC-028 | FR-008 | AC1 | Must | Given 4 consecutive failures, When the 5th fails, Then the account is locked for 15 minutes and the user sees when they can retry. | API | | Not run |
| TC-029 | FR-008 | AC2 | Must | Given a locked account, When the correct password is entered before expiry, Then access is still refused. The lock message is shown only after a correct password, so locking does not reveal whether a username exists. | API | | Not run |
| TC-030 | FR-008 | AC5 | Must | Given a failed attempt followed by a successful login, When the user later fails again, Then the counter starts from 1. | API | | Not run |
| TC-031 | FR-008 | AC3 | Must | Given a locked account, When an Admin selects Unlock, Then the user can sign in immediately and the action is audited. | API | | Not run |
| TC-032 | FR-008 | AC4 | Must | Given more than 20 login attempts from one IP within 1 minute, When further attempts arrive, Then they are rejected with "Too many attempts, try again shortly". | API | | Not run |
| TC-033 | FR-009 | AC1 | Must | Given a user flagged must-change-password, When they sign in, Then only the change-password screen is available until they set a compliant password. | API | | Not run |
| TC-034 | FR-009 | AC2 | Must | Given a new password shorter than the policy minimum or equal to the username, When submitted, Then it is rejected with the specific rule broken. | API | | Not run |
| TC-035 | FR-009 | AC3 | Must | Given a successful change, When saved, Then all the user's other sessions are revoked. | API | | Not run |
| TC-036 | FR-010 | AC1 | Must | Given an access token has expired and a valid refresh token exists, When the user acts, Then the session continues without re-login. | API | | Not run |
| TC-037 | FR-010 | AC2 | Must | Given the user signs out, When the old refresh token is reused, Then it is rejected. | API | | Not run |
| TC-038 | FR-010 | AC4 | Must | Given a refresh token that has already been rotated, When it is presented again, Then it is rejected and all sessions descending from it are revoked (token-reuse detection). | API | | Not run |
| TC-039 | FR-010 | AC3 | Must | Given the Admin forces logout of a user, When that user next acts, Then they are returned to the sign-in screen within 60 seconds (CR-003: token-epoch check, cache ≤ 60 s). | API | | Not run |
| TC-040 | FR-011 | AC1 | Must | Given a username already in use (case-insensitive), When the Admin creates a user, Then it is rejected with "Username already taken". | API | | Not run |
| TC-041 | FR-011 | AC2 | Must | Given the Admin deactivates a user with open leads, When confirming, Then the system asks for a new owner for open leads and follow-ups and reassigns them, and all that user's sessions are revoked. | API | | Not run |
| TC-042 | FR-011 | AC3 | Must | Given only one active Admin exists, When anyone tries to deactivate or demote them, Then the action is blocked. | API | | Not run |
| TC-043 | FR-012 | AC1 | Should | Given a user enables 2FA and confirms a valid code, When they next sign in, Then a 6-digit code is required after the password. | API | | Not run |
| TC-044 | FR-012 | AC2 | Should | Given a user loses their authenticator, When the Admin resets 2FA for them, Then 2FA is removed, the user is notified, and the action is audited. | API | | Not run |
| TC-045 | FR-012 | AC3 | Should | Given a user opens Login history, When it loads, Then the last 50 attempts are listed with result. | API | | Not run |
| TC-046 | FR-012 | AC4 | Should | Given 5 consecutive wrong 2FA codes, When the 5th is entered, Then it counts as a failed login toward lockout (RULE-007). | API | | Not run |
| TC-047 | FR-013 | AC1 | Must | Given a Sales Executive, When they request a lead owned by another executive, Then the API returns 404 (record outside scope is treated as not found) and the attempt is logged. | API | | Not run |
| TC-048 | FR-013 | AC2 | Must | Given a Sales Manager, When they list leads, Then only leads owned by members of their team(s) are returned. | API | | Not run |
| TC-049 | FR-013 | AC3 | Must | Given any request without a valid access token, When it reaches the API, Then it is rejected with 401 and no data. | API | | Not run |
| TC-050 | FR-013 | AC4 | Must | Given a hidden UI button, When the equivalent API is called directly without permission, Then it is rejected with 403. | API | | Not run |
| TC-051 | FR-014 | AC1 | Must | Given a fresh install, When the Admin opens Roles, Then the six default roles exist with the permissions in §3.2. | API | | Not run |
| TC-052 | FR-014 | AC2 | Must | Given the Admin sets Sales Executive discount limit to 10 %, When an executive quotes 12 %, Then approval is required (FR-053). | API | | Not run |
| TC-053 | FR-014 | AC3 | Must | Given the Admin switches off "Record payments" for Sales Executive, When an executive opens a customer, Then "Record payment" is not offered and the API refuses it. | API | | Not run |
| TC-054 | FR-015 | AC1 | Must | Given a user changes a lead's phone, When saved, Then an audit entry shows old and new phone, user and time. | API | | Not run |
| TC-055 | FR-015 | AC2 | Must | Given any user including Admin, When they try to edit or delete an audit entry via UI or API, Then it is refused. | API | | Not run |
| TC-056 | FR-015 | AC3 | Must | Given a password change, When audited, Then the entry records "password changed" without any password value. | API | | Not run |
| TC-057 | FR-016 | AC1 | Must | Given filters user = "ravi" and last 7 days, When applied, Then only Ravi's entries in that range are listed, newest first. | API | | Not run |
| TC-058 | FR-016 | AC2 | Must | Given a record's detail page, When the Admin opens "History", Then that record's audit entries are shown. | API | | Not run |
