# Design System — SaleSphere CRM

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Claude (UX designer) | Initial tokens and component catalogue for MVP |

## 1. Brand principles & visual direction

**Direction: "Clear Ledger".** This builds on the approved brief §8: primary blue `#2563EB`, the Inter typeface, and light and dark modes. Every client overrides logo, primary colour, app name and icon (FR-003).

| Principle | What it means in the UI |
|---|---|
| **Thumb-first, then desk** | Mobile layouts come first. Primary actions sit in the bottom third of the screen, and touch targets are at least 44 px. Desktop adds density, using split views and tables. |
| **Money reads at a glance** | Amounts use tabular numerals, are right-aligned, and use Indian grouping (₹12,34,567.00). Balance due always appears next to its QR. |
| **Calm, neutral canvas** | A slate neutral palette with one brand accent. Colour carries status and is always paired with text or an icon. |
| **Brandable without breaking** | Clients change only the brand tokens (`--color-primary*`, logo). Every other token is fixed so contrast stays valid. A client colour is checked for at least 4.5:1 contrast when saved (FR-003 AC3). |

Mood: trustworthy, quick and Indian-SMB friendly. It should feel close to a modern UPI app rather than enterprise software.

## 2. Design tokens

Tokens are implemented as CSS custom properties on `:root` and `[data-theme="dark"]`, and mapped into the Tailwind theme (`colors.primary = 'rgb(var(--color-primary) / <alpha-value>)'`, etc.). **Components never use raw hex values or spacing.**

### 2.1 Colour

Contrast ratios were computed against the stated background (WCAG 2.x relative luminance).

| Token | Light | Dark | Usage | Contrast (L / D) |
|---|---|---|---|---|
| --color-bg | #F8FAFC | #0B1220 | Page background | — |
| --color-surface | #FFFFFF | #111827 | Cards, panels, sheets | — |
| --color-surface-2 | #F1F5F9 | #1F2937 | Table header, zebra rows, inputs (disabled) | — |
| --color-text | #0F172A | #F1F5F9 | Body text, headings | 17.9 / 16.2 on surface |
| --color-text-muted | #475569 | #94A3B8 | Secondary text, captions | 7.6 / 6.9 on surface |
| --color-border | #E2E8F0 | #334155 | Dividers, card borders (decorative) | — |
| --color-border-input | #64748B | #64748B | Input and checkbox borders (UI component) | 4.8 / 3.7 on surface (≥ 3:1) |
| --color-primary | #2563EB | #60A5FA | Primary buttons, links, focus ring, active nav | 5.2 / 7.0 on surface |
| --color-primary-hover | #1D4ED8 | #93C5FD | Hover/pressed primary | — |
| --color-primary-fg | #FFFFFF | #0B1220 | Text/icon on primary | 5.2 / 7.4 |
| --color-primary-subtle | #EFF6FF | #172554 | Selected rows, active tab background | primary-hover text 6.2 / 8.2 |
| --color-success | #15803D | #4ADE80 | Paid, Accepted, Connected | 5.0 / 10.2 |
| --color-success-subtle | #F0FDF4 | #052E16 | Success chip background | 4.8 / 8.6 |
| --color-warning | #B45309 | #FBBF24 | Due soon, Pending approval, SLA near | 5.0 / 10.6 |
| --color-warning-subtle | #FFFBEB | #3B2A06 | Warning chip background | 4.8 / 8.3 |
| --color-danger | #B91C1C | #F87171 | Overdue, errors, destructive actions | 6.5 / 6.4 |
| --color-danger-subtle | #FEF2F2 | #3F0D0D | Error banner background | 5.9 / 8.7 (danger-300 text in dark) |
| --color-info | #0369A1 | #38BDF8 | Informational banners, Viewed status | 5.9 / 8.3 |
| --color-focus | = primary | = primary | 2 px focus ring with 2 px offset | 4.9 / 7.4 on bg |
| --color-overlay | rgb(15 23 42 / .5) | rgb(0 0 0 / .6) | Modal/sheet scrim | — |

**Status → colour map (always with a text label):**

