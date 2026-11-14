# High-Level Design (HLD) — {Project Name}

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | | | Initial draft |

## 1. Introduction
Purpose, scope, references (BRD, FRD, Solution Design).

## 2. Architecture goals & constraints
Key NFRs driving the design; constraints.

## 3. System context (C4 level 1)
```mermaid
flowchart TB
  user([User]) --> sys[System]
  admin([Admin]) --> sys
  sys --> pay[Payment gateway]
  sys --> mail[Email / SMS provider]
```

## 4. Containers (C4 level 2)
```mermaid
flowchart TB
  subgraph Client
    web[Web app - Next.js]
  end
  subgraph Server
    api[API - NestJS]
    worker[Background worker]
  end
  db[(PostgreSQL)]
  cache[(Redis)]
  storage[(Object storage)]
  web --> api --> db
  api --> cache
  api --> storage
  worker --> db
```
| Container | Technology | Responsibility | Scales by |
|---|---|---|---|

## 5. Logical architecture / modules
| Module | Responsibilities | Owns data | Linked FRs |
|---|---|---|---|

## 6. Technology stack
| Layer | Choice | Why | ADR |
|---|---|---|---|

## 7. Integration design
| ID | System | Protocol | Direction | Auth | Frequency | Error handling / retries | Idempotency |
|---|---|---|---|---|---|---|---|

## 8. Data architecture
Conceptual ER (Mermaid erDiagram), data ownership, classification, retention, backup.

## 9. Security architecture
- Authentication & session management
- Authorisation (RBAC / ABAC) matrix
- Data protection (encryption in transit / at rest, PII masking)
- Secrets management
- OWASP Top 10 control mapping
- Audit logging
- Compliance mapping

## 10. NFR realisation
| NFR ID | Requirement | Design mechanism | Verification |
|---|---|---|---|

## 11. Deployment architecture
Environments, topology diagram, network, domains, CDN.

## 12. CI/CD
```mermaid
flowchart LR
  commit --> lint --> test --> build --> scan[Security scan] --> deployStage[Deploy staging] --> e2e[E2E tests] --> approve{Approve} --> prod[Deploy prod]
```

## 13. Observability
Logs, metrics, traces, dashboards, alerts, SLOs.

## 14. Resilience & DR
Failure modes, timeouts/retries, RPO/RTO, backup/restore.

## 15. Architecture decisions
List of ADRs.

## 16. Risks, assumptions, open questions

## 17. Sign-off
