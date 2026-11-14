---
description: Phase 6 — High-Level Design (HLD) with C4 diagrams, integration, data, security, NFRs, deployment and ADRs.
---

Lead: **solution-architect** agent.

1. Gate G5 must be approved.
2. Create `docs/06-hld/HLD.md` from `docs/templates/HLD.md`.
3. Include C4 context + container diagrams, module/bounded-context breakdown, tech stack table, integration specs, conceptual data model (erDiagram), security architecture and RBAC, NFR realisation table (NFR-ID → design mechanism → how it's verified), environments and deployment topology, CI/CD pipeline, observability, resilience and DR.
4. Write an ADR in `docs/06-hld/adr/` (template `docs/templates/ADR.md`) for each major decision: architecture style, frontend framework, backend framework, database, auth, hosting, messaging/caching if used.
5. Have **qa-reviewer** review for NFR coverage and security; fix Critical/High findings.
6. Update the RTM (NFR → HLD section). Update STATUS and stop at **Gate G6**.