| Status family | Examples | Token |
|---|---|---|
| Positive | Won, Accepted, Paid, Connected, Synced | success |
| Attention | Pending approval, Due today, SLA < 5 min, Partly paid | warning |
| Negative | Overdue, Lost, Rejected, SLA breached, Failed, Locked | danger |
| Neutral/info | Draft, Sent, Viewed, New, Expired | info / text-muted |

### 2.2 Typography

Font: **Inter** (variable, self-hosted, `font-display: swap`), falling back to `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif`. **Noto Sans Devanagari / Tamil / Telugu / Bengali** are fallbacks for Indic names (NFR-017). Numbers use `font-variant-numeric: tabular-nums` in tables and amounts.

| Token | Font | Size / line-height | Weight | Usage |
|---|---|---|---|---|
| display | Inter | 32 / 40 px | 600 | Big KPI values, PAID stamp |
| h1 | Inter | 24 / 32 px | 600 | Page titles |
| h2 | Inter | 20 / 28 px | 600 | Section titles, sheet titles |
| h3 | Inter | 18 / 26 px | 600 | Card titles |
| h4 | Inter | 16 / 24 px | 600 | Sub-sections, table group headers |
| body | Inter | 16 / 24 px | 400 | Default text (mobile minimum 16 px to prevent iOS zoom) |
| body-sm | Inter | 14 / 20 px | 400 | Dense tables (desktop), secondary lines |
| label | Inter | 14 / 20 px | 500 | Form labels, buttons |
| caption | Inter | 12 / 16 px | 500 | Chips, timestamps, helper text |
| mono | ui-monospace, "JetBrains Mono", monospace | 14 / 20 px | 400 | UTR, GSTIN, document numbers, codes |

### 2.3 Spacing (4 px base)

`--space-0` 0 · `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-6` 24 · `--space-8` 32 · `--space-12` 48 · `--space-16` 64 px.
Page gutter: 16 px (mobile), 24 px (≥ 768), 32 px (≥ 1280). Card padding: 16 px mobile, 24 px desktop. List row height: 64 px mobile (2 lines), 48 px desktop table row.

### 2.4 Radius, elevation, borders

| Token | Value | Usage |
|---|---|---|
| --radius-sm | 6 px | Chips, inputs (desktop) |
| --radius-md | 10 px | Buttons, inputs, cards |
| --radius-lg | 16 px | Sheets, dialogs, KPI tiles |
| --radius-full | 9999 px | Avatars, FAB, pills |
| --shadow-1 | 0 1px 2px rgb(15 23 42 / .06), 0 1px 3px rgb(15 23 42 / .10) | Cards |
| --shadow-2 | 0 4px 12px rgb(15 23 42 / .12) | Dropdowns, FAB |
| --shadow-3 | 0 12px 32px rgb(15 23 42 / .20) | Dialogs, sheets |
| --border-width | 1 px | All borders; 2 px for focus ring and selected cards |

In dark mode shadows are reduced, and elevation is shown by a lighter surface (`surface` → `surface-2`).

### 2.5 Motion

| Token | Value | Usage |
|---|---|---|
| --motion-fast | 120 ms | Hover, press, chip toggle |
| --motion-base | 200 ms | Dropdowns, tabs, toasts |
| --motion-slow | 320 ms | Bottom sheets, dialogs, page transitions |
| --ease-standard | cubic-bezier(.2, 0, 0, 1) | Enter/move |
| --ease-exit | cubic-bezier(.3, 0, 1, 1) | Exit |

**Reduced motion:** under `@media (prefers-reduced-motion: reduce)` all durations are 0 ms except opacity fades (≤ 120 ms), and there are no parallax or auto-animating counters. Haptic feedback (`navigator.vibrate(10)`) is used only on swipe-action commit and payment saved, and never when reduced motion is set.

### 2.6 Breakpoints

| Token | Min width | Layout |
|---|---|---|
| sm | 360 px | Single column, bottom tab bar, FAB |
| md | 768 px | Two-column forms, list cards become a table, bottom bar remains |
| lg | 1024 px | Left sidebar replaces bottom bar; list/detail split view |
| xl | 1280 px | Split view with a wider detail pane; dashboards in 3 columns |
| 2xl | 1536 px | Max content width 1440 px, centred |

