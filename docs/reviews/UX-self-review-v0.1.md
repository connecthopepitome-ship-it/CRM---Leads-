# UX Self-Review — Phase 4 (v0.1)

| Version | Date | Reviewer | Scope |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (UX designer, self-review) | UX-SPEC v0.1, design-system v0.1, 36 wireframes, prototype `prototype/index.html` |

## 1. Method

| Check | How | Result |
|---|---|---|
| Colour contrast (WCAG 1.4.3, 1.4.11) | Computed relative-luminance ratios for every token pair in light and dark (script) | All text pairs ≥ 4.5:1; input borders ≥ 3:1 (3.7:1 dark) — **pass** |
| Structural a11y (WCAG 1.3.1, 2.4.x, 4.1.2) | axe-core 4.10.2 on 19 prototype routes in jsdom (contrast rule disabled because jsdom has no layout) | v0.1: 2 moderate issue types (duplicate `nav` labels ×17, heading-order ×4) → **fixed**; re-run: **0 violations** |
| Functional journeys | Scripted test of the prototype (44 checks): sign-in incl. wrong password, all routes have an `<h1>`, board "Move to", call outcome + SLA update, quote totals, send, customer accept, invoice issue with QR, UPI payload, duplicate UTR, part payment updates QR, PAID stamp, search by phone/number, Esc closes dialog, offline banner, ageing bucket | **44/44 pass** |
| Diagrams | Mermaid 11.4.1 parser on UX-SPEC | 15/15 valid |
| Heuristics | Nielsen's 10 against the spec and prototype | See §2 |

**Not yet verified (needs a real browser, Phase 8):** rendered contrast of the Tailwind classes on real layout, 400 % zoom/reflow, screen-reader announcements (NVDA/TalkBack/VoiceOver), touch-target measurement, prefers-reduced-motion behaviour. These are added to the test strategy as `TC` items (Phase 8 — Playwright + axe in Chromium).

## 2. Nielsen's 10 heuristics

| # | Heuristic | Evidence | Issue found | Fix / status |
|---|---|---|---|---|
| H1 | Visibility of system status | SLA chips, "Viewed 3×", sync badge, offline banner, Google banner, autosave "Saved" | Quote builder showed "Saved" with no saving state | Spec: "Saving…/Saved" indicator (SCR-010); prototype shows Saved only — **accepted for prototype** |
| H2 | Match with the real world | ₹ + lakh grouping, UTR, UPI ID, GSTIN, "mobile number", Indian FY | "Bill of Supply" may confuse non-GST freelancers | Helper text on invoice type: "For businesses not registered for GST" — **added to SCR-014 microcopy** |
| H3 | User control & freedom | Undo on stage change, follow-up done, line removal; Esc closes sheets; back links | Line removal Undo not wired in prototype | Spec defines Undo (CMP-029); prototype shows toast only — **accepted for prototype** |
| H4 | Consistency & standards | Same ActionBar on lead/customer/contact; one share sheet; status colour map | Two different "Main" nav landmarks | Renamed "Main navigation" / "Tab bar" — **fixed** |
| H5 | Error prevention | Issue-invoice confirm, duplicate UTR check, qty ≤ pending, lost reason required, typed-name accept | — | — |
| H6 | Recognition over recall | Templates with live preview, quick filters, recent searches, presets for follow-ups | — | — |
| H7 | Flexibility & efficiency | Swipe actions, Ctrl/Cmd + K, FAB quick add, keyboard Kanban "Move to", saved filters | — | — |
| H8 | Aesthetic & minimalist design | Single accent, progressive disclosure ("More", collapsed stage change) | Customer 360 has 9 tabs + 8 tiles — dense on 360 px | Tiles scroll horizontally; tabs scroll; Overview first — **kept**, verify in usability test T6 |
| H9 | Help users recover from errors | Messages state cause + action ("Only 6 left to invoice") | — | — |
| H10 | Help & documentation | Inline helper text, Apps Script setup instructions in wizard, "Ask your admin" messages | No in-app help centre in MVP | Help link in user menu (consistent help, WCAG 3.2.6) — **in spec** |

## 3. WCAG 2.2 AA spot checks

| Criterion | Status | Note |
|---|---|---|
| 1.3.1 Info & relationships | ✅ | Labels, fieldsets with legends (outcome, mode), tables with captions |
| 1.4.1 Use of colour | ✅ | Status chips carry text; Overdue labelled in text |
| 1.4.3 / 1.4.11 Contrast | ✅ tokens / ⏳ rendered | Tokens computed; rendered check in Phase 8 |
| 1.4.10 Reflow | ⏳ | Layout designed for 320 px; verify in browser |
| 2.1.1 Keyboard | ✅ | All actions are buttons/links; drag has "Move to" select; swipe has buttons |
| 2.4.3 Focus order / 2.4.7 visible | ✅ | Focus moves to `<h1>` on route change; dialogs trap and restore focus; `:focus-visible` ring |
| 2.4.11 Focus not obscured | ⚠️ | Sticky mobile ActionBar may cover focused fields near the bottom → `scroll-padding-bottom` added on `main`; verify in browser |
| 2.5.7 Dragging movements | ✅ | Non-drag alternatives everywhere |
| 2.5.8 Target size | ✅ | `min-h-[44px]` on controls |
| 3.2.6 Consistent help | ✅ | Help in the same menu location |
| 3.3.1 / 3.3.3 Error identification & suggestion | ✅ | `role="alert"` messages with remedy; `aria-invalid` on UTR |
| 3.3.7 Redundant entry | ✅ | Data carried lead → customer → quote → invoice |
| 3.3.8 Accessible authentication | ✅ | Paste allowed; no puzzle CAPTCHA (honeypot) |
| 4.1.2 Name, role, value | ✅ | Tabs, radiogroups, dialogs with `aria-labelledby`; icon buttons labelled |

## 4. Outcome

No Critical or High issues remain. 2 axe issue types fixed; 2 heuristic items addressed in the spec; 3 prototype-only simplifications accepted (autosave states, Undo wiring, some screens represented by toasts: convert dialog, email composer, credit note). Rendered-browser checks are carried into the Phase 8 test strategy.
