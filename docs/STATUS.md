# Project Status — SaleSphere CRM

| # | Phase | Status | Lead | Artifacts | Date | Approved by |
|---|---|---|---|---|---|---|
| 0 | Kickoff & discovery | Approved | Techno-functional | 00-project-brief.md, 00-source/SaleSphere-Solution-Design.md | 2026-11-13 | Product owner |
| 1 | BRD | Approved | Techno-functional | 01-brd/BRD.md v0.2, reviews/BRD-review-v0.1.md, 09-traceability/RTM.md | 2026-11-13 | Product owner |
| 2 | FRD | Approved | Techno-functional | 02-frd/FRD.md v0.2, reviews/FRD-review-v0.1.md, 09-traceability/RTM.md | 2026-11-13 | Product owner |
| 3 | Process flows | Approved | Techno-functional | 03-process/PROCESS-FLOWS.md v0.1, 09-traceability/RTM.md | 2026-11-13 | Product owner |
| 4 | UX design | Approved | UX designer | 04-ux/UX-SPEC.md, design-system.md, wireframes/ (36), prototype/index.html, reviews/UX-self-review-v0.1.md | 2026-11-13 | Product owner |
| 5 | Solution design | Approved | Architect | 05-solution/SOLUTION-DESIGN.md v0.1 | 2026-11-13 | Product owner |
| 6 | HLD | Approved | Architect | 06-hld/HLD.md v0.2, adr/ADR-001 – ADR-014, reviews/HLD-review-v0.1.md | 2026-11-13 | Product owner |
| 7 | LLD | Approved | Tech lead | 07-lld/LLD-common + 14 module LLDs, openapi.yaml (172 operations) | 2026-11-13 | Product owner ("approved all — finish") |
| 8 | Test strategy | Approved | QA | 08-test/TEST-STRATEGY.md, test-cases/TC-M1 – TC-M16 (262 TCs) | 2026-11-13 | Product owner (blanket approval) |
| 9 | Scaffold | Done | Tech lead | pnpm monorepo (apps/web, apps/api, packages/*), ESLint/Prettier/TS strict, .github/workflows/ci.yml + deploy.yml, infra/ (rules, indexes), .env.example | 2026-11-14 | Blanket approval |
| 10 | Build | Done | Tech lead | apps/api (14 modules + imports, migrations, edge-signed), apps/web (PWA, 36 screens, Pages Function proxy); 143 unit/API + 5 E2E tests green | 2026-11-14 | Blanket approval |
| 11 | Review gate | Done | QA | Phase 13 hardening review: 14 defects/gaps found and fixed (RELEASE-NOTES-1.0.0 §3) | 2026-11-14 | — |
| 12 | Traceability | Done | QA | 09-traceability/TEST-COVERAGE.md (86/86 Must FRs automated; 182/262 TCs), infra/rtm-coverage.mjs | 2026-11-14 | — |
| 13 | Release | In review (Gate G9) | Architect + QA | 10-ops/RELEASE-NOTES-1.0.0.md, RUNBOOK.md, GO-LIVE-CHECKLIST.md | 2026-11-14 | Awaiting product owner |

Status values: Not started · In progress · In review · Approved · Re-opened

## Decisions log
| Date | Decision | By | Ref |
|---|---|---|---|
| 2026-11-13 | Product owner's solution design adopted as primary source input | Product owner | 00-source/SaleSphere-Solution-Design.md |
| 2026-11-13 | Target market: SMBs and freelancers (industry-agnostic) | Product owner | Brief §1 |
| 2026-11-13 | WhatsApp Business API is optional: pluggable adapter, configured and paid for by the client | Product owner | Brief §6 |
| 2026-11-13 | Payments: UPI QR as per design (no payment gateway first) | Product owner | Brief §6 |
| 2026-11-13 | Clients use a free Gmail account for Google Drive and email (not Workspace) | Product owner | Brief §6 |
| 2026-11-13 | Discovery Q-001–Q-015: recommended defaults accepted | Product owner | Brief v1.0 |
| 2026-11-13 | MVP = source roadmap Phase 1, trimmed for SMBs (see brief §4) | Product owner | Brief §4 |
| 2026-11-13 | Stack = source design (React/Vite PWA, Cloudflare Pages, Cloud Functions, Firestore asia-south1, built-in auth, Google Drive); overrides CLAUDE.md §3 — ADRs in Phase 6 | Product owner | Brief §7 |
| 2026-11-13 | Code hosted at github.com/connecthopepitome-ship-it/CRM---Leads- (branch `main`) | Product owner | — |
| 2026-11-13 | Gate G0 approved | Product owner | Brief v1.0 |
| 2026-11-13 | BRD QA review: Pass with fixes; Critical/High (F-01–F-03) and most Medium/Low fixed in v0.2. Remaining: F-06 (BR splitting) deferred to FRD, F-09 handled as proxy note, F-15 as A-012, F-17 accepted | Claude (QA) | reviews/BRD-review-v0.1.md |
| 2026-11-13 | Gate G1 approved (BRD v1.0); pilot = freelance web developer; price ₹20,000/client; junk leads purged after 3 months; sales executives may record payments | Product owner | BRD §19 |
| 2026-11-13 | Q-021–Q-023 defaults accepted: quote → invoice with silent order when Orders module off; recurring invoices Phase 2; web-services seed catalogue | Product owner | FRD §13 |
| 2026-11-13 | FRD QA review: Pass with fixes; all 4 High + 16 Medium + 2 Low fixed in v0.2 (incl. mandatory sheet row marker, masked PII in audit log, one GSTIN per install in MVP, services place-of-supply rule, poll interval 1–4 min); F-08, F-15, F-22, F-26–28, F-30–32 deferred to Phases 5–8 | Claude (QA) | reviews/FRD-review-v0.1.md |
| 2026-11-13 | Gate G2 approved (FRD v0.2; A-014–A-024 accepted) | Product owner | FRD |
| 2026-11-13 | Process flows drafted: 11 PFs (7 with AS-IS), 10 lifecycles, 8 sequences; all 41 Mermaid diagrams in docs parse-validated with mermaid 11.4.1 | Claude | 03-process/PROCESS-FLOWS.md |
| 2026-11-13 | Gate G3 approved (process flows v0.1) | Product owner | 03-process/PROCESS-FLOWS.md |
| 2026-11-13 | UX direction "Clear Ledger" built on approved brief §8 (blue #2563EB, Inter, light/dark); 36 screens, 44 components; prototype passes 44 scripted journey checks and 0 axe structural violations | Claude (UX) | 04-ux/ |
| 2026-11-13 | Gate G4 approved (UX v0.1; Q-024, Q-025 defaults apply) | Product owner | 04-ux/ |
| 2026-11-13 | Solution option A recommended (per-client Firebase + Cloudflare, score 4.00 vs VM 3.90, multi-tenant 3.70, buy SaaS 3.25); PDFs via headless Chromium; search via token index; hexagonal domain package to limit lock-in | Claude (Architect) | 05-solution/SOLUTION-DESIGN.md |
| 2026-11-13 | Gate G5 approved (Option A; Q-026–Q-029 defaults apply) | Product owner | 05-solution/SOLUTION-DESIGN.md |
| 2026-11-13 | HLD + 14 ADRs drafted; QA review Pass with fixes — all 8 High + 13 Medium fixed in v0.2 (cookie __Secure-rt, single-flight refresh with grace window, HMAC edge signing, private worker/pdf functions, ownerId on all scoped collections, backups daily 7d + weekly 5w, PDF cold-start target, no PII in URLs/platform logs); M-11, M-12, M-15 partially and Low items logged | Claude (Architect, QA) | reviews/HLD-review-v0.1.md |
| 2026-11-13 | Gate G6 approved (HLD v0.2, ADR-001 – ADR-014 accepted); CR-001 – CR-004 remain Proposed pending explicit decision | Product owner | 06-hld/ |
| 2026-11-13 | LLD split into 4 batches in build order (1: common, platform, identity, audit, masters; 2: leads, engagement, google; 3: sales, payments, customers, documents; 4: notify, insights, privacy); G7 per batch | Claude (Tech lead) | 07-lld/LLD-common.md §1 |
| 2026-11-13 | Gate G7 batch 1 approved; CR-001 – CR-004 approved and applied (FRD v0.3); product owner asked to finish all remaining phases without stopping at each gate ("approved all … build completely") | Product owner | FRD v0.3 |
| 2026-11-13 | LLD batches 2–4 written (leads, engagement, google, sales, payments, customers, documents, notify, insights, privacy); 71 Mermaid diagrams valid; OpenAPI 3.1 valid with 172 operations; RTM: 91/91 FRs mapped to API/TBL | Claude (Tech lead) | 07-lld/ |
| 2026-11-13 | Test strategy + 262 TCs (1 per AC, 91/91 FRs); RTM TC column filled | Claude (QA) | 08-test/ |
| 2026-11-14 | Build complete; E2E journeys + axe green on mobile and desktop | Claude (Tech lead, QA) | apps/, apps/web/e2e |
| 2026-11-14 | Release hardening: payment allocation prefers the invoice it was opened from (FR-070 AC1); module APIs gated (FR-004 AC4); logo + contrast check (FR-003); template variables (FR-021); masters import API + screen (FR-023); migration runner (FR-006); lead files move to customer folder (FR-077 AC2); client config drives the build (FR-001); production fails fast without secrets | Claude (Tech lead, QA) | RELEASE-NOTES-1.0.0 §3 |
| 2026-11-14 | Firestore composite indexes generated from recorded query shapes + list families (86) instead of hand-listed per LLD | Claude (Tech lead) | infra/gen-indexes.mjs |
| 2026-11-14 | Import upload uses JSON rows parsed in the browser (not multipart .xlsx); xlsx templates and opening-invoice import deferred (KI-04) | Claude (Tech lead) | RELEASE-NOTES-1.0.0 §4 |
| 2026-11-14 | Gate G9 pending: staging verification, owner-only steps and UAT listed in GO-LIVE-CHECKLIST | Claude | 10-ops/GO-LIVE-CHECKLIST.md |

## Change requests
| CR | Summary | Status | Impacted gates |
|---|---|---|---|
| CR-001 | RULE-054 / FRD §7.3: erased data may persist in backups up to ≈ 35 days (daily 7 d + weekly 5 w) | Approved — applied to FRD v0.3 | G2 |
| CR-002 | NFR-003: PDF p95 ≤ 5 s warm, ≤ 12 s incl. cold start (async) | Approved — applied to FRD v0.3 | G2 |
| CR-003 | FR-010 AC3: forced logout effective ≤ 60 s | Approved — applied to FRD v0.3 | G2 |
| CR-004 | NFR-010: data stored in asia-south1; named sub-processors may process outside India | Approved — applied to FRD v0.3 | G2 |

## Assumptions
| ID | Assumption | Status |
|---|---|---|
| A-001 | Product name is **SaleSphere** (brief said "S2P") | Accepted (default) |
| A-002 | Typical install: 1–25 users, ≤ 2,000 leads and ≤ 500 invoices per month | Accepted (default) |
| A-003 | Solo/Team mode switch in config for freelancers | Accepted (default) |
| A-004 | English UI is acceptable for MVP users (India locale per CON-006) | Accepted (default) |
| A-005 | Built by product owner with Claude Code; MVP ≈ 10 weeks | Accepted (default) |
| A-006 | Clients' leads mostly arrive via Google Sheets | Accepted at G1 |
| A-007 | Manual UPI payment recording (UTR entry) acceptable in MVP | Accepted at G1 |
| A-008 | Click-to-chat WhatsApp enough for MVP | Accepted at G1 |
| A-009 | Free Gmail limits (15 GB, ~500 emails/day) sufficient | Accepted at G1 |
| A-010 | Financial documents and audit log retained ≥ 8 years (pending Q-019) | Accepted at G1 |
| A-011 | KPI time limits and −20 % DSO target are consultant proposals | Accepted at G1 |
| A-012 | Client pays for own domain; §18 timeline indicative | Accepted at G1 |
| A-013 | ₹20,000 per client is a one-time install fee | Open — confirm |
| A-014 – A-024 | FRD assumptions (SLA hours, acceptance by typed name, link expiry, file/email caps, INR-only, offline cache, no unmerge, refunds outside, CA review, UPI `tr`, Google Picker) — see FRD §12 | Accepted at G2 |
| A-025 – A-029 | Solution assumptions (opening invoices OB/ series, anonymous telemetry only, DPA clause in contract, deploy-only CI access, client-owned Firebase billing) — see Solution Design §13 | Accepted at G5 |
| A-030 – A-031 | Cloudflare Pages Functions free tier covers proxy traffic; backups and Cloud Tasks available in asia-south1 | Accepted at G6 |

## Risks
| ID | Risk | Mitigation |
|---|---|---|
| R-001 | Free-Gmail OAuth in Testing mode expires tokens after 7 days | Consent screen In production; minimal scopes; runbook step; health alert |
| R-002 | 15 GB shared free Google storage | Show usage; advise Google One |
| R-003 | Gmail ~500 sends/day | No bulk email in MVP |
| R-004 | Built-in auth is a security liability | Proven libraries; security review before go-live |
| R-005 | Personal UPI VPA limits on business collections | Recommend business VPA |
| R-006 | Scope creep into 10-week MVP | Strict MoSCoW; change requests |
| R-007 | iOS push only for home-screen-installed PWA | Install prompt; in-app reminders |
| R-008 | Per-client install/upgrade effort grows with clients | Provisioning script; CI fan-out; migrations |
| R-009 | Incorrect GST computation | Tested tax engine; CA review of formats |
| R-010 | Firebase cost spike | Budget alerts; rate limits; idempotent sync |
| R-011 – R-017 | Indic PDF rendering, Firestore query limits, cold starts, multi-project credential management, one-time fee vs ongoing support, Google API quotas, Chromium size — see Solution Design §12 | See doc |

## Open questions
| ID | Question | Owner | Status |
|---|---|---|---|
| Q-001 – Q-015 | Discovery round 1 | Product owner | Closed — defaults accepted |
| Q-016 | First pilot client and industry? | Product owner | Closed — freelance web developer (Solo mode) |
| Q-017 | Commercial model? | Product owner | Closed — ₹20,000 per client (see A-013) |
| Q-018 | History for KPI baselines? | Product owner | Closed — none; baseline in first month after go-live |
| Q-019 | Retention periods? | Product owner | Closed — junk leads 3 months then deleted; financial 8 yrs (A-010) |
| Q-020 | Sales executives record payments? | Product owner | Closed — yes, by default |
| Q-021 | Quote → invoice without visible order step? | Product owner | Closed — yes, order created silently when Orders module off |
| Q-022 | Recurring invoices in MVP? | Product owner | Closed — stay in Phase 2 |
| Q-023 | Web-services seed catalogue for pilot? | Product owner | Closed — yes |
| Q-024 | SaleSphere product logo/wordmark for default theme? | Product owner | Closed — default: text wordmark |
| Q-025 | "Powered by SaleSphere" on customer pages? | Product owner | Closed — default: yes, switchable per client |
| Q-026 | Sheet first-connect backfill? | Product owner | Closed — default: offer both; last 30 days |
| Q-027 | CA and security reviewer for pre-go-live reviews? | Product owner | Closed — default: budget both |
| Q-028 | Optional annual support/upgrade plan? | Product owner | Closed — default: not in product; risk R-015 |
| Q-029 | minInstances for pilot? | Product owner | Closed — default: accept cold starts, measure |
| Q-030 | DPDP Rules 2025: confirm security-log retention and breach-notice obligations with counsel | Product owner | Open (before go-live) |
| Q-031 | Who is the named L2 support contact for installs (RUNBOOK §11)? | Product owner | Open (before go-live) |
| Q-032 | Pilot client details for clients/<pilot>/config.json (company name, domain, Firebase project ID) | Product owner | Open (before go-live) |
