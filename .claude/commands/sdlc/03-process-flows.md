---
description: Phase 3 — AS-IS / TO-BE process flows, swimlanes and state models in Mermaid.
---

Lead: **techno-functional-consultant** agent.

1. Gate G2 must be approved.
2. Create `docs/03-process/PROCESS-FLOWS.md` from `docs/templates/PROCESS-FLOWS.md`.
3. For each key business process `PF-xxx`:
   - AS-IS flow (if a current process exists) with pain points marked.
   - TO-BE flow as a Mermaid swimlane flowchart (`subgraph` per actor/system), including decisions, exceptions, SLAs and system touchpoints.
   - Pain point → improvement → FR mapping table.
4. Add a level-0 end-to-end value-chain diagram, and a `stateDiagram-v2` for every entity with a lifecycle.
5. Add sequence diagrams for flows that cross system boundaries (integrations, payments, notifications).
6. Check every diagram renders as valid Mermaid (balanced subgraphs, quoted labels with special characters).
7. Update the RTM (FR/UC → PF). Update STATUS and stop at **Gate G3**.
