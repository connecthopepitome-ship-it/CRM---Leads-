# ADR-005: Built-in username/password authentication with Argon2id, short-lived JWT and rotating refresh tokens

- **Status:** Accepted (Gate G6, 2026-11-13)
- **Date:** 2026-11-13
- **Deciders:** Product owner (accountable); Claude — solution architect
- **Linked requirements:** NFR-007, NFR-008, NFR-009; FR-007 – FR-013, FR-089; R-004

## Context
The product owner's design requires login by username (not email/Google) managed by the client admin, without Firebase Auth. Owning authentication is a security risk (R-004) that must be contained.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Firebase Auth / Identity Platform | Managed, MFA, proven | Email/phone-centric UX; usernames need workarounds; design explicitly excludes it; Identity Platform MFA billing |
| Built-in auth with vetted libraries | Exactly the UX required (username, admin-managed, forced change, lockout); data stays in Firestore | We own correctness → needs ASVS L2 discipline and review |
| External IdP (Keycloak/Entra) | Enterprise SSO | Heavy per client; overkill for SMBs |

## Decision
We will build authentication in `identity` module using: **argon2** (Argon2id, m=19 MiB, t=2, p=1 minimum) for passwords; **jose** for JWT (EdDSA Ed25519 keys per install in Secret Manager, `kid` rotation); access token 15 min held **in memory** in the SPA; refresh token = 256-bit random, stored **hashed** in `sessions`, sent as `__Secure-rt` cookie (`HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`; `__Host-` is not used because it requires `Path=/`), **rotated on every use with family-based reuse detection, a 30 s grace window for the immediately previous token, and single-flight refresh across tabs (Web Locks + BroadcastChannel)**; sessions expire after 30 days idle or 90 days absolute; **otplib** TOTP 2FA (secret encrypted); lockout 5/15 min and per-IP rate limit at the edge; generic errors with timing equalisation for unknown users; all auth events audited. Auth sits behind an `AuthService` port so an external IdP can be added later. Additionally, on every request the API checks a per-user `tokenEpoch` (cached 60 s) so forced logout/deactivation takes effect within 60 s rather than 15 min (FRD review F-30, CR-003); the epoch is also bumped on role or team change. The 2FA step uses a single-use 5-minute `mfa_pending` token, and TOTP time-steps cannot be reused. An API-side per-IP and per-username backstop complements the edge rate limit.

## Consequences
**Positive:** required UX; data stays in the client project. **Negative:** security burden — mitigated by ASVS L2 checklist, ZAP scan, manual review before go-live, dependency scanning. **Follow-up:** LLD-identity with threat model; TC set for auth negatives.