### 2.7 Z-index scale

`base 0` · `sticky 10` (table headers, action bar) · `nav 20` (sidebar, bottom bar) · `fab 30` · `dropdown 40` · `overlay 50` · `sheet/dialog 60` · `toast 70` · `command-palette 80`.

## 3. Components

All components:
- are built on shadcn/ui and Radix primitives where one exists
- take colour only from tokens
- show a visible `:focus-visible` ring (2 px `--color-focus`, 2 px offset)
- have touch targets of at least 44 × 44 px
- respect reduced motion

States marked "n/a" do not apply.

### CMP-001 — Button
- **Variants:** primary, secondary (surface + input border), ghost, destructive (danger), link.
- **Sizes:** sm (36 px high, desktop only), md (44 px), lg (52 px, mobile primary).
- **States:** default, hover, focus-visible, active, disabled, loading (spinner + label kept).
- **Props:** variant, size, icon (leading/trailing), loading, disabled, asChild, fullWidth.
- **A11y:**
  - native `<button>`
  - `aria-busy="true"` while loading
  - disabled buttons stay in the DOM with `aria-disabled` and a tooltip saying why (for example "Add a phone number first")
  - labels are verbs ("Send quote", "Record payment")

### CMP-002 — IconButton
- **Variants:** ghost, secondary, filled. **Sizes:** 44, 52 px.
- **States:** as CMP-001.
- **A11y:** `aria-label` is required. A tooltip on hover/focus (desktop) shows the same text.

### CMP-003 — TextField
- **Variants:** text, email, number, password (with show/hide), search.
- **States:** default, hover, focus, filled, disabled, read-only, error, success (valid GSTIN tick).
- **Props:** label, helperText, error, prefix/suffix, inputMode, autoComplete.
- **A11y:**
  - `<label for>` is always visible; no placeholder-only labels
  - `aria-invalid` and `aria-describedby` point to the helper and error text
  - errors are announced politely

### CMP-004 — Select / Combobox
- **Variants:** native select (mobile, short lists), searchable combobox (products, customers, users), multi-select with chips (tags).
- **States:** closed, open, loading options, empty ("No matches — Add new"), error, disabled.
- **A11y:** Radix Combobox with `role="combobox"`, `aria-expanded` and `aria-activedescendant`. Typeahead, Esc closes, Enter selects.

### CMP-005 — Checkbox / Radio / Switch
- **States:** unchecked, checked, indeterminate (checkbox), disabled, error, focus.
- **A11y:**
  - native inputs, with the label as the clickable target (44 px row)
  - a Switch uses `role="switch"` and states the setting it controls ("Write status back to sheet")

### CMP-006 — Textarea
- **Variants:** plain, auto-grow, with character count (note limit 5,000).
- **States:** as TextField.
- **A11y:** the count is announced via `aria-describedby` only when within 10 % of the limit.

### CMP-007 — DatePicker / DateTimePicker
- **Variants:** date, date-time, date range (reports, statement).
- **Presets:** Today, Tomorrow, In 2 days, Next week, This FY, Last month.
- **States:** default, open, disabled dates (future for payments, locked periods), error.
- **A11y:**
  - typing `DD-MM-YYYY` is allowed alongside the picker
  - the grid follows the WAI-ARIA date picker dialog pattern
  - the IST timezone is shown on date-time fields

### CMP-008 — FormField
- **Composition:** label (with a "Required" or "Optional" marker), control, helper text, error message.
- **States:** default, error, disabled.
- **A11y:**
  - on submit with errors, focus moves to the first invalid field
  - an error summary (CMP-018) at the top links to each error

### CMP-009 — DataTable
- **Variants:** basic, selectable (bulk actions), expandable rows, zebra (documents).
- **Features:**
  - sticky header
  - sort per column
  - right-aligned numeric columns
  - row click opens detail
  - column visibility
  - server pagination (CMP-037)
  - empty and loading rows
- **States:** loading (skeleton rows), empty, error (inline retry), partial (some rows failed in a bulk action, highlighted).
- **A11y:**
  - semantic `<table>`
  - `aria-sort` on sortable headers
  - selection checkboxes labelled "Select <name>"
  - bulk bar announced as "n selected"
