# BRD Review — SaleSphere CRM, BRD v0.1

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-11-13 | QA & Review Lead (independent) | Completeness and consistency review of `01-brd/BRD.md` v0.1 |

**Baseline:** brief v1.0 (G0), SD source, STATUS.md, RTM.md, templates/BRD.md, CLAUDE.md §1/§5. Read-only review; no BRD edits made.

**Checks that passed:** all 21 template sections are present and filled. The version table is present. All 7 objectives have KPI, baseline, target and measurement. Every BR links to an objective, and every objective has at least one BR. The RTM lists exactly BR-001 to BR-031 with matching priorities (26 Must, 5 Should). WhatsApp is click-to-chat in the MVP, with the API optional and paid by the client (CON-007, BR-031, §17). Payments are UPI QR with no gateway (BR-020/021, §5.3). Free Gmail is used (CON-002, DEP-001). Multi-tenant SaaS, GL, inventory and holding funds are out of scope, as in the brief. The Mermaid flowchart is syntactically plausible: the subgraph is closed, `<br/>` and the `|label|` / `-- text -->` edges are valid, and the `{}` decisions are well formed.

## Findings

| ID | Severity | Location | Issue | Recommended fix |
|---|---|---|---|---|
| F-01 | High | §8 BR-023, BR-027, BR-028, BR-029 | These are rated **Should**, but brief §4 lists them under "Must have — MVP": item 11 Ledger/Statement, item 13 global search, push and home dashboard, and item 14 basic reports. §5.1 items 10 and 12 also call them MVP scope. No decision in STATUS records the downgrade. | Make them Must to match the G0 baseline, or log a PO decision in STATUS and mark them as MVP-Should in §5.1. Update the RTM either way. |
| F-02 | High | §11 Retention; Q-019 | The text says "business documents **must** be kept for at least 8 years" as fact, yet Q-019 is still open to confirm the period. The source is unverified: the CGST Act s.36 requires about 72 months, and 8 years matches the Companies Act. This breaks golden rule 3. | Rephrase it as A-xxx ("assume 8 years pending Q-019") or move it fully to Q-019. Don't state it as a legal requirement. |
| F-03 | High | §3 OBJ-005 target | "−20 % DSO vs baseline" isn't in the brief, which only says "lower DSO", the SD or STATUS. It's an invented target. | Mark it as a proposed target with an A-xxx, or raise a Q-xxx for the PO to set it. |
| F-04 | Medium | §3 OBJ-001, OBJ-002, OBJ-005, OBJ-006 time bounds | The "within 3 months / 6 months of go-live" windows aren't in the brief. The brief only sets "5 installs within 6 months" for OBJ-006. | Tag the other time bounds as proposed (A-xxx) or get PO confirmation at G1. |
| F-05 | Medium | STATUS.md vs BRD §15, §16, §19 | The BRD adds A-006 to A-009, R-006 to R-010 and Q-018 to Q-020, but STATUS has none of them. STATUS A-004 also includes the India locale, while BRD A-004 doesn't (the locale is in CON-006). The IDs don't clash, but the registers have drifted. | Sync the STATUS assumptions, risks and open questions with the BRD, and align the A-004 wording. |
| F-06 | Medium | §8 BR-007, 008, 013, 014, 016, 017, 019, 020, 021, 026, 030 | These BRs are compound. For example, BR-008 covers timeliness, exactly-once import and failed-row visibility. BR-019 covers invoice types and credit notes. BR-030 covers residency, consent, export and erase. BR-007's "pre-filled by a template" is ambiguous. | Split the clearly separable parts (credit notes, offline, statement share, DPDP export/erase). If grouping stays, state that the FRD will decompose each into atomic FRs. Clarify "template" in BR-007. |
| F-07 | Medium | Brief §4 vs §8 | Some brief MVP items have no BR: Sheet **write-back** and sync log (item 5); **dark mode** and quick-add/swipe (item 13); payment screenshot (item 10); quote → proforma conversion (item 7); support login only with client consent (brief §3/§7, BRD §12). | Add these to existing BRs (BR-008, BR-021, BR-017/019, BR-006/030) or a new BR. Treat UI items as UX detail and note them in §5.1. |
| F-08 | Medium | §8 BR-031 | This BR has MVP priority Should, but the adapters themselves are Phase 2 (§5.3, brief §6). §5.1 doesn't list it. That leaves it unclear what the MVP must deliver. | Reword it as a "no-fork extensibility" quality that the MVP architecture must allow (or make it Could), and cross-reference Phase 2. |
| F-09 | Medium | §8 BR-004, 005, 006, 024, 030 → OBJ-006 | Security, audit and DPDP BRs are linked to "5 installs live". That link is weak and gives no real objective coverage. | Add an objective for trust and compliance (e.g. zero critical security findings at go-live and DPDP requests met within N days), or note OBJ-006 as a proxy. |
| F-10 | Low | §8 BR-014, source "SD §5" | SD §5 covers intelligent features, which are Phase 3 (speed-to-lead escalation). Showing SLA breaches is fine, but the citation suggests Phase 3 scope. | Cite SD §3.1/§8 (SLA timer) instead and say "no escalation in MVP". |
| F-11 | Low | §10 rule 3 vs BR-016 | Rule 3 says "above the user's **role** limit", while BR-016 says "above a discount threshold". | Use one term (e.g. "role-based discount limit") in both. |
| F-12 | Low | §10 rule 5 | "unless the order is amended" depends on order amendment, which has no BR. | Add it to BR-018 or remove the clause. |
| F-13 | Low | §4.1 / §9 / BR-005 | One role has three names: "Operations / Project Manager", "Project / Ops Manager" and "Project Manager". | Use "Project Manager" (SD §9.2) everywhere and add it to the glossary. |
| F-14 | Low | BR-030, §12 | "Data stored in India" reads as a DPDP legal mandate. The Act doesn't require localisation; it's a PO product decision (brief §7). | Say "by product decision" or cite the brief. |
| F-15 | Low | §17, §18 | "Domain (paid by the client)" and the week-by-week gate plan (G0–G3 in week 1, G4–G8 in week 2) aren't in the brief. | Tag them as assumptions or confirm them with the PO. |
| F-16 | Low | §13 CON-001 | Several brief §7 stack items are missing: Vite, Tailwind/shadcn, Secret Manager, Cloud Scheduler, GitHub Actions. | Complete the list, or reference brief §7 and the ADRs. |
| F-17 | Low | §8 BR-012, BR-020 | "Kanban" and "PAID stamp" are UI or solution detail inside BRs. | Acceptable, but consider moving them to the FRD/UX. |

## Verdict

**Pass with fixes.** The structure, objective/BR traceability and RTM alignment are sound, and the key PO decisions (WhatsApp, UPI-only, free Gmail) are reflected correctly. Before G1 sign-off, fix F-01 to F-03 (scope priority drift from the G0 baseline and invented facts) and sync STATUS (F-05). The remaining Medium findings can be fixed in v0.2 or carried into the FRD as decomposition notes.
