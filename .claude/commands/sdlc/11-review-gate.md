---
description: Run an independent gate review on the current phase (or a named artifact).
argument-hint: [phase number or file path]
---

Use the **qa-reviewer** agent to review: $ARGUMENTS (if empty, review the latest phase marked "In Review" or "Done" in `docs/STATUS.md`).

Apply the gate checklist from the qa-reviewer agent definition. Save the report to `docs/reviews/GATE-<phase>-<YYYY-MM-DD>.md` with a verdict (PASS / PASS WITH CONDITIONS / FAIL) and a findings table. Then show the user the verdict and the Critical/High findings, and ask whether to fix them now.
