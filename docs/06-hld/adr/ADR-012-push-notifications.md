# ADR-012: Web push via Firebase Cloud Messaging without Firebase Auth

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** FR-082; NFR-005; R-007

## Context
Users need push for new leads, follow-ups, SLA breaches and quote events on Android and iOS (installed PWA, iOS 16.4+).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| FCM (HTTP v1) with web push | Free; included in the Firebase project; handles VAPID | Token management in our DB |
| Raw Web Push (VAPID) via web-push library | No Google dependency | More code; same browser limits |
| OneSignal etc. | Dashboards | Third party gets user data |

## Decision
We will use **FCM** with the Firebase JS SDK messaging module in the PWA (no Firebase Auth needed), storing device tokens per user in `users/{id}/devices`; the API sends via FCM HTTP v1 through the `push-send` Cloud Tasks queue. Payloads carry no sensitive data (name + deep link only). In-app notifications are always written to `notifications` regardless of push permission.

## Consequences
**Positive:** free, reliable. **Negative:** iOS requires home-screen install (onboarding prompt). **Follow-up:** permission UX per SCR-025/SCR-033.
