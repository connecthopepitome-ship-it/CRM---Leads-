---
description: Phase 2 — write the Functional Requirements Document (FRD) with use cases, business rules, NFRs and data dictionary.
argument-hint: [optional module to focus on]
---

Lead: **techno-functional-consultant** agent. Consult **solution-architect** for NFR targets.

Focus: $ARGUMENTS

1. Gate G1 must be approved in `docs/STATUS.md`.
2. Create `docs/02-frd/FRD.md` from `docs/templates/FRD.md`.
3. Break every `BR-xxx` into atomic `FR-xxx` items ("The system shall…"), each with MoSCoW priority, actors, pre/post-conditions, business rules, and Given/When/Then acceptance criteria.
4. Write use cases `UC-xxx` (main, alternate and exception flows), a roles and permissions matrix (role × action CRUD), business rules `RULE-xxx`, data dictionary (entity, field, type, mandatory, validation, example, PII Y/N), notifications, reports, integrations and `NFR-xxx`.
5. Think through edge cases the user may have missed: duplicates, concurrency, cancellations/reversals, partial failures, timeouts, approvals/delegation, audit, data retention, bulk operations, i18n.
6. Update the RTM (BR → FR, NFR, UC).
7. Run a **qa-reviewer** testability review; fix Critical/High findings.
8. Update `docs/STATUS.md`; stop at **Gate G2**.
