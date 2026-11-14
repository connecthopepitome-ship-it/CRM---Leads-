# ADR-001: Per-client isolated serverless install with a modular-monolith API and hexagonal domain core

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** NFR-005, NFR-010, NFR-012, NFR-018, NFR-019; FR-001, FR-002, FR-006, FR-091; CON-001, CON-003

## Context
SaleSphere is resold as a fresh install per client (BRD BR-001, CON-003). The product owner builds and operates it largely alone with Claude Code (CON-004). Per-client running cost must stay ≈ free tiers (NFR-012), and data must be isolated per client and kept in India (NFR-010). The Solution Design (Option A, score 4.00) chose Firebase + Cloudflare; this ADR fixes the internal architecture style.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Microservices per bounded context | Independent scaling and deploys | Far too much operational overhead per client; more cold starts; distributed transactions for invoice + payment |
| Modular monolith API (one HTTP function) + a few specialised functions (PDF, jobs, triggers), hexagonal domain | One warm path → fewer cold starts; transactions in one place; simple deploy; domain testable without Firebase; swappable adapters (lock-in mitigation) | Module boundaries must be enforced by code structure and lint rules, not by network |
| Multi-tenant SaaS | Cheapest at scale | Contradicts CON-003 (rejected in Solution Design §4.3) |

## Decision
We will deploy **one isolated install per client** (own Firebase project, Cloudflare Pages project, Google account). Inside each install the backend is a **modular monolith**: one HTTP API function containing bounded-context modules, plus specialised functions for PDF rendering, scheduled jobs and Firestore triggers. Business rules live in a pure TypeScript `packages/domain` (no I/O); infrastructure lives in `packages/adapters` behind interfaces (ports). Module boundaries are enforced with ESLint import rules (`eslint-plugin-boundaries`).

## Consequences
**Positive:** low cost and ops per client; simple transactions; domain logic unit-testable (NFR-018) and portable to PostgreSQL if ever needed. **Negative:** a single API function scales as one unit (acceptable at A-002 volumes); every client is a separate cloud project to manage (R-014). **Follow-up:** boundaries lint rule in Phase 9 scaffold; credentials inventory in runbook.
