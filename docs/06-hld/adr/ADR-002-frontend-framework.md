# ADR-002: React + TypeScript + Vite PWA (not Next.js) for the web and mobile app

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** NFR-001, NFR-013, NFR-016, NFR-021; FR-080 – FR-083; CON-001

## Context
CLAUDE.md §3 defaults to Next.js (App Router). The product owner's design specifies a React + Vite PWA on Cloudflare Pages. The app is fully authenticated (no SEO needs) except small public share pages; it must work offline, install to the home screen and be cheap to host per client.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Next.js App Router | SSR/RSC, file routing, ecosystem | Needs a Node/edge runtime per client for SSR; heavier PWA/offline story; SSR gives little value behind login |
| React + Vite SPA/PWA (React Router, TanStack Query, Workbox via vite-plugin-pwa) | Static hosting on Cloudflare Pages (free); excellent PWA/offline control; fast builds; matches CON-001 | No SSR — public share pages render client-side (acceptable; they are noindex) |
| Flutter / React Native | Native feel | Separate web build; app-store friction for MVP; not needed until Phase 4 (Capacitor wrapper then) |

## Decision
We will build `apps/web` as a **React 18 + TypeScript (strict) + Vite** single-page PWA using React Router, TanStack Query (server state), React Hook Form + Zod (forms), Tailwind CSS + shadcn/ui on Radix (design-system tokens as CSS variables), `vite-plugin-pwa` (Workbox) and `idb` (IndexedDB) for offline. Builds are parameterised by `CLIENT_ID` to inject branding and the PWA manifest.

## Consequences
**Positive:** zero hosting cost; strong offline/installability; one codebase for desktop and mobile. **Negative:** deviates from the CLAUDE.md default stack (this ADR records the override); no SSR. **Follow-up:** update CLAUDE.md §3/§8 commands at scaffold; Capacitor wrapper evaluated in v3.
