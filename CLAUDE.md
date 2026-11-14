# CLAUDE.md — Project Operating Manual

You are working on a project that is built **end-to-end with Claude Code**, from business idea to deployed application.
You work as a delivery team made of these roles, each defined in `.claude/agents/`:

| Role | Agent | Owns |
|---|---|---|
| Senior Techno-Functional Consultant | `techno-functional-consultant` | Discovery, BRD, FRD, process flows (AS-IS / TO-BE), traceability |
| Senior UI/UX Designer | `ux-designer` | Personas, journeys, IA, wireframes, design system, UX spec, prototypes |
| Solution Architect | `solution-architect` | Solution design, HLD, ADRs, NFRs, integration and security design |
| Tech Lead / Senior Developer | `tech-lead` | LLD, code, scaffolding, APIs, DB, CI/CD |
| QA & Review Lead | `qa-reviewer` | Test strategy, test cases, review gates, traceability checks |

---

## 1. Golden rules

1. **Docs before code.** Code is not written for a feature until its FRD requirement, UX screen and LLD section exist and are approved.
2. **Everything is traceable.** Every artifact uses stable IDs and links back to its source:
   `BR-xxx` (business req) → `FR-xxx` (functional req) → `NFR-xxx` → `UC-xxx` (use case) → `PF-xxx` (process flow) → `SCR-xxx` (screen) → `CMP-xxx` (component) → `API-xxx` → `TBL-xxx` → `TC-xxx` (test case).
   The matrix lives in `docs/09-traceability/RTM.md` and must be updated whenever an ID is added or changed.
3. **Never invent business facts.** If something is unknown, write it in the doc's *Open Questions* section as `Q-xxx` and ask the user. Mark assumptions as `A-xxx`.
4. **Stop at gates.** After each phase, summarise what was produced, list open questions, and wait for the user to say "approved" before starting the next phase (see §4).
5. **Templates are mandatory.** Create every document from `docs/templates/`. Don't drop sections; write "N/A — reason" when a section doesn't apply.
6. **Diagrams as code.** All diagrams use Mermaid in Markdown (flowchart, sequenceDiagram, erDiagram, stateDiagram-v2, C4 via flowchart). No image-only diagrams.
7. **Small, reviewable changes.** Build one feature slice at a time, with tests, and a commit per slice using Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
8. **Decisions are recorded.** Any significant technical choice gets an ADR in `docs/06-hld/adr/ADR-xxx-title.md`.

---

## 2. Repository layout

```
.
├── CLAUDE.md                      # this file
├── .claude/
│   ├── settings.json              # permissions
│   ├── agents/                    # role definitions (subagents)
│   └── commands/sdlc/             # phase-by-phase slash commands
├── docs/
│   ├── 00-project-brief.md        # ← the user fills this in first
│   ├── 01-brd/BRD.md
│   ├── 02-frd/FRD.md
│   ├── 03-process/PROCESS-FLOWS.md
│   ├── 04-ux/UX-SPEC.md  + design-system.md + wireframes/
│   ├── 05-solution/SOLUTION-DESIGN.md
│   ├── 06-hld/HLD.md  + adr/
│   ├── 07-lld/LLD-<module>.md
│   ├── 08-test/TEST-STRATEGY.md  + test-cases/
│   ├── 09-traceability/RTM.md
│   ├── 10-ops/RUNBOOK.md
│   ├── STATUS.md                  # phase tracker, kept current by Claude
│   └── templates/                 # source templates — do not edit per project
├── apps/                          # application code (created in Build phase)
│   ├── web/                       # frontend
│   └── api/                       # backend
├── packages/                      # shared libs (ui kit, types, config)
└── infra/                         # IaC, docker, CI/CD
```

---

## 3. Default technology stack

> **SaleSphere CRM overrides this default** (brief §7, ADR-001 – ADR-014). The project uses:
> React 18 + Vite PWA + TanStack Query + Tailwind (token preset in `packages/ui`) · Express 5 on Firebase Cloud Functions 2nd gen
> (`asia-south1`) · Firestore behind a hexagonal `Db` port (`apps/api/src/db`) · built-in auth (argon2id, EdDSA JWT, refresh cookie, TOTP) ·
> Google Sheets/Drive/Gmail via OAuth · Cloudflare Pages + a Pages Function proxy (`apps/web/functions`) · Vitest, Supertest, Playwright + axe ·
> pnpm workspaces (`corepack pnpm`), GitHub Actions (`.github/workflows/ci.yml`, `deploy.yml`). There is no PostgreSQL/Prisma/NestJS/Next.js.

Use this unless the project brief or an ADR says otherwise:

- **Frontend:** Next.js (App Router) + TypeScript (strict), Tailwind CSS, shadcn/ui built on Radix, React Hook Form + Zod, TanStack Query
- **Backend:** NestJS (TypeScript) REST API with OpenAPI, or Next.js route handlers for small apps
- **Database:** PostgreSQL + Prisma ORM, with migrations committed
- **Auth:** OIDC / OAuth2 (Auth.js, or Keycloak / Entra ID for enterprises), RBAC
- **Testing:** Vitest (unit), Supertest (API), Playwright (E2E + accessibility via axe)
- **Quality:** ESLint, Prettier, Husky + lint-staged, TypeScript strict mode
- **Delivery:** Docker, GitHub Actions (lint → test → build → deploy), env config via `.env.example`
- **Observability:** structured JSON logs (pino), OpenTelemetry-ready, health endpoints

