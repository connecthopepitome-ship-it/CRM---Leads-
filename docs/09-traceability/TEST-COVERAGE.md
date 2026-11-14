# Test Coverage by Requirement — SaleSphere CRM

| Version | Date | Author | Change |
|---|---|---|---|
| generated | 2026-11-14 | infra/rtm-coverage.mjs | Regenerate with `node infra/rtm-coverage.mjs` |

## 1. Summary

| Measure | Value |
|---|---|
| FRs | 91 (Must 86) |
| Must FRs with at least one automated test | **86 / 86** |
| Test cases automated | 182 / 262 (69 %) |
| Remaining test cases | 80: executed manually in UAT (docs/08-test/TEST-STRATEGY.md) |
| Must FRs without an automated test | none |

## 2. Per requirement

| FR | Title | Priority | TCs automated | Automated in |
|---|---|---|---|---|
| FR-001 | Client configuration defines an install | Must | 3 / 3 | test/config.spec.ts |
| FR-002 | Provision and seed a new install | Must | 2 / 3 | test/release.spec.ts |
| FR-003 | Branding and terminology in Settings | Must | 3 / 3 | test/release.spec.ts |
| FR-004 | Solo / Team mode and module switches | Must | 3 / 4 | test/release.spec.ts, test/sales.spec.ts |
| FR-005 | Configurable document number series | Must | 2 / 6 | test/domain.spec.ts, test/platform.spec.ts |
| FR-006 | Upgrade installs from a release | Must | 3 / 3 | test/release.spec.ts |
| FR-007 | Username and password login | Must | 1 / 5 | test/identity.spec.ts |
| FR-008 | Lockout and rate limiting | Must | 2 / 5 | test/identity.spec.ts |
| FR-009 | Password policy and forced change | Must | 1 / 3 | test/identity.spec.ts, e2e/journey.spec.ts |
| FR-010 | Session management | Must | 2 / 4 | test/identity.spec.ts |
| FR-011 | User administration | Must | 1 / 3 | test/identity.spec.ts |
| FR-012 | User self-service and optional 2FA | Should | 0 / 4 | test/identity.spec.ts |
| FR-013 | Role and record-scope enforcement | Must | 0 / 4 | e2e/journey.spec.ts |
| FR-014 | Role configuration | Must | 3 / 3 | test/release.spec.ts |
| FR-015 | Audit log capture | Must | 1 / 3 | test/domain.spec.ts, test/platform.spec.ts |
| FR-016 | Audit log viewer | Must | 2 / 2 | test/domain.spec.ts, test/platform.spec.ts |
| FR-017 | Company profile and GST registration | Must | 2 / 2 | test/release.spec.ts |
| FR-018 | Bank accounts and UPI IDs | Must | 3 / 3 | test/release.spec.ts |
| FR-019 | Product and service catalogue | Must | 3 / 3 | test/release.spec.ts |
| FR-020 | Finance masters | Must | 2 / 2 | test/release.spec.ts |
| FR-021 | Document and message templates | Must | 2 / 2 | test/release.spec.ts |
| FR-022 | Sales masters | Must | 0 / 2 | test/platform.spec.ts |
| FR-023 | Excel/CSV import of masters and opening data | Must | 3 / 3 | test/release.spec.ts |
| FR-024 | Deactivate referenced masters | Must | 1 / 1 | test/release.spec.ts |
| FR-025 | Create a lead manually | Must | 1 / 3 | test/domain.spec.ts, test/leads.spec.ts, e2e/journey.spec.ts |
| FR-026 | Import leads from CSV | Must | 2 / 2 | test/release.spec.ts |
| FR-027 | Capture leads from a web form or webhook | Must | 4 / 5 | test/leads.spec.ts, functions/proxy.spec.ts |
| FR-028 | Normalise contact details | Must | 2 / 2 | test/domain.spec.ts, test/leads.spec.ts |
| FR-029 | Automatic duplicate detection and merge | Must | 3 / 3 | test/domain.spec.ts, test/leads.spec.ts |
| FR-030 | Manual merge of duplicate leads | Should | 0 / 1 | — |
| FR-031 | Automatic lead assignment | Must | 4 / 4 | test/domain.spec.ts |
| FR-032 | Reassign and bulk actions | Must | 2 / 2 | test/leads.spec.ts |
| FR-033 | Lead stages and outcomes | Must | 3 / 3 | test/domain.spec.ts, test/leads.spec.ts |
| FR-034 | Lead list and Kanban views | Must | 3 / 3 | test/release.spec.ts |
| FR-035 | Activity timeline | Must | 0 / 1 | test/leads.spec.ts |
| FR-036 | Convert a lead to a customer | Must | 2 / 3 | test/leads.spec.ts |
| FR-037 | Connect the client's Google account | Must | 0 / 3 | test/google.spec.ts |
| FR-038 | Select sheet and map columns | Must | 2 / 2 | test/google.spec.ts |
| FR-039 | Sync triggers | Must | 3 / 3 | test/release.spec.ts |
| FR-040 | Exactly-once import | Must | 3 / 5 | test/google.spec.ts |
| FR-041 | Write-back to the sheet | Should | 2 / 2 | test/google.spec.ts |
| FR-042 | Sync log and import error queue | Must | 0 / 2 | test/google.spec.ts |
| FR-043 | Google connection health alert | Must | 1 / 2 | test/google.spec.ts |
| FR-044 | Call with outcome capture | Must | 2 / 4 | test/engagement.spec.ts |
| FR-045 | Call outcome automation | Should | 2 / 2 | test/domain.spec.ts, test/engagement.spec.ts |
| FR-046 | WhatsApp click-to-chat with templates | Must | 2 / 3 | test/domain.spec.ts, test/engagement.spec.ts |
| FR-047 | Email via the client's Gmail | Must | 3 / 4 | test/engagement.spec.ts |
| FR-048 | Directions and notes | Must | 0 / 2 | e2e/journey.spec.ts |
| FR-049 | Follow-up scheduling and reminders | Must | 3 / 4 | test/engagement.spec.ts |
| FR-050 | First-contact SLA tracking | Must | 2 / 3 | test/domain.spec.ts, test/engagement.spec.ts |
| FR-051 | Create a quotation | Must | 1 / 3 | test/sales.spec.ts, e2e/journey.spec.ts |
| FR-052 | Line and tax calculation | Must | 4 / 4 | test/domain.spec.ts, test/sales.spec.ts, e2e/journey.spec.ts |
| FR-053 | Discount approval | Must | 4 / 5 | test/domain.spec.ts, test/release.spec.ts, test/sales.spec.ts |
| FR-054 | Quotation revisions | Must | 2 / 3 | test/sales.spec.ts |
| FR-055 | Quotation PDF | Must | 1 / 2 | test/templates.spec.ts |
| FR-056 | Share and send a quotation | Must | 2 / 2 | test/sales.spec.ts |
| FR-057 | Customer response page | Must | 3 / 4 | test/domain.spec.ts, test/sales.spec.ts, e2e/journey.spec.ts |
| FR-058 | View tracking and expiry | Must | 3 / 3 | test/sales.spec.ts |
| FR-059 | Create a sales order | Must | 1 / 4 | test/sales.spec.ts, e2e/journey.spec.ts |
| FR-060 | Order status lifecycle | Must | 1 / 2 | test/sales.spec.ts |
| FR-061 | Invoiced vs pending tracking | Must | 2 / 2 | test/domain.spec.ts |
| FR-062 | Create an invoice from an order | Must | 2 / 2 | test/domain.spec.ts, test/sales.spec.ts |
| FR-063 | Invoice types | Must | 2 / 2 | test/release.spec.ts |
| FR-064 | GST determination | Must | 2 / 2 | test/domain.spec.ts, test/sales.spec.ts |
| FR-065 | Draft and issue | Must | 2 / 3 | test/sales.spec.ts, e2e/journey.spec.ts |
| FR-066 | Credit notes and invoice cancellation | Must | 2 / 2 | test/domain.spec.ts, test/payments.spec.ts, test/sales.spec.ts |
| FR-067 | Branded invoice PDF | Must | 2 / 2 | test/templates.spec.ts |
| FR-068 | UPI QR and pay link for the balance due | Must | 6 / 8 | test/domain.spec.ts, e2e/journey.spec.ts, test/sales.spec.ts, test/payments.spec.ts |
| FR-069 | Share an invoice | Must | 1 / 1 | test/sales.spec.ts, test/payments.spec.ts |
| FR-070 | Record a payment | Must | 3 / 4 | test/domain.spec.ts, test/payments.spec.ts |
| FR-071 | Allocate payments and manage advances | Must | 4 / 4 | test/domain.spec.ts, test/payments.spec.ts |
| FR-072 | Payment receipt | Must | 1 / 1 | test/release.spec.ts |
| FR-073 | Reverse a payment | Must | 2 / 2 | test/payments.spec.ts |
| FR-074 | Customers, contacts and addresses | Must | 2 / 2 | test/domain.spec.ts, test/payments.spec.ts |
| FR-075 | Customer 360 view | Must | 2 / 3 | test/domain.spec.ts, test/payments.spec.ts |
| FR-076 | Statement of account | Must | 2 / 3 | test/domain.spec.ts, test/payments.spec.ts |
| FR-077 | Drive folder structure | Must | 2 / 2 | test/release.spec.ts |
| FR-078 | Upload and view files | Must | 4 / 4 | test/release.spec.ts |
| FR-079 | Customer share links | Must | 2 / 2 | test/release.spec.ts |
| FR-080 | Installable app shell | Must | 0 / 4 | e2e/journey.spec.ts |
| FR-081 | Offline cache and queued actions | Must | 3 / 4 | test/engagement.spec.ts |
| FR-082 | Push notifications | Must | 3 / 3 | test/release.spec.ts |
| FR-083 | Global search | Must | 3 / 3 | test/domain.spec.ts, test/platform.spec.ts, test/leads.spec.ts |
| FR-084 | Role-based home dashboard | Must | 1 / 2 | test/platform.spec.ts |
| FR-085 | Reports and Excel export | Must | 1 / 2 | test/payments.spec.ts |
| FR-086 | Record source and consent basis | Must | 1 / 2 | test/leads.spec.ts |
| FR-087 | Export a person's data | Must | 1 / 1 | test/release.spec.ts |
| FR-088 | Erase or anonymise a person | Must | 3 / 4 | test/domain.spec.ts, test/platform.spec.ts |
| FR-089 | Support access with client consent | Must | 1 / 2 | test/identity.spec.ts |
| FR-090 | Automatic retention purge | Must | 2 / 2 | test/domain.spec.ts, test/platform.spec.ts |
| FR-091 | Integration extension points | Could | 0 / 1 | — |
