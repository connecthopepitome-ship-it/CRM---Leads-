# Architecture Decision Records

| ADR | Title | Status |
|---|---|---|
| [ADR-001](ADR-001-architecture-style.md) | Per-client isolated serverless install with a modular-monolith API and hexagonal domain core | Accepted |
| [ADR-002](ADR-002-frontend-framework.md) | React + TypeScript + Vite PWA (not Next.js) for the web and mobile app | Accepted |
| [ADR-003](ADR-003-backend-framework.md) | Cloud Functions for Firebase (2nd gen, Node.js 22) with Express 5 router and Zod-first OpenAPI | Accepted |
| [ADR-004](ADR-004-database.md) | Cloud Firestore (Native mode, asia-south1) accessed only through the API | Accepted |
| [ADR-005](ADR-005-authentication.md) | Built-in username/password authentication with Argon2id, short-lived JWT and rotating refresh tokens | Accepted |
| [ADR-006](ADR-006-hosting-and-deployment.md) | Cloudflare Pages + Pages Function proxy in front of per-client Firebase; GitHub Actions fan-out deploys | Accepted |
| [ADR-007](ADR-007-async-jobs-and-caching.md) | Cloud Scheduler + Pub/Sub ticks, Cloud Tasks for retries, no external cache | Accepted |
| [ADR-008](ADR-008-file-storage-google-drive.md) | Google Drive (client account) with the drive.file scope and Google Picker | Accepted |
| [ADR-009](ADR-009-pdf-rendering.md) | Render documents from shared HTML templates with headless Chromium in a dedicated function | Accepted |
| [ADR-010](ADR-010-search.md) | Search via normalised token arrays in Firestore | Accepted |
| [ADR-011](ADR-011-reporting.md) | Dashboards via Firestore aggregation queries; reports from daily summary documents plus live deltas | Accepted |
| [ADR-012](ADR-012-push-notifications.md) | Web push via Firebase Cloud Messaging without Firebase Auth | Accepted |
| [ADR-013](ADR-013-offline-strategy.md) | Workbox app-shell caching and an IndexedDB outbox for notes, call outcomes and follow-ups | Accepted |
| [ADR-014](ADR-014-monorepo-and-tooling.md) | pnpm workspaces + Turborepo monorepo, TypeScript strict, Vitest, Playwright, Firebase Emulator Suite | Accepted |
