# ADR-007: Cloud Scheduler + Pub/Sub ticks, Cloud Tasks for retries, no external cache

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** NFR-002, NFR-004, NFR-012, NFR-021; FR-039, FR-043, FR-047, FR-049, FR-050, FR-055, FR-090

## Context
We need: polling every 1–4 min and a 15-min safety poll for Sheets; follow-up reminders and SLA checks every minute; daily purge, summaries and link expiry; retries with backoff for PDF rendering, Gmail sends and sheet write-back. Redis would add cost per client.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Cloud Scheduler jobs per task | Simple | Many jobs per client (3 free per billing account, then billed) |
| Two scheduler ticks (1-min, daily) → Pub/Sub → job dispatcher; Cloud Tasks queues for retryable work | Few scheduler jobs; per-task retry/backoff and rate limits; idempotent handlers | Dispatcher logic to maintain |
| Memorystore Redis + BullMQ | Rich queue features | Always-on cost per client |

## Decision
We will create **two Cloud Scheduler jobs** per install (`tick-1m`, `tick-daily`) publishing to Pub/Sub; a `jobs` function (guarded by a Firestore lease per tick so duplicate deliveries are no-ops) dispatches due work (sheet polls by interval, reminders, SLA, purge, summaries, link expiry). Retryable side effects go to **Cloud Tasks** queues (`pdf-render`, `email-send`, `sheet-writeback`, `push-send`, `bulk`, `export`), executed by the private `worker` and `pdf` functions via OIDC, with exponential backoff (max 3–5 attempts) and dead-letter logging. **No external cache**: per-instance in-memory LRU for config/masters/permissions (TTL 60 s) only. All handlers are idempotent (keys: row marker, idempotency keys, document IDs).

## Consequences
**Positive:** near-zero cost; reliable retries. **Negative:** 1-minute granularity (meets NFR-004 and SLA reminders). **Follow-up:** job catalogue in LLD-platform.
