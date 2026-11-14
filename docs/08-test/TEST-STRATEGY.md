# Test Strategy — SaleSphere CRM

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (QA & review lead) | Initial strategy; 262 test cases generated 1:1 from FRD v0.3 acceptance criteria |

## 1. Scope & objectives
**In scope:** all 91 FRs (M1–M16), 22 NFRs, the 36 screens, the REST API (172 operations in `07-lld/openapi.yaml`), Firestore rules, scheduled jobs and the customer-facing share pages.
**Out of scope:** Google, Cloudflare, FCM and UPI app internals (tested only through contracts and fakes); Phase 2 features.

Objectives:
1. Every acceptance criterion has a test case (TC) and a passing automated test before release (exceptions listed in §6).
2. Money, tax, numbering and allocation are proven correct by unit tests with ≥ 80 % coverage of `packages/domain` (NFR-018), and 100 % of FRD worked examples (FR-052 AC1–AC4, FR-068 AC1–AC8, FR-071 AC1–AC4, FR-076 AC1–AC3) as fixed tests.
3. Zero High/Critical security findings (NFR-007, NFR-009) and zero serious/critical axe issues (NFR-013).

## 2. Test levels
| Level | Tool | What | Owner | Gate |
|---|---|---|---|---|
| Unit | Vitest | `packages/domain` (tax, totals, words, numbering, UPI, allocation, dedupe, assignment, SLA, outcomes, statement, ageing, erasure plan, search tokens), Zod contracts, React hooks | Tech lead | PR — must pass, coverage ≥ 80 % on domain |
| API / integration | Vitest + Supertest against the Express app with an in-memory repository; Firestore emulator suite for transactions and rules | Every endpoint: authn, authz (role × scope), validation, error codes, idempotency, If-Match, audit entry written (NFR-022 coverage test) | Tech lead | PR |
| Contract | OpenAPI validation of `openapi.yaml`; response schemas checked in API tests | Drift between LLD and code | Tech lead | PR |
| E2E | Playwright (Chromium, WebKit, mobile viewport 360 × 800) + @axe-core/playwright | Critical journeys J-01 – J-08 (§8), accessibility of all screens | QA | Pre-release |
| Security | OWASP ZAP baseline against staging; `pnpm audit`; secret scanning (gitleaks); manual ASVS L2 checklist; external review (Q-027) | NFR-007 – NFR-009 | QA + external | G9 |
| Performance | k6 against staging seeded to NFR-011 volumes; Lighthouse CI on a throttled mid-range profile | NFR-001 – NFR-004, NFR-022 | QA | G9 |
| Backup/restore | Runbook drill: export → restore to scratch project → erasure ledger re-apply | NFR-006, CR-001 | Product owner | G9 |
| UAT | Pilot client (freelance web developer, Solo mode) | §8 scenarios | Product owner + pilot | G9 |

## 3. Environments & test data
| Env | Purpose | Data |
|---|---|---|
| Local | Unit + API tests (in-memory repo), Firestore emulator for rules and transactions | Seed script `pnpm seed` (fixtures below) |
| CI (GitHub Actions) | lint → typecheck → unit → API → build → OpenAPI check | Same seed, ephemeral |
| Staging (per-release, `salesphere-staging` project) | E2E, ZAP, k6, restore drill | Synthetic volume seed (50,000 leads, 10,000 invoices) |
| Pilot install | UAT, then production | Client's real data after go-live only |

Fixtures (synthetic, no real personal data): company "Acme Interiors" (GSTIN 29ABCDE1234F1Z5, Karnataka), UPI `acme@okhdfcbank`, users for each role (admin, mgr, exec1, exec2, accounts, pm, viewer), web-services catalogue (SAC 998314), leads in every stage, a customer in Maharashtra (IGST), invoices A (₹10,000 due 1 Nov) and B (₹15,000 due 10 Nov) for the FR-071 examples.

## 4. Entry / exit criteria
| Level | Entry | Exit |
|---|---|---|
| Unit / API (per slice) | LLD approved; contracts defined | All tests green; domain coverage ≥ 80 %; lint/typecheck clean; audit-coverage test green |
| E2E | Slice merged to main; staging deployed | J-01 – J-08 green on Chromium + WebKit mobile; axe 0 serious/critical |
| Release (G9) | All Must FRs built | 100 % Must TCs passed or waived by product owner; 0 open Critical/High defects; NFR checks in §2 passed; restore drill done; CA review (A-022) and security review signed |

