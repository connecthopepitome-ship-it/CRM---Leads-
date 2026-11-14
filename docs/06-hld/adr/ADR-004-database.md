# ADR-004: Cloud Firestore (Native mode, asia-south1) accessed only through the API

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** NFR-010, NFR-011, NFR-012, NFR-020, NFR-022; FR-005, FR-071, FR-075; CON-001

## Context
Each install needs a managed, near-zero-cost database in India with transactions for numbering and payment allocation. The design specifies Firestore. Firestore lacks joins, full-text search and ad-hoc aggregations; Firebase Auth is not used, so security rules cannot identify users.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Firestore (Native mode) | Serverless, free tier, transactions, Mumbai region, managed backups | No joins/full-text; per-operation pricing; rules cannot use our JWT |
| Cloud SQL PostgreSQL per client | SQL, joins, search | ≈ ₹800+/month minimum per client; ops |
| Supabase / Neon Postgres | SQL, generous tiers | Data outside client Google project; extra vendor; region constraints |

## Decision
We will use **Firestore Native mode in `asia-south1`**, one database per install, with **security rules denying all client access** (`allow read, write: if false;`); only the API's service account (Admin SDK) accesses data. Conventions: money as integer paise; `version` field for optimistic concurrency (If-Match/ETag); document numbers from `counters/{series}` in transactions; customer running totals maintained in the same transaction as the payment/invoice change (not only by triggers) to keep Customer 360 consistent; composite indexes in `infra/firestore.indexes.json`; search and reporting per ADR-010 and ADR-011.

## Consequences
**Positive:** cost ≈ 0 at pilot scale; transactions cover NFR-020. **Negative:** query design must be planned per screen (LLD); vendor lock-in mitigated by repository interfaces (ADR-001). **Follow-up:** index list and query catalogue per module in LLD; load test at NFR-011 volumes in Phase 9.
