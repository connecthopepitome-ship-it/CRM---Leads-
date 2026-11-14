# ADR-009: Render documents from shared HTML templates with headless Chromium in a dedicated function

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** NFR-003, NFR-017; FR-055, FR-067, FR-068, FR-072, FR-076; R-011, R-017

## Context
Quotes, invoices, receipts and statements must be pixel-consistent with the web preview (CMP-042), embed a UPI QR and render Indic scripts correctly (Devanagari, Tamil, Bengali…), which needs complex text shaping.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| pdfmake / pdfkit / react-pdf | Light, fast | No complex-script shaping → broken Indic text; separate layout from web preview |
| Headless Chromium (Puppeteer + slim Chromium) in a dedicated 2 GiB function | Full HTML/CSS + HarfBuzz shaping; one template set for preview and PDF | Larger bundle, cold start ~3–6 s → run asynchronously |
| Third-party PDF API | No ops | Sends invoices/PII outside the client project; cost |

## Decision
We will maintain document templates as HTML/CSS (rendered by a shared template module used by both the web preview and the server) and render PDFs in a separate **`pdf` function** (Node 22, 2 GiB, concurrency 1, maxInstances 3) using **puppeteer-core + @sparticuz/chromium**, with embedded **Inter + Noto Sans (Devanagari, Tamil, Telugu, Bengali, Kannada)** fonts. The page runs with JavaScript disabled and all network requests aborted (assets inlined as data URIs); Admin-edited text is rendered as escaped plain text. Rendering is triggered via the `pdf-render` Cloud Tasks queue after the issuing transaction commits (E-09); the payment block is regenerated as a new file version when the balance changes (FR-065).

## Consequences
**Positive:** correct Indic rendering; identical preview and PDF. **Negative:** heavier function — isolated so the API stays fast. **Follow-up:** TCs with Indic names; p95 measured **including cold starts**. Cold renders are expected at 6–10 s, so CR-002 proposes NFR-003 warm ≤ 5 s / cold ≤ 12 s (generation is asynchronous, so the user is never blocked).