## 5. Defect management
GitHub Issues with labels `defect`, `sev:critical|high|medium|low`, `area:<module>`, linked to TC and FR IDs.

| Severity | Definition | Fix target |
|---|---|---|
| Critical | Wrong money/tax/number, data loss, security breach, app unusable | Before any further release |
| High | Must FR fails with no workaround | Before G9 |
| Medium | Should FR fails or Must FR has a workaround | Next release or waiver |
| Low | Cosmetic, copy | Backlog |

## 6. Risk-based priorities
| Risk | Area | Extra testing |
|---|---|---|
| R-009 incorrect GST | M7, M9 | Table-driven unit tests over intra/inter-state, rates 0/5/12/18/28, discounts, round-off; CA review of PDF formats |
| Duplicate document numbers (NFR-020) | M9, M10 | Emulator test issuing 50 invoices concurrently → 50 distinct consecutive numbers |
| Payment allocation atomicity | M10 | Concurrent payment + credit note test (E-05) |
| Sheet duplicate imports | M5 | Concurrent webhook + poll on same rows (FR-040 AC1); marker column deleted (E-30) |
| Auth (R-004) | M2 | Token rotation reuse detection, lockout, CSRF, epoch revocation ≤ 60 s (CR-003) |
| PII leakage | M2, M15 | Log scan test (no phone/email patterns in log output); audit masking test |
| Offline outbox | M13 | Playwright offline mode: note + call outcome queued, synced ≤ 1 min |

Waivers (automated testing not practical): FR-080 AC1/AC2 install prompts (manual on devices), FR-082 push delivery on iOS (manual), FR-091 (code review).

## 7. Test case format
Test cases live in `08-test/test-cases/TC-M<n>.md`, one row per acceptance criterion:

| Field | Meaning |
|---|---|
| TC | `TC-xxx`, stable, never reused |
| FR / AC | Source requirement and criterion |
| Priority | From the FR (MoSCoW) |
| Scenario | Given / When / Then (expected result = Then) |
| Level | Unit, API, E2E or Review |
| Automated in | Test file and test name, filled in during build |
| Status | Not run · Pass · Fail · Waived |

Automated tests carry the TC ID in their name (`it('TC-184 FR-062 AC1 …')`) so the RTM can be refreshed from test output.

## 8. UAT scenarios
| ID | Journey | Steps (summary) | FRs |
|---|---|---|---|
| J-01 | First setup (Solo) | Sign in as admin, change password, company + UPI, connect Google, map sheet | FR-007, FR-009, FR-017, FR-018, FR-037, FR-038 |
| J-02 | Lead from sheet to first call | Add sheet row → lead within 1 min → push → Call → outcome → follow-up | FR-039 – FR-041, FR-044, FR-049, FR-050 |
| J-03 | Quote to acceptance | Build 3-line quote → send via WhatsApp → open link as customer → Accept | FR-051 – FR-057 |
| J-04 | Invoice with UPI | Create invoice from accepted quote (silent order) → issue → share → QR shows balance | FR-059 AC4, FR-062 – FR-069 |
| J-05 | Collect payment | Record part payment with UTR → QR amount drops → receipt shared → full payment → PAID | FR-068, FR-070 – FR-072 |
| J-06 | Customer 360 and statement | Open 360 → ageing → statement PDF | FR-075, FR-076 |
| J-07 | Corrections | Credit note; reverse payment; revise quote | FR-054, FR-066, FR-073 |
| J-08 | Offline field work | Go offline → open lead → add note + call outcome → online → synced | FR-048, FR-081 |

## 9. Reporting
- CI publishes JUnit + coverage per run; the RTM `Test status` column is refreshed by `/sdlc:12-traceability` from TC IDs in test names.
- Release test report `08-test/TEST-REPORT-<version>.md`: TCs passed/failed/waived per module, open defects by severity, NFR results, and the go/no-go recommendation for G9.
