# ADR-006: Cloudflare Pages + Pages Function proxy in front of per-client Firebase; GitHub Actions fan-out deploys

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** NFR-001, NFR-005, NFR-008, NFR-009, NFR-019; FR-001, FR-006; CON-001, CON-003

## Context
The app must be served on the client's domain with the API on the same origin (SameSite=Strict cookies, no CORS), cheap per client, with edge rate limiting, and deployable to many clients from one repository.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Firebase Hosting with rewrites to functions | One vendor | Design specifies Cloudflare; weaker edge rate limiting/WAF on free tier |
| Cloudflare Pages + Pages Function proxy `/api/*` → Cloud Functions URL | Free static hosting + CDN; same-origin API; Cloudflare rate limiting & WAF; custom domains easy | Extra hop (~10–30 ms); proxy must forward client IP and add an edge key |
| Cloudflare Workers calling Firestore directly | Edge compute | Admin SDK not supported in Workers; splits backend |

## Decision
We will host `apps/web` on **Cloudflare Pages** (one project per client, custom domain) with a **Pages Function** that proxies `/api/*` to the client's `api` function URL, signing each request with a timestamped HMAC (`X-Edge-Signature` over ts + method + path + body hash; two active key IDs for rotation; ±60 s window) and forwarding `CF-Connecting-IP`, which the API trusts only after the signature verifies. `worker` and `pdf` functions are private (OIDC-only invokers); `/api/internal/*` is blocked at the edge. Login and public endpoints are rate-limited at the edge. **GitHub Actions** builds once per release and deploys per client through GitHub Environments holding that client's deploy-only credentials (Firebase deploy identity via Workload Identity Federation, with deploy roles and `secretVersionAdder` only, no data or secret-read roles; scoped Cloudflare API token). Order: staging → smoke → manual approval → selected clients → migrations → health check → automatic code rollback on failure.

## Consequences
**Positive:** ₹0 hosting; same-origin security model; one pipeline for all clients. **Negative:** two vendors per client (Cloudflare + Google) — accounts created during install (A-029). **Follow-up:** `infra/` scripts and runbook (Phase 9, 13).
