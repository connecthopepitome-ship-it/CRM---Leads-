---
description: Phase 9 — scaffold the monorepo, tooling, CI, design-system code and a running hello-world.
---

Lead: **tech-lead** agent, with **ux-designer** for the UI kit.

1. Gates G6–G8 must be approved for MVP scope.
2. Following the HLD and ADRs (default stack in CLAUDE.md §3), scaffold a pnpm monorepo:
   - `apps/web` (frontend), `apps/api` (backend), `packages/ui` (design-system components), `packages/config` (eslint, tsconfig, tailwind preset), `packages/types` (shared types/Zod schemas).
   - Tailwind theme + CSS variables generated from `docs/04-ux/design-system.md` tokens; light/dark mode.
   - Base layout, navigation shell, auth wiring stub, error boundary, 404/500 pages, toast system.
   - Prisma schema from the LLD tables, first migration and seed script with realistic data.
   - Health endpoint, structured logging, problem+json error handler, RBAC guard.
   - Vitest, Supertest, Playwright + axe configured with one passing test each.
   - ESLint, Prettier, Husky + lint-staged, `.env.example`, `docker-compose.yml` (Postgres), GitHub Actions CI (install → lint → typecheck → test → build).
   - README with setup and run instructions.
3. Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` and fix everything until green.
4. Update CLAUDE.md §8 if commands differ. Commit: `chore: scaffold project`.
5. Update STATUS and report what runs and how to start it.
