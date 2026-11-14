---
description: Phase 4 — UX research outputs, IA, user flows, wireframes, design system and a clickable HTML prototype.
argument-hint: [optional brand notes: colours, tone, reference apps]
---

Lead: **ux-designer** agent.

Brand and style notes: $ARGUMENTS

1. Gate G3 must be approved.
2. If no brand direction exists, propose 2–3 visual directions (name, mood, type pairing, palette, sample component) and ask the user to choose one before continuing.
3. Create `docs/04-ux/UX-SPEC.md` from `docs/templates/UX-SPEC.md`: personas, journey maps, IA/sitemap (Mermaid), navigation, user flows per UC, screen inventory `SCR-xxx` with all states, interaction patterns, microcopy, accessibility notes.
4. Create `docs/04-ux/design-system.md` from `docs/templates/DESIGN-SYSTEM.md`: tokens (colour light/dark, type scale, spacing, radius, elevation, motion, breakpoints) plus a component catalogue `CMP-xxx` with variants, states and a11y rules.
5. Create low-fi wireframes in `docs/04-ux/wireframes/SCR-xxx.md`.
6. Build a clickable prototype in `docs/04-ux/prototype/index.html` (single self-contained HTML, Tailwind via CDN, tokens as CSS variables, realistic sample data, working navigation across the main journeys, responsive, keyboard accessible).
7. Run an accessibility and heuristic self-review (Nielsen's 10 heuristics + WCAG 2.2 AA) and fix issues.
8. Update the RTM (FR/UC → SCR, CMP). Update STATUS and stop at **Gate G4**; tell the user to open the prototype in a browser.
