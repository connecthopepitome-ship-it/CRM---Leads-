---
description: Phase 10 — build one vertical feature slice from approved FR/SCR/LLD, with tests.
argument-hint: <FR-ids, UC-id or module, e.g. "FR-010..FR-014" or "orders">
---

Lead: **tech-lead** agent. Review by **ux-designer** (UI) and **qa-reviewer** (tests/security).

Slice to build: $ARGUMENTS

1. Confirm the FRs, SCRs and LLD sections for this slice exist and are approved. If anything is missing or contradictory, stop and list the gaps.
2. Create a branch `feat/<slice-name>`.
3. Plan the slice (show the file list and steps), then implement in this order:
   DB migration → domain/business rules → API (validation, authz, errors, audit) → API tests → UI screens from the UX spec using `packages/ui` components and tokens (all states: loading/empty/error/success/no-permission) → component tests → Playwright E2E for the journey with an axe check.
4. Run `pnpm lint && pnpm typecheck && pnpm test` (and `pnpm test:e2e` if available). Fix until green.
5. Ask **ux-designer** to review the UI against `UX-SPEC.md` and **qa-reviewer** to review code + tests. Fix Critical/High findings.
6. Update OpenAPI, `.env.example`, RTM (FR → code path → TC status) and STATUS.
7. Commit with Conventional Commits referencing IDs. Report: implemented IDs, files, test results, known gaps, next suggested slice.