- **Responsive:** below 768 px it turns into CMP-010 rows.

### CMP-010 — ListRow (swipeable)
- **Anatomy:** avatar/icon, title, subtitle (2 lines max), trailing meta (amount, chip, time), optional SLA chip.
- **Swipe:** right → Call (primary colour), left → WhatsApp (success colour). There is a 30 % threshold, a haptic on commit, and the row snaps back on cancel.
- **States:** default, pressed, selected, swiping, disabled (no phone → swipe disabled).
- **A11y:**
  - the swipe is never the only route
  - the same actions appear in the row's "More" menu and in long-press
  - `role="link"` on the row

### CMP-011 — KanbanBoard & KanbanCard
- **Board:** horizontal columns by stage, each with a count and ₹ value header. Columns scroll-snap on mobile.
- **Card:** name, company, value, source chip, SLA chip, owner avatar, next follow-up.
- **States:** default, dragging, drop-target, drop-blocked (Won column needs conversion), collapsed column.
- **A11y:**
  - keyboard move: Space picks up the card, arrow keys move it, Space drops it
  - an `aria-live` message such as "Moved to Interested"
  - a "Move to…" menu alternative on every card

### CMP-012 — Card
- **Variants:** default, interactive (whole card clickable), outlined, selected.
- **Slots:** header (title, action), body, footer.
- **A11y:** an interactive card is a single `<a>` or `<button>` with no nested interactive elements.

### CMP-013 — StatTile (KPI)
- **Anatomy:** label, value (display/h2, tabular), delta or sub-text, optional mini-trend, status accent bar.
- **States:** loading (skeleton), value, zero ("₹0 — nothing overdue" in success colour), error ("—" + retry).
- **A11y:** the tile is a link when drillable, with an accessible name such as "Outstanding ₹1,24,500, view invoices".

### CMP-014 — Tabs
- **Variants:** underline (desktop), scrollable pills (mobile Customer 360).
- **States:** default, active, focus, disabled, with count badge.
- **A11y:** Radix Tabs, arrow-key navigation, `aria-controls`. The selected tab is reflected in the URL.

### CMP-015 — Dialog / Modal
- **Variants:** standard, confirm (CMP-043), full-screen (mobile forms).
- **States:** open, submitting, error inside.
- **A11y:**
  - focus trap
  - Esc closes, except during submit
  - initial focus on the first field or the safe action
  - focus returns to the trigger
  - `aria-labelledby` points to the title

### CMP-016 — BottomSheet / Drawer
- **Variants:** bottom sheet (mobile, with drag handle: call outcome, filters, share), side drawer (desktop: record preview, filters).
- **Snap points:** 50 % and 90 %.
- **States:** open, expanded, dragging, closing.
- **A11y:**
  - behaves as a dialog (focus trap)
  - the drag handle is also a button labelled "Expand"
  - Esc and the scrim close it unless there are unsaved changes ("Discard outcome?")

### CMP-017 — Toast
- **Variants:** success, info, warning, error, with action ("Undo", "Retry", "View").
- **Timing:** auto-dismiss after 5 s, or 8 s with an action. Errors persist until dismissed.
- **A11y:**
  - `role="status"`, or `role="alert"` for errors
  - not the only carrier of critical info
  - timing pauses on hover and focus

### CMP-018 — Alert / Banner
- **Variants:** info, success, warning, danger.
- **Placements:** inline, page-top, global (Google connection lost, offline).
- **A11y:** an icon and a text title, and `role="alert"` only for new blocking errors.

### CMP-019 — Badge / StatusChip
- **Variants:** status families (§2.1), count badge, source chip (with icon: Sheet, Form, Manual, CSV, Webhook).
- **A11y:** the text label is always present. The colour dot is decorative (`aria-hidden`).

### CMP-020 — Avatar
- **Variants:** image, initials (deterministic background from tokens), group stack.
- **Sizes:** 24, 32, 40 px.
- **A11y:** `alt` holds the person's name, or the avatar is `aria-hidden` when the name is adjacent.

