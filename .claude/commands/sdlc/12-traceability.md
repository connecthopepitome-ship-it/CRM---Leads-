---
description: Rebuild the requirements traceability matrix and report gaps.
---

Use the **techno-functional-consultant** agent with **qa-reviewer**.

1. Scan all docs in `docs/` and the code (`apps/`, `packages/`) for IDs: BR, FR, NFR, UC, RULE, PF, SCR, CMP, API, TBL, TC.
2. Rebuild `docs/09-traceability/RTM.md`: one row per FR with BR source, UC, PF, SCR, API, TBL, TC, code location, test status, and coverage status (✅ complete / ⚠️ partial / ❌ missing).
3. Produce a gap report: orphan IDs, FRs without tests, FRs without UI/API, screens without FRs, IDs referenced but not defined.
4. Show the summary counts and the top gaps to the user.
