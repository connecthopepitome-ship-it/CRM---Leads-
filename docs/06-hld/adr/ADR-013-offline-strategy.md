# ADR-013: Workbox app-shell caching and an IndexedDB outbox for notes, call outcomes and follow-ups

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** FR-081, FR-048; NFR-021; RULE-051

## Context
Field users lose connectivity. Only notes, call outcomes and follow-ups may be created offline; recent records must be viewable offline.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Full offline-first DB sync (e.g. Firestore offline persistence, RxDB) | Rich offline | Browser cannot access Firestore (rules deny all); conflict complexity |
| Workbox caching + TanStack Query persisted cache + IndexedDB outbox with idempotency keys | Simple, bounded, matches RULE-051 | Limited offline scope by design |

## Decision
The PWA precaches the app shell (Workbox), persists TanStack Query cache for the last 200 viewed records (encrypted at rest is not available in browsers → cache excludes finance documents and is cleared on sign-out), and writes offline actions to an IndexedDB **outbox** with client-generated idempotency keys and device timestamps; the **page** replays in order on `online`/focus events (the service worker never holds auth tokens; Background Sync is only used to wake an open client). iOS Safari may evict data of non-installed sites after 7 days, so the 7-day guarantee applies to the installed PWA.

## Consequences
**Positive:** reliable capture without data conflicts. **Negative:** no offline invoicing/payments (intended). **Follow-up:** sign-out clears caches; TC for 7-day retention (NFR-021).
