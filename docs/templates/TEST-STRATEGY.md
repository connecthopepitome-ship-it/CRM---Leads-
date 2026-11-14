# Test Strategy — {Project Name}

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | | | Initial draft |

## 1. Scope & objectives

## 2. Test levels
| Level | Tool | Owner | Coverage target |
|---|---|---|---|
| Unit | Vitest | Dev | ≥ 80% domain logic |
| API / integration | Supertest | Dev | every endpoint |
| E2E | Playwright | QA | every critical journey |
| Accessibility | axe + manual | QA / UX | all screens WCAG 2.2 AA |
| Performance | k6 | QA | NFR targets |
| Security | dependency audit, ZAP baseline | Dev / QA | OWASP Top 10 |
| UAT | manual | Business | top journeys |

## 3. Environments & test data

## 4. Entry / exit criteria

## 5. Defect management
| Severity | Definition | Fix SLA |
|---|---|---|
| Critical | blocks a core journey / data loss / security | before release |
| High | major function broken, workaround hard | before release |
| Medium | | next sprint |
| Low | cosmetic | backlog |

## 6. Risk-based priorities

## 7. Test case format
| TC ID | Title | Linked FR / UC | Type | Preconditions | Steps | Test data | Expected result | Priority | Automated |
|---|---|---|---|---|---|---|---|---|---|

## 8. UAT scenarios

## 9. Reporting
