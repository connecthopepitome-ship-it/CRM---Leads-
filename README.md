# Claude Code SDLC Kit — Idea → BRD → FRD → UX → HLD → LLD → Code

A project configuration that makes Claude Code work like a full delivery team:
a **Senior Techno-Functional Consultant**, a **Senior UI/UX Designer**, a **Solution Architect**, a **Tech Lead** and a **QA Lead**. It takes you from a business idea to a tested, deployable application, with every document produced along the way.

## What's inside

```
CLAUDE.md                         Project rules, workflow, standards, default stack
.claude/settings.json             Safe permissions (no .env reads, asks before push / rm)
.claude/agents/                   5 specialist subagents
  techno-functional-consultant.md
  ux-designer.md
  solution-architect.md
  tech-lead.md
  qa-reviewer.md
.claude/commands/sdlc/            Phase-by-phase slash commands with approval gates
docs/00-project-brief.md          ← fill this in first
docs/templates/                   BRD, FRD, PROCESS-FLOWS, UX-SPEC, DESIGN-SYSTEM,
                                  SOLUTION-DESIGN, HLD, LLD, TEST-STRATEGY, ADR, RTM, STATUS
```

## Setup (5 minutes)

1. Install Claude Code and log in (see the official docs: https://docs.claude.com/en/docs/claude-code/overview).
2. Install Node.js 20+ and pnpm (`npm i -g pnpm`), plus Docker if you want a local Postgres.
3. Create your project folder and copy this kit into it:
   ```bash
   unzip claude-sdlc-kit.zip -d my-app
   cd my-app && git init
   ```
4. Open `docs/00-project-brief.md` and write what you know about the app.
5. Start Claude Code in the folder: `claude`
6. Type `/` to see the `sdlc:` commands, and `/agents` to see the team.

## Run the delivery, phase by phase

| Step | Type this in Claude Code | You get |
|---|---|---|
| 0 | `/sdlc:00-kickoff` | Discovery questions, refined brief, STATUS tracker |
| 1 | `/sdlc:01-brd` | Business Requirements Document |
| 2 | `/sdlc:02-frd` | Functional Requirements, use cases, rules, NFRs, data dictionary |
| 3 | `/sdlc:03-process-flows` | AS-IS / TO-BE swimlanes, state and sequence diagrams |
| 4 | `/sdlc:04-ux-design teal, calm, modern fintech` | Personas, journeys, IA, wireframes, design system, **clickable HTML prototype** |
| 5 | `/sdlc:05-solution-design` | Options analysis, build vs buy, rollout, cost |
| 6 | `/sdlc:06-hld` | C4 architecture, integrations, security, NFR design, ADRs |
| 7 | `/sdlc:07-lld all` | Per-module LLD: APIs, DB schema, sequences, OpenAPI |
| 8 | `/sdlc:08-test-strategy` | Test strategy + traced test cases |
| 9 | `/sdlc:09-scaffold` | Monorepo, design-system code, DB, CI — running and green |
| 10 | `/sdlc:10-build FR-001..FR-005` | One feature slice: DB → API → UI → tests (repeat per slice) |
| any | `/sdlc:11-review-gate` | Independent QA review with PASS/FAIL verdict |
| any | `/sdlc:12-traceability` | Refreshed traceability matrix + gap report |
| any | `/sdlc:change-request <change>` | Impact analysis before anything changes |
| 13 | `/sdlc:13-release 1.0.0` | Release notes, runbook, go-live checklist |

After each phase Claude stops, summarises, lists open questions and waits. Reply **"approved"** (or give changes) to move on.

## Tips
- **Plan mode** (Shift+Tab) is useful before big build slices: Claude shows the plan before editing.
- Use `/clear` between phases to keep context small; everything important lives in `docs/` and `docs/STATUS.md`, so nothing is lost.
- Diagrams are Mermaid: preview them in VS Code (Markdown Preview Mermaid Support extension), GitHub, or https://mermaid.live.
- Different stack? Tell Claude at kickoff (e.g. "Java Spring Boot + Angular on Azure"). It records an ADR and follows it; update CLAUDE.md §3 and §8 to match.
- Want Word/PDF versions of the docs for stakeholders? Ask: "Export BRD.md and FRD.md to .docx with a cover page" (uses pandoc).
- Call a specialist directly anytime: "Use the ux-designer agent to review the Orders screens against the UX spec."
