---
description: Phase 0 — project kickoff and discovery. Reads the project brief, asks discovery questions, sets up docs/STATUS.md.
argument-hint: [optional one-line idea if the brief is empty]
---

Lead: **techno-functional-consultant** agent, with input from **ux-designer** and **solution-architect**.

Extra input from the user: $ARGUMENTS

1. Read `CLAUDE.md` and `docs/00-project-brief.md`. If the brief is mostly empty, use $ARGUMENTS as the starting idea.
2. Restate the problem, target users, business goals and success metrics in your own words.
3. Run a discovery round. Ask at most 15 questions grouped by theme (business goals and KPIs, users and roles, key journeys, scope in/out, data and integrations, compliance and security, scale/NFRs, timeline/budget, branding/UX expectations, deployment preferences). For each question, give a recommended default the user can accept with "use defaults".
4. Once answered, update `docs/00-project-brief.md` with the refined brief.
5. Create `docs/STATUS.md` from `docs/templates/STATUS.md`, mark Phase 0 "In review", and log decisions, assumptions and open questions.
6. Create empty folders `docs/01-brd` … `docs/10-ops`, `docs/reviews`, and copy `docs/templates/RTM.md` to `docs/09-traceability/RTM.md`.
7. Stop at **Gate G0**: summarise scope and ask the user to approve before running `/sdlc:01-brd`.