### CMP-021 — EmptyState
- **Anatomy:** simple line illustration (token-coloured), title, one-sentence explanation, primary CTA, optional secondary link.
- **Variants:** first-use (for example "No leads yet — connect your Google Sheet"), no-results ("No leads match these filters — Clear filters"), no-permission, offline.
- **A11y:** the illustration is `aria-hidden` and the title is a heading.

### CMP-022 — Skeleton
- **Variants:** text lines, avatar, tile, table row, card.
- **Behaviour:** shimmer is disabled under reduced motion. It shows after 300 ms, to avoid flashing.
- **A11y:** the container has `aria-busy="true"`, and a polite "Loading leads" message is announced once.

### CMP-023 — Sidebar (desktop ≥ 1024)
- **Items:**
  - Home
  - Leads
  - Customers
  - Sales (Quotes, Orders, Invoices, Payments)
  - Follow-ups
  - Reports
  - Settings
  - the user menu at the bottom
- **States:** expanded (240 px), collapsed (72 px icons with tooltips), active item, badge counts.
- **A11y:** `<nav aria-label="Main">` with `aria-current="page"`.

### CMP-024 — BottomTabBar + FAB (mobile < 1024)
- **Tabs:** Home · Leads · Customers · Sales · More.
- **FAB "+":** opens a quick-add sheet (Lead, Quote, Payment, Note, Follow-up).
- **States:** active tab, badge, hidden while the keyboard is open.
- **A11y:**
  - `<nav aria-label="Main">`, with labels always visible under the icons
  - the FAB has `aria-label="Quick add"` and sits 16 px above the bar
  - safe-area insets are respected

### CMP-025 — PageHeader / TopBar
- **Anatomy:** back button (mobile detail), title, subtitle/breadcrumb (desktop, CMP-044), primary action, overflow menu, search trigger, notifications bell, offline/sync indicator (CMP-040).
- **A11y:** one `<h1>` per page, with the back button labelled "Back to Leads".

### CMP-026 — CommandPalette (global search)
- **Trigger:** Ctrl/Cmd + K, `/`, or the search icon.
- **Behaviour:** results are grouped (Leads, Customers, Contacts, Documents) with recent searches and quick actions ("New lead"). Phone numbers are matched in any format.
- **States:** empty (recent), typing, loading, results, no results, offline (cached only).
- **A11y:**
  - combobox/listbox pattern; arrow keys move, Enter opens, Esc closes
  - an `aria-live` region announces the result count

### CMP-027 — ActionBar (Call · WhatsApp · Email · Directions)
- **Placement:**
  - sticky at the bottom of lead/customer/contact detail on mobile, above the tab bar
  - a button group in the header on desktop
  - an extra "New quote" on customers
- **States:** enabled, disabled with reason (no phone → "Add a phone number"), loading (email sending).
- **A11y:** labelled buttons (icon + text) with an accessible name such as "Call Ravi Kumar".

### CMP-028 — Timeline
- **Item types:** call (outcome chip), WhatsApp, email, note, stage change, assignment, file, quote/invoice/payment event, system.
- **Each item:** icon, title, body, user, relative time (absolute on hover/focus), and a "Will sync" badge for offline items.
- **Features:** filter chips by type, and "Load older".
- **A11y:** an `<ol>` list with an `<h3>` per day group. The time uses a `<time datetime>` element.

### CMP-029 — LineItemEditor
- **Row fields:** item combobox (CMP-004), description, qty, unit, rate, discount (% or ₹ toggle), tax rate, HSN/SAC; drag to reorder; delete.
- **Row types:** item, free-text, section heading.
- **Mobile:** each line is a card with a "Edit line" sheet.
- **States:** default, editing, invalid (qty ≤ 0; HSN missing on a GST install shows a warning), disabled (issued).
- **A11y:**
  - each input is labelled "Line 2 quantity", etc.
  - adding a line moves focus to its item field
  - removing a line offers "Undo"

### CMP-030 — TotalsBlock
- **Rows:** Sub-total, Discount, CGST/SGST or IGST by rate, Round-off, **Grand total** (h3, primary), amount in words.
- **States:** live recalculating (`aria-live="polite"`, debounced), tax-free (Bill of Supply note).
- **A11y:** a `<dl>` with tabular numbers.

