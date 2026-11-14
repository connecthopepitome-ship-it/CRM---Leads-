# ADR-003: Cloud Functions for Firebase (2nd gen, Node.js 22) with Express 5 router and Zod-first OpenAPI

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** NFR-002, NFR-005, NFR-007, NFR-012; all API-backed FRs; CON-001

## Context
The design fixes Cloud Functions as the API runtime. We need request validation, RFC 7807 errors, OpenAPI documentation, middleware for authn/authz/audit, and minimal cold-start overhead. CLAUDE.md defaults to NestJS.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| NestJS on Cloud Functions | Structure, DI, decorators, OpenAPI | Heavy bootstrap → worse cold starts (NFR-002); reflection metadata; more than needed for a modular monolith |
| Express 5 + Zod + @asteasolutions/zod-to-openapi | Native fit for functions (req, res); tiny cold start; schemas shared with the web app; OpenAPI generated from Zod | Structure must come from our own conventions |
| Hono | Very fast, edge-friendly | Less familiar adapters for Firebase functions; Express is the documented path |

## Decision
We will implement the API as **one 2nd-gen HTTP function `api`** (Node.js 22, region `asia-south1`, 512 MiB, concurrency 40, maxInstances 10) using **Express 5**, **Zod** schemas from `packages/contracts` (shared with the web app) and **zod-to-openapi** to publish `/api/v1/openapi.json`. Middleware order: request ID → edge-key check → rate-limit context → authn (JWT) → authz (RBAC + scope) → validation → handler → audit → RFC 7807 error mapper. Logging with **pino** (JSON) to Cloud Logging.

## Consequences
**Positive:** small bundle, fast cold start; contracts shared front/back; consistent error model. **Negative:** overrides CLAUDE.md NestJS default (recorded here). **Follow-up:** route/module conventions documented in LLDs (Phase 7).
