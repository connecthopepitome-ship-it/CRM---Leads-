# ADR-011: Dashboards via Firestore aggregation queries; reports from daily summary documents plus live deltas

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** FR-084, FR-085, FR-075; NFR-001, NFR-011, NFR-012

## Context
Dashboards and reports (pipeline, sales, ageing, GST, sources, SLA) must be fast and cheap on Firestore without a warehouse.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Live queries over raw collections | Always current | Expensive reads at 50k records; slow |
| Aggregation queries (count/sum) + daily summary docs + same-day deltas | Cheap, fast, within Firestore | Summaries must be recomputable; job maintenance |
| BigQuery export | Powerful analytics | Extra cost and complexity — deferred to v2 |

## Decision
Dashboard tiles use Firestore `count()`/`sum()` aggregation queries with scope filters. Reports read `reportSummaries/{yyyy-mm-dd}` documents (written by `tick-daily`, recomputable for any date) combined with live same-day queries. Customer running totals live on customer documents (ADR-004). Excel exports are generated server-side with exceljs and streamed.

## Consequences
**Positive:** predictable cost and latency. **Negative:** summaries are eventually consistent (≤ 1 day + live delta). **Follow-up:** summary schema in LLD-reporting.
