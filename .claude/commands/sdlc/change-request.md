---
description: Raise a change request — impact analysis across all documents and code before anything changes.
argument-hint: <describe the change>
---

Lead: **techno-functional-consultant**, with **solution-architect** and **ux-designer**.

Change requested: $ARGUMENTS

1. Assign the next ID `CR-xxx` and log it in `docs/STATUS.md`.
2. Impact analysis table: every affected BR / FR / NFR / UC / PF / SCR / CMP / API / TBL / TC / code path, the type of change (add/modify/remove), effort (S/M/L), risk, and whether any approved gate must be re-opened.
3. Give options (do now / defer to next release / reject) with a recommendation.
4. **Do not change any document or code** until the user approves the CR. Once approved, update every affected artifact (bumping each doc's version table), update the RTM, and note the CR ID in each change.
