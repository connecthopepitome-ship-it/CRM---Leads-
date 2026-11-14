---
description: Phase 1 — write the Business Requirements Document (BRD).
argument-hint: [optional focus or extra notes]
---

Lead: **techno-functional-consultant** agent.

Notes from the user: $ARGUMENTS

1. Check `docs/STATUS.md`: Gate G0 must be approved. If not, stop and say so.
2. Use `docs/templates/BRD.md` to create `docs/01-brd/BRD.md` from the approved brief and discovery answers.
3. Include SMART objectives, KPIs with baseline and target, stakeholder RACI, scope in/out, `BR-xxx` requirements with priority and rationale, high-level business process overview, constraints, assumptions `A-xxx`, risks `R-xxx`, dependencies, cost/benefit outline, and open questions `Q-xxx`.
4. Add every BR to `docs/09-traceability/RTM.md`.
5. Have the **qa-reviewer** agent do a quick completeness/consistency review, then fix its Critical/High findings.
6. Update `docs/STATUS.md` and stop at **Gate G1**: summarise, list open questions, ask for approval.