---

## 4. Delivery workflow (phases and gates)

Run the phases in order with the slash commands. Each command says which agent leads.

| # | Command | Output | Gate |
|---|---|---|---|
| 0 | `/sdlc:00-kickoff` | `docs/STATUS.md`, refined brief, stakeholder list, open questions | G0: scope agreed |
| 1 | `/sdlc:01-brd` | `docs/01-brd/BRD.md` | G1: business sign-off |
| 2 | `/sdlc:02-frd` | `docs/02-frd/FRD.md` (FR, NFR, use cases, business rules, data dictionary) | G2: functional sign-off |
| 3 | `/sdlc:03-process-flows` | `docs/03-process/PROCESS-FLOWS.md` (AS-IS, TO-BE, swimlanes, state models) | G3: process sign-off |
| 4 | `/sdlc:04-ux-design` | UX spec, design system, wireframes, clickable HTML prototype | G4: UX sign-off |
| 5 | `/sdlc:05-solution-design` | `docs/05-solution/SOLUTION-DESIGN.md` | G5: solution approach agreed |
| 6 | `/sdlc:06-hld` | `docs/06-hld/HLD.md` + ADRs | G6: architecture sign-off |
| 7 | `/sdlc:07-lld <module>` | `docs/07-lld/LLD-<module>.md` per module | G7: design ready for build |
| 8 | `/sdlc:08-test-strategy` | test strategy + test cases | G8: test plan agreed |
| 9 | `/sdlc:09-scaffold` | repo scaffolding, CI, design-system code | — |
| 10 | `/sdlc:10-build <FR-ids or module>` | feature code + tests (one slice per run) | per-slice review |
| 11 | `/sdlc:11-review-gate` | gate review report (any time) | — |
| 12 | `/sdlc:12-traceability` | refreshed RTM + gap report | — |
| 13 | `/sdlc:13-release` | release notes, runbook, deployment checklist | G9: go-live |

Change requests: use `/sdlc:change-request <description>` — it does an impact analysis across all docs before anything changes.

**At every gate**, Claude must:
1. Update `docs/STATUS.md` (phase, status, date, artifacts, open questions).
2. Print a short summary: what was produced, key decisions, assumptions, open questions.
3. Ask the user for approval or changes. Never move on to the next phase on its own.

---

## 5. Documentation standards

- Markdown, one H1 per doc, numbered sections, a version table at the top (Version / Date / Author / Change).
- Requirements are written as **"The system shall …"**, atomic, testable, with MoSCoW priority and acceptance criteria in **Given / When / Then**.
- Every FR has: ID, title, description, priority, source BR, actors, pre-/post-conditions, business rules, acceptance criteria, UI reference, API reference.
- NFRs cover: performance, scalability, availability, security, privacy/compliance, accessibility (WCAG 2.2 AA), usability, maintainability, observability, localisation, browser/device support.
- Use tables for anything that will be compared or scanned.

## 6. UI/UX standards

- Mobile-first, responsive breakpoints: 360 / 768 / 1024 / 1280 / 1536.
- WCAG 2.2 AA: contrast ≥ 4.5:1 for text, visible focus, keyboard-operable, labelled form controls, touch targets ≥ 44×44 px.
- Design tokens (colour, type, spacing, radius, shadow, motion) are defined in `docs/04-ux/design-system.md` and implemented as CSS variables + Tailwind theme — **no hard-coded colours or spacing in components**.
- Every screen spec covers all states: default, loading (skeleton), empty, error, partial data, success, no permission.
- Microcopy: plain language, action-oriented buttons ("Save changes", not "OK"), error messages say what happened and how to fix it.

## 7. Coding standards

- TypeScript strict; no `any` without a comment explaining why.
- Validate all input at the boundary (Zod / class-validator). Never trust the client.
- No secrets in code; read config from env vars and document every var in `.env.example`.
- Every endpoint: authn, authz (RBAC check), validation, error mapping to RFC 7807 problem+json, audit log for state changes.
- Tests: unit tests for business rules, API tests for every endpoint, E2E for every critical user journey. Target ≥ 80% coverage on domain logic.
- Run `lint`, `typecheck` and `test` before saying a slice is done.

## 8. Commands Claude can rely on (after scaffolding)

```
corepack enable               # once per machine; otherwise prefix every command with `corepack pnpm`
pnpm install
pnpm dev                      # api on :8787 (in-memory DB + fake Google; admin / DEV_ADMIN_PASSWORD) + web on :5173
pnpm lint
pnpm typecheck
pnpm test                     # domain (≥ 80 % coverage gate), contracts, config, doc-templates, api (Supertest), web unit
pnpm test:e2e                 # builds nothing — run `pnpm --filter @ss/web build` first; Playwright journeys + axe
pnpm build                    # apps/web/dist (CLIENT_ID=<id> brands it from clients/<id>/config.json) + apps/api/dist
pnpm --filter @ss/api migrate # FR-006 migrations against GCLOUD_PROJECT (ADC) — replaces `db:migrate`
pnpm seed                     # provision a new install (FR-002)
node infra/gen-indexes.mjs    # regenerate infra/firestore.indexes.json (see header for re-recording query shapes)
node infra/rtm-coverage.mjs   # docs/09-traceability/TEST-COVERAGE.md; fails if a Must FR has no automated test
```
Update this section if the stack changes. Environment variables: `.env.example`. Operations: `docs/10-ops/RUNBOOK.md`.
