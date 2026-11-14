# Release Notes — SaleSphere CRM 1.0.0

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0.0-rc1 | 2026-11-14 | Claude (Architect + QA) | Release candidate for Gate G9 (go-live) |

## 1. Summary

SaleSphere 1.0.0 is the first release: a mobile-first CRM for Indian SMBs and freelancers, installed once per client. It covers Google Sheet and web-form leads, follow-ups, GST quotations, invoices with a live UPI QR code, payments and receipts, Customer 360, Drive documents and privacy tools.

| Quality measure | Result |
|---|---|
| Must FRs with an automated test | **86 / 86** (`docs/09-traceability/TEST-COVERAGE.md`) |
| Test cases automated | 182 / 262 (69 %); the other 80 run in UAT |
| Unit + API tests | 143 passing (domain 50, API 83, config 3, documents 4, edge proxy 3) |
| Domain line coverage | ≥ 80 % enforced in CI (NFR-018) |
| End-to-end | Sign-in → lead → quote → customer accepts → invoice + UPI QR → part and full payment → PAID; axe WCAG 2.2 AA scans of 17 screens (12 on both mobile and desktop) (NFR-013): 0 serious or critical issues |
| Lint / typecheck | Clean (TypeScript strict) |

## 2. Features by module

| Module | FRs | What users get |
|---|---|---|
| M1 Install & configuration | FR-001 – FR-006 | Per-client config validated at build; provisioning seeds roles, series and masters (idempotent); terminology and branding with a contrast check; company logo; Solo/Team mode; module switches; release migrations that run once |
| M2 Sign-in, users & audit | FR-007 – FR-016 | Username/password with forced first change, lockout after 5 failures, optional 2FA (TOTP), six roles with own/team/all scopes, forced sign-out within 60 s, immutable audit log with masked PII |
| M3 Master data | FR-017 – FR-024 | Company and GSTIN checks, bank accounts and UPI IDs, catalogue with HSN/SAC warnings, finance masters and FY lock, message templates with variable checks, CSV import of products and customers with preview, deactivation of in-use values |
| M4 Leads | FR-025 – FR-036 | Quick add, duplicate detection and re-enquiry merge, CSV import, web form and webhook capture, assignment rules, list/Kanban views, saved filters, SLA tracking, conversion to customer |
| M5 Google & Sheet sync | FR-037 – FR-043 | Connect Google, map a sheet, instant (Apps Script) or 4-minute polling with a 15-minute safety poll, exactly-once import with a row marker, error queue with fix and retry |
| M6 One-tap actions & follow-ups | FR-044 – FR-050 | Call / WhatsApp / email logging, outcome automation, follow-up buckets and reminders, notes timeline, offline outbox |
| M7 Quotations | FR-051 – FR-058 | GST-aware quote builder, discount approvals, revisions, share link with view tracking, customer accept / request changes / reject |
| M8 Sales orders | FR-059 – FR-061 | Optional orders module; orders are created silently when it is off |
| M9 Invoices & UPI QR | FR-062 – FR-069 | Tax invoice, bill of supply and proforma; numbering per FY; credit notes; a UPI QR code that follows the balance; branded PDF |
| M10 Payments | FR-070 – FR-073 | Payments with UTR duplicate check, TDS, auto or manual allocation (opened from an invoice → that invoice first), advances, receipts, reversal |
| M11 Customers | FR-074 – FR-076 | Customer 360 with finance tabs by role, contacts and addresses, statements |
| M12 Documents | FR-077 – FR-079 | Drive folders per customer (lead files move on conversion), resumable uploads with size and type limits, share links with revoke and extend |
| M13 App experience | FR-080 – FR-083 | Installable PWA, light/dark themes, push notifications with per-event opt-out, global search |
| M14 Dashboard & reports | FR-084 – FR-085 | Role-aware home dashboard and Excel report exports |
| M15 Privacy & retention | FR-086 – FR-090 | Source and consent basis on every lead, find a person, export their data, erase or anonymise, support access with consent, 3-month junk purge |
| M16 Extensibility | FR-091 | Webhook and adapter extension points |

## 3. Fixed during release hardening (Phase 13)

