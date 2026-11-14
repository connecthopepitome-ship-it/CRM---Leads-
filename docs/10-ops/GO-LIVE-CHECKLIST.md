# Go-Live Checklist — SaleSphere CRM 1.0.0 (Gate G9)

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-11-14 | Claude (QA + Architect) | First checklist for the pilot install |

Status key: **Done** (verified in this repo) · **Open** (must happen before go-live) · **Owner** (needs the product owner's or client's accounts or decision).

## 1. Build and test

| # | Item | Status | Evidence / how |
|---|---|---|---|
| T-1 | Lint, typecheck and unit + API tests green | Done | 143 tests; `pnpm lint && pnpm typecheck && pnpm test` |
| T-2 | Every Must FR has an automated test | Done | 86/86, `node infra/rtm-coverage.mjs` (also a CI gate) |
| T-3 | Critical journeys E2E + axe on mobile and desktop | Done | `pnpm test:e2e`: 5 passed |
| T-4 | Staging deploy: journeys repeated against real Firestore and indexes (KI-01) | Open | Deploy `v1.0.0-rc1` to `staging`; run RUNBOOK §8 and the E2E journey by hand; no `FAILED_PRECONDITION` errors |
| T-5 | Real Google account: connect, sheet sync (webhook + poll), Drive upload, Gmail send, PDF render, push (KI-02) | Open | Staging, with a test Google account |
| T-6 | Manual UAT of the 80 non-automated TCs | Open / Owner | `docs/08-test/test-cases/`; sign-off below |

## 2. Security

| # | Item | Status | Evidence / how |
|---|---|---|---|
| S-1 | Authn/authz tests (roles, scopes, lockout, forced logout, CSRF, edge signature) | Done | `apps/api/test/identity.spec.ts`, `release.spec.ts`, `apps/web/functions/proxy.spec.ts` |
| S-2 | No secrets in the repo; secret scan in CI | Done (scan runs in CI) | `gitleaks` step in `ci.yml`; `.env*` git-ignored |
| S-3 | Production refuses to start without secrets | Done | `assertProductionSecrets` (`apps/api/src/config.ts`) |
| S-4 | Dependency audit: no unresolved High/Critical | Open | `pnpm audit --prod`; triage the results |
| S-5 | HTTP security headers: CSP, HSTS, nosniff, frame-ancestors | Done (config) / Open (verify) | `apps/web/public/_headers` and the proxy; verify on staging with securityheaders.com or the ZAP baseline |
| S-6 | Firestore rules deny all client access | Done | `infra/firestore.rules` |
| S-7 | Independent security review (Q-027 default: budgeted) | Owner | Reviewer to be named |
| S-8 | DPDP Rules 2025: security-log retention and breach notice confirmed with counsel (Q-030) | Owner | Open question Q-030 |

## 3. Performance (NFR-001 – NFR-003)

| # | Item | Status | How |
|---|---|---|---|
| P-1 | Lead list first page and dashboard p95 on a mid-range Android over 4G | Open | Lighthouse mobile on staging; record the p95 from `api_latency_ms` |
| P-2 | PDF ≤ 5 s warm, ≤ 12 s including cold start (CR-002) | Open | Issue 10 invoices on staging; read `pdf_render_ms` |
| P-3 | Sheet row → lead ≤ 1 min (webhook), ≤ 5 min (poll) | Open | Add rows in the staging sheet; time them |

## 4. Accessibility

| # | Item | Status | How |
|---|---|---|---|
| A-1 | Automated axe scan, WCAG 2.2 AA: 0 serious or critical | Done | E2E NFR-013 test, 17 screens |
| A-2 | Manual keyboard and screen-reader pass of the main journeys (TalkBack + NVDA) | Open | One pass on staging |

## 5. Data, backups and operations

| # | Item | Status | How |
|---|---|---|---|
| O-1 | Client config validated and the build branded | Open / Owner | `CLIENT_ID=<pilot> pnpm build` once `clients/<pilot>/config.json` exists (Q-032) |
| O-2 | Opening data imported (products, customers) — dry run on staging first | Open / Owner | Settings → Import products & customers; check the preview counts |
| O-3 | Composite indexes built | Open | `gcloud firestore indexes composite list`: all READY |
| O-4 | Backups scheduled (daily 7 d, weekly 5 w) | Open | RUNBOOK §3 step 5 |
| O-5 | Restore drill done (NFR-006) | Open | RUNBOOK §9: restore into a new database and spot-check |
| O-6 | Monitoring: uptime check, alerts, budget alerts | Open | RUNBOOK §6 |
| O-7 | Cloudflare WAF rate limit on `/api/*` | Open | RUNBOOK §3 step 7 |
| O-8 | Rollback rehearsed on staging (NFR-019) | Open | RUNBOOK §4.2: deploy the previous tag |
| O-9 | `.env.example` comment fixes (KI-08) | Open | Two-line manual edit |
| O-10 | CA review of the invoice formats: tax invoice, bill of supply, credit note (Q-027) | Owner | Send sample PDFs from staging |

## 6. Handover and sign-off

| # | Item | Status |
|---|---|---|
| H-1 | Support contact named (Q-031) | Owner |
| H-2 | Client admin trained; handover pack (RUNBOOK §12) | Open |
| H-3 | UAT sign-off by the product owner | Owner |
| H-4 | Go-live approval (Gate G9) | Owner |

| Role | Name | Decision | Date |
|---|---|---|---|
| Product owner | | | |
| Client admin (pilot) | | | |
