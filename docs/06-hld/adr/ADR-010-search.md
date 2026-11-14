# ADR-010: Search via normalised token arrays in Firestore

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** FR-083, FR-029; NFR-001, NFR-011; FRD review F-22

## Context
Global search must match names, phone numbers in any format, GSTIN and document numbers (e.g. "0142") across ≤ 50k leads per install. Firestore has no substring or full-text search.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Token array per record + `array-contains` | No extra service; cheap; meets the specified match semantics | Prefix/fragment matching only; index writes add cost |
| Algolia / Typesense / Meilisearch | Real full-text, typo tolerance | Extra vendor/cost per client; PII leaves the project |
| Client-side search of cached data | Offline-friendly | Incomplete; scope leaks |

## Decision
We will store a `searchTokens` array (≤ 60 tokens) on searchable records — lower-cased name word prefixes (≥ 2 chars), last 4–10 phone digits, full GSTIN, document number and its numeric fragments, email local-part — maintained by the domain on write. Queries use `array-contains` on the normalised first term, filtered by scope, then refined in memory (≤ 50 results per type). **Match semantics:** word-prefix for names, suffix digits for phones, exact or numeric fragment for documents/GSTIN.

## Consequences
**Positive:** meets FR-083 ACs at zero extra cost. **Negative:** no fuzzy/typo search (acceptable for MVP; revisit in v2). **Follow-up:** tokeniser in packages/domain with unit tests.
