# ADR-014: pnpm workspaces + Turborepo monorepo, TypeScript strict, Vitest, Playwright, Firebase Emulator Suite

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** NFR-018, NFR-019, NFR-013; CLAUDE.md §7, §8

## Context
One repository must hold the web app, API, shared domain/contracts/UI packages, per-client configs and infrastructure, with fast CI and local development without cloud access.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| pnpm + Turborepo | Fast, cached tasks; strict deps | Tool learning |
| npm workspaces only | Simple | No task caching |
| Nx | Powerful | Heavier than needed |

## Decision
We will use **pnpm workspaces + Turborepo**: `apps/web`, `apps/api`, `packages/{domain,contracts,adapters,ui,config,doc-templates}`, `clients/*`, `infra/`. Quality: TypeScript strict, ESLint (+ boundaries, jsx-a11y), Prettier, Husky + lint-staged. Tests: **Vitest** (unit, domain ≥ 80 %), **Supertest** against the Express app with the **Firebase Emulator Suite** (API), **Playwright + @axe-core/playwright** (E2E + accessibility). Commands per CLAUDE.md §8 (`pnpm dev` runs Vite + emulators; `db:migrate` runs Firestore migration scripts).

## Consequences
**Positive:** one place, fast CI, offline local dev. **Negative:** `db:migrate` semantics differ from Prisma — documented. **Follow-up:** CLAUDE.md §3/§8 update at scaffold (Phase 9).
