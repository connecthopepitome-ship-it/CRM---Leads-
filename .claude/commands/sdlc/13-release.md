---
description: Phase 13 — release readiness: release notes, runbook, deployment and go-live checklist.
argument-hint: [version, e.g. 1.0.0]
---

Leads: **solution-architect** (ops) and **qa-reviewer** (readiness).

Version: $ARGUMENTS

1. Run the full test suite and `/sdlc:12-traceability`; every Must FR needs passing tests.
2. Write `docs/10-ops/RELEASE-NOTES-<version>.md` (features by FR, known issues, breaking changes, migration steps).
3. Write or update `docs/10-ops/RUNBOOK.md`: architecture summary, environments, deploy and rollback steps, config/secrets list, monitoring dashboards and alerts, common incidents with fixes, backup/restore, contacts.
4. Produce a go-live checklist: security (dependency audit, secrets, headers, authz tests), performance against NFRs, accessibility audit, data migration dry-run, backups, monitoring, UAT sign-off, support handover.
5. Update STATUS and stop at **Gate G9 (go-live)**.
