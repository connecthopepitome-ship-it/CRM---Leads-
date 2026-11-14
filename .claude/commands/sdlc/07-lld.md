---
description: Phase 7 — Low-Level Design (LLD) for one module (or all modules if none given).
argument-hint: <module-name | all>
---

Lead: **tech-lead** agent, reviewed by **solution-architect**.

Module: $ARGUMENTS

1. Gate G6 must be approved.
2. For the module (or each module in the HLD if "all" or empty), create `docs/07-lld/LLD-<module>.md` from `docs/templates/LLD.md`.
3. Include: linked FRs/SCRs, folder structure, class/component diagram, sequence diagrams (happy + error paths), API contracts `API-xxx` with example request/response JSON, DB tables `TBL-xxx` with columns/types/constraints/indexes and an erDiagram, state machines, validation rules ↔ `RULE-xxx`, error code catalogue, events/jobs, caching, config/env vars, audit/logging events, unit-test plan, and the front-end component tree per screen (`SCR-xxx` → `CMP-xxx`, state management, data fetching).
4. Produce/refresh `docs/07-lld/openapi.yaml` (OpenAPI 3.1) for the module's endpoints.
5. Update the RTM (FR → API, TBL). Update STATUS and stop at **Gate G7** for this module.
