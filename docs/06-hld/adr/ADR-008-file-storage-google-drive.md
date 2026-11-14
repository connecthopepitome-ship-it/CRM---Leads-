# ADR-008: Google Drive (client account) with the drive.file scope and Google Picker

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** FR-037, FR-038, FR-077 – FR-079; NFR-008, NFR-010; R-001, R-002, A-024

## Context
Files must live in the client's own Google account (free Gmail), private, never publicly linked. Broad Drive scopes are "restricted" and need expensive verification; free Gmail can't use Workspace internal apps.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Full `drive` scope | Access any file | Restricted scope → security assessment; over-privileged |
| `drive.file` + Google Picker for user-chosen files (the lead sheet) | Non-sensitive scope; app sees only files it created or the user picked | Sheet must be chosen through Picker; folder tree must be app-created |
| Cloud Storage bucket in client project | Simple, no OAuth | Design requires Drive (client can browse files); storage billed |

## Decision
We will use **`drive.file`** (which also authorises the Sheets API on the sheet the Admin picks) and **`gmail.send`** only, without the `spreadsheets` scope, via OAuth with the client's Google account; the lead sheet is selected with **Google Picker**. The API creates the folder tree (FR-077), uploads with resumable uploads, stores only metadata in Firestore, streams downloads/thumbnails through the API after permission checks, and never creates public permissions. The refresh token is stored in Secret Manager; health checks detect revocation (FR-043).

## Consequences
**Positive:** least privilege; client owns files. **Negative:** the Picker needs a short-lived browser access token (issued only to Admins while picking; the documented exception to "browser never touches Drive"); `gmail.send` is a sensitive scope → "unverified app" warning until Google verification (A-024, R-001). **Follow-up:** OAuth consent-screen checklist in runbook; plan Google verification before v1.0.