### CMP-031 — UPIPaymentBlock
- **Anatomy:**
  - "Scan to pay" title
  - QR (≥ 160 px on screen, ≥ 30 mm in print, quiet zone 4 modules)
  - amount (h2) with the "Balance due" label
  - UPI ID (mono) with Copy
  - "Pay via UPI" button (mobile web view)
  - bank details
  - paid/balance lines
- **States:** payable, partly paid (shows "Paid ₹x · Balance ₹y"), PAID stamp (success), no UPI ID (bank details only), QR off.
- **A11y:**
  - the QR image `alt` reads "UPI QR code to pay ₹48,380.00 to acme@okhdfcbank"
  - the amount is also given as text
  - the Copy button announces "UPI ID copied"

### CMP-032 — FileUpload / AttachmentList
- **Variants:** dropzone (desktop), camera/gallery buttons (mobile), attachment chips with thumbnail.
- **States:** idle, dragging over, uploading (progress %), resumable-paused, success, error (size or type, with the reason), pending upload (offline/Drive failure).
- **A11y:**
  - the dropzone is also a button
  - progress uses `role="progressbar"` with a value
  - errors are associated with the file name

### CMP-033 — Stepper
- **Used in:** Sheet connection wizard, CSV import, install checklist.
- **States:** upcoming, current, complete, error.
- **A11y:** an `<ol>` with `aria-current="step"`, and step names announced.

### CMP-034 — FilterBar & SavedFilters
- **Anatomy:**
  - search field
  - quick chips (My leads, Due today, SLA breached, Hot)
  - "Filters" button opening a sheet/drawer with all filters
  - active filter chips with ×
  - a saved filter menu ("Save as…")
- **States:** none applied, applied (count badge), saving.
- **A11y:** chips are toggle buttons with `aria-pressed`, and the result count is announced.

### CMP-035 — MoneyText & AmountInput
- **MoneyText:** formats paise as ₹ with Indian grouping and tabular numbers. Negatives show "−₹" with a text marker, never colour alone.
- **AmountInput:** numeric keypad (`inputmode="decimal"`), ₹ prefix, grouping on blur, max 2 decimals, a "Fill balance" shortcut.
- **A11y:** the accessible value reads naturally ("48 thousand 380 rupees").

### CMP-036 — PhoneInput
- **Behaviour:** country code default +91 (changeable), formatting as you type (98450 12345), E.164 stored, "Check number" warning state.
- **A11y:** `inputmode="tel"`, `autocomplete="tel"`.

### CMP-037 — Pagination / InfiniteList
- **Variants:** desktop pagination (25/50/100 per page), mobile infinite scroll with a "Load more" button fallback.
- **A11y:** a "Showing 1–25 of 2,000" live text, and the Load more button keeps focus.

### CMP-038 — ChartWrapper
- **Charts in MVP:** horizontal bar (pipeline by stage), stacked bar (ageing), column (sales by month).
- **Rules:** values labelled on bars, a data-table toggle, and palette per §6.
- **A11y:** every chart has a title, a one-sentence summary and an accessible table alternative.

### CMP-039 — SLAChip
- **States:**
  - running (info, "12 min left")
  - due soon (warning, ≤ 5 min)
  - breached (danger, "Breached 25 min")
  - met (success, "Contacted in 6 min")
  - paused (outside business hours, "Starts 9:00")
- **A11y:** the text is always present and updates every minute without being announced (`aria-live="off"`).

### CMP-040 — OfflineIndicator / SyncBadge
- **States:** online (hidden), offline (persistent banner "You're offline — notes and call outcomes will sync"), syncing (spinner + "Syncing 3"), sync failed ("2 items failed — Retry").
- **A11y:** the change to offline is announced once via `role="status"`.

### CMP-041 — NotificationItem & NotificationCentre
- **Anatomy:** icon by event, title, body, time, unread dot, link to the record.
- **Features:** mark all read, preferences link.
- **A11y:** a list, with unread state given as text ("Unread") for screen readers.