| Area | Problem found | Fix |
|---|---|---|
| Payments (FR-070 AC1) | A payment recorded from an invoice was auto-allocated oldest-first, so it could land on a different invoice | The chosen invoice is settled first; any remainder goes oldest-first (`autoAllocate(…, preferInvoiceId)`) |
| Payments UI | After saving or reversing a payment, invoice and customer screens showed old balances for up to 30 s | All affected caches are refreshed |
| FR-004 AC4 | Switched-off modules were hidden in the UI but their APIs still answered | `MODULE_DISABLED` for orders, sheet sync and web form |
| FR-003 AC1 / FR-004 AC4 (UI) | The web app never loaded the app config: renamed terms and module switches did not reach the UI, and the Orders tab called a disabled API | App-config hook: terms in navigation and list titles, a "Your words" editor, brand colour applied to tokens, Orders tab shown only when the module is on |
| SCR-013 | No order detail screen when the Orders module is on | Order detail: status changes, invoiced vs pending, create invoice for pending items |
| FR-003 AC2/AC3 | No logo support; low-contrast brand colours were accepted | Raster logo on the company profile, snapshotted into issued invoices; `CONTRAST_TOO_LOW` with an accessible suggestion |
| FR-021 AC1 | Templates with unknown variables were accepted | `TEMPLATE_UNKNOWN_VARIABLE`, listing the allowed variables |
| FR-019 AC2 / FR-018 AC1 | No HSN/SAC warning; the UPI/IFSC error gave no example | Warning on save; example values in the errors |
| FR-023 | The masters/opening-data import was not built | API-055 – API-057 plus the "Import products & customers" screen |
| FR-006 | No migration runner | Ordered, run-once migrations; the deploy stops before shipping code if one fails |
| FR-077 AC2 | Lead files stayed in the lead's Drive folder after conversion | `drive.moveLeadFiles` task |
| FR-001 | The web build ignored the client config | `CLIENT_ID=<id> pnpm build` validates `clients/<id>/config.json` and brands the manifest |
| Security | In production, a missing `DATA_ENC_KEY`, `EDGE_HMAC_SECRET` or `JWT_PRIVATE_JWK` silently fell back to dev behaviour | The app refuses to start; all functions get the same secret set |
| Deploy | Functions bundle referenced `workspace:*` packages (would fail in Cloud Build); task function exported twice; no edge proxy, Firestore rules, indexes or CI | `apps/api/build.mjs`; single `runTask`; Pages Function proxy with tests; deny-all rules; 86 generated composite indexes; CI and deploy workflows |

## 4. Design deviations (recorded against the LLD)

| LLD item | As designed | As built | Reason |
|---|---|---|---|
| API-055 import upload | Multipart `.xlsx` upload | JSON rows parsed from CSV in the browser (same as API-082 lead import) | No server-side spreadsheet parsing or file storage for imports; same 5,000-row cap |
| API-054 import templates; `openingInvoices` import kind | Downloadable `.xlsx` templates; four kinds | Not built; kinds `products` and `customers` | Deferred: see KI-04 |
| LLD-common §6 indexes | Index named per query in each LLD | Generated from recorded query shapes plus list families (`infra/gen-indexes.mjs`) | Prevents drift between code and indexes |

## 5. Known issues and limitations

| ID | Issue | Impact | Workaround / plan |
|---|---|---|---|
| KI-01 | Automated tests run on the in-memory database; the Firestore adapter has only been typechecked, and indexes are generated but not yet built | Query differences or missing indexes would surface only in staging | Go-live checklist T-4: run the staging smoke and journeys; watch for `FAILED_PRECONDITION` |
| KI-02 | Production adapters (Google REST, Secret Manager, FCM, Cloud Tasks, PDF Chromium) are covered by fakes in tests | Integration faults show up only in staging | Checklist T-4 / T-5 |
| KI-03 | Firestore allows 30 disjunctions per query; a Sales Manager whose team has more than 6 members, filtering several stages at once, can exceed it | That filtered list fails with an error | Filter one stage at a time; fix planned in 1.0.1 (split the query) |
| KI-04 | No `.xlsx` import templates; no opening-invoice import | Opening balances must be entered as invoices manually | Planned in 1.1 |
| KI-05 | Renaming a customer does not rename its existing Drive folder | New files go to a folder with the new name | Rename the old folder in Drive by hand if needed |
| KI-06 | 80 test cases are manual | Needs UAT time | UAT plan in `docs/08-test/TEST-STRATEGY.md` |
| KI-07 | Performance targets (NFR-001 – NFR-003) not yet measured | Unknown p95 | Checklist P-1 – P-3 on staging |
| KI-08 | `.env.example` needs two comment fixes that the session's file permissions blocked: `GOOGLE_REDIRECT_URI` must end `/api/v1/oauth/google/callback`, and the `FCM_VAPID_PUBLIC_KEY` note should cite FR-082 | Documentation only | Edit by hand before commit |

## 6. Breaking changes

None. This is the first release.

## 7. Migration steps

None for a new install. Follow `docs/10-ops/RUNBOOK.md` §3 (first-time setup) and §4 (deploy). Migration `001-initial` is recorded by provisioning.
