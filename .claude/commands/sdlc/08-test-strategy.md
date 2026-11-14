---
description: Phase 8 — test strategy and test cases traced to requirements.
---

Lead: **qa-reviewer** agent.

1. Gate G7 must be approved for at least the MVP modules.
2. Create `docs/08-test/TEST-STRATEGY.md` from `docs/templates/TEST-STRATEGY.md`.
3. Write test cases `TC-xxx` in `docs/08-test/test-cases/<module>.md` covering every Must/Should FR: positive, negative, boundary, role-based, and accessibility checks for each screen. Mark which will be automated (unit / API / E2E).
4. Define UAT scenarios from the top user journeys in the UX spec.
5. Update the RTM (FR → TC). Update STATUS and stop at **Gate G8**.