### CMP-042 — DocumentPreview
- **Purpose:** an A4 preview of a quote/invoice/receipt/statement (HTML render matching the PDF) with zoom, download, print and share.
- **States:** rendering (skeleton page), ready, PDF pending (banner + "Regenerate PDF"), error.
- **A11y:** the HTML preview is real text (not an image), so screen readers can read it.

### CMP-043 — ConfirmDialog
- **Used for:** destructive or irreversible actions (deactivate user, reverse payment, issue invoice, erase person, revoke link).
- **Anatomy:** a title that names the consequence, an explanation, a required reason field where business rules need one, a cancel button (default focus), and a confirm button named after the action ("Reverse payment").
- **Extra safeguard:** "Erase person" asks the admin to type the phone number to confirm.
- **A11y:** `role="alertdialog"`.

### CMP-044 — Breadcrumb
- **Desktop only:** for example Sales › Invoices › INV/25-26/0142.
- **A11y:** `<nav aria-label="Breadcrumb">`, with `aria-current` on the last item.

## 4. Patterns

| Pattern | Rule |
|---|---|
| **Forms** | Single column on mobile, two columns ≥ 768 for short fields. Labels above fields. Inline validation on blur and full validation on submit. The primary button sits sticky at the bottom on mobile and is named after the action. Unsaved changes prompt "Discard changes?" on leave. |
| **Tables** | Numbers right-aligned and tabular. Status as chips. Row click opens detail (split view on desktop). Bulk actions appear in a sticky bar when rows are selected. Up to 500 rows per bulk action (FR-032). |
| **Filters** | Quick chips plus a full filter sheet. Filters live in the URL. Saved filters per user. "Clear all". |
| **Page headers** | Title + key status chip + primary action. Secondary actions go in an overflow menu. Destructive actions are never the primary button. |
| **Detail pages** | Summary header → action bar → tabs/sections → timeline. Edits happen in a sheet or inline. Read-only after Issue, with a lock icon and the reason. |
| **Empty states** | First-use empties teach and offer the next step. Filter empties offer "Clear filters". |
| **Errors** | Say what happened and how to fix it ("Only 6 left to invoice"). Network errors offer Retry. Permission errors explain who can do it ("Ask your admin to enable payment recording"). |
| **Error pages** | 404 "We can't find that page" with Home. 403 "You don't have access to this" with Home. 500 "Something went wrong on our side — we've been notified" with Retry. Expired/revoked share links have their own branded page. |
| **Confirmations** | Use CMP-043 for irreversible actions. Reversible actions (stage change, delete draft line) use Undo in a toast instead. |
| **Loading** | Skeletons after 300 ms. Buttons show their own spinner. Optimistic UI only for notes and call outcomes. |
| **Notifications** | Push plus the in-app centre. Toasts confirm the user's own actions only. |
| **Money & dates** | ₹ with Indian grouping. DD-MM-YYYY on screen (and "Today 11:00", "2 h ago" for recent times). Absolute date on hover/focus. |

## 5. Iconography & illustration

- **Icons:** Lucide (outline, 1.75 px stroke, 20/24 px), inheriting `currentColor`. Each icon pairs with a text label in navigation and actions.
- **Key icons:** phone (Call), message-circle (WhatsApp; the brand glyph is avoided in the UI chrome, with a generic chat icon plus "WhatsApp" text), mail, map-pin, file-text (quote), receipt (invoice), indian-rupee (payment), qr-code, sheet (Google Sheet source), bell, search, plus, wifi-off.
- **Illustrations:** simple two-tone line drawings using `--color-primary` and `--color-border`, used only in empty states and onboarding. No stock photos.

## 6. Data visualisation palette

Categorical (stages, sources): `#2563EB`, `#0EA5E9`, `#14B8A6`, `#84CC16`, `#F59E0B`, `#EF4444`, `#8B5CF6`, `#64748B`. Dark mode uses the 400 shades of the same hues.

Ageing (sequential, low → high risk): Not yet due `#94A3B8` · 1–30 `#FBBF24` · 31–60 `#F59E0B` · 61–90 `#EA580C` · 90+ `#B91C1C`.

Rules:
- direct labels on bars, so colour is never the only key
- gridlines in `--color-border`
- an accessible data-table toggle on every chart (CMP-038)
