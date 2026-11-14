# Requirements Traceability Matrix (RTM) — SaleSphere CRM

_Last refreshed: 2026-11-14 (Phase 12/13 — build and release). Automated test coverage per FR: [TEST-COVERAGE.md](TEST-COVERAGE.md) (regenerate with `node infra/rtm-coverage.mjs`; 86/86 Must FRs automated, 182/262 TCs)._

## Summary
| Metric | Count |
|---|---|
| Business requirements (BR) | 31 (Must 30 · Could 1) |
| Functional requirements (FR) | 91 |
| Use cases (UC) | 15 |
| Non-functional requirements (NFR) | 22 |
| BRs with ≥ 1 FR | 31 / 31 |
| FRs linked to ≥ 1 UC | 59 / 91 |
| FRs linked to ≥ 1 PF | 90 / 91 (FR-091 architectural) |
| Process flows (PF) | 11 |
| FRs linked to ≥ 1 SCR | 87 / 91 (FR-001, FR-002, FR-077, FR-090 system-only) |
| Screens (SCR) / Components (CMP) | 36 / 44 |
| NFRs with HLD mechanism | 22 / 22 |
| ADRs | 14 |
| FRs with API/TBL (LLD batches 1–4) | 91 / 91 |
| Test cases (TC) | 262 (1 per acceptance criterion) |
| FRs with ≥ 1 TC | 91 / 91 |
| Orphan IDs | 0 |

## Matrix
One row per BR → FR link (an FR serving several BRs appears under each).

| BR | FR | Priority | UC | PF | SCR | CMP | API | TBL | TC | Code location | Test status | Coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BR-001 | FR-001 | Must | UC-002 | PF-008 | — | — | — | TBL-001, TBL-006 (+ config.json) | TC-001 – TC-003 | | — | ⏳ |
| BR-001 | FR-002 | Must | UC-002 | PF-008 | — | — | — (provision CLI) | TBL-001 – TBL-004, TBL-010, TBL-012 | TC-004 – TC-006 | | — | ⏳ |
| BR-002 | FR-001 | Must | UC-002 | PF-008 | — | — | — | TBL-001, TBL-006 (+ config.json) | TC-001 – TC-003 | | — | ⏳ |
| BR-002 | FR-003 | Must | — | PF-008 | SCR-027 | CMP-005, CMP-008 | API-002, API-003, API-004 | TBL-001 | TC-007 – TC-009 | | — | ⏳ |
| BR-002 | FR-004 | Must | — | PF-008 | SCR-027 | CMP-005, CMP-008 | API-002, API-004, API-009 | TBL-001 | TC-010 – TC-013 | | — | ⏳ |
| BR-002 | FR-005 | Must | — | PF-008 | SCR-027 | CMP-005, CMP-008 | API-005, API-006 | TBL-002, TBL-003 | TC-014 – TC-019 | | — | ⏳ |
| BR-003 | FR-006 | Must | UC-002, UC-015 | PF-009 | SCR-027 | CMP-005, CMP-008 | API-007 | TBL-004, TBL-006 | TC-020 – TC-022 | | — | ⏳ |
| BR-004 | FR-007 | Must | UC-001 | PF-011 | SCR-001 | CMP-001, CMP-003, CMP-018 | API-010, API-015 | TBL-010, TBL-011, TBL-016 | TC-023 – TC-027 | | — | ⏳ |
| BR-004 | FR-008 | Must | UC-001 | PF-011 | SCR-001 | CMP-001, CMP-003, CMP-018 | API-010, API-026 | TBL-010, TBL-015 | TC-028 – TC-032 | | — | ⏳ |
| BR-004 | FR-009 | Must | UC-001 | PF-011 | SCR-001, SCR-033 | CMP-001, CMP-003, CMP-005, CMP-018 | API-014, API-023 | TBL-010 | TC-033 – TC-035 | | — | ⏳ |
| BR-004 | FR-010 | Must | UC-001 | PF-011 | SCR-030 | CMP-009, CMP-014, CMP-016, CMP-043 | API-012, API-013, API-028, API-029 | TBL-011 | TC-036 – TC-039 | | — | ⏳ |
| BR-004 | FR-011 | Must | — | PF-008, PF-011 | SCR-030 | CMP-009, CMP-014, CMP-016, CMP-043 | API-020 – API-025 | TBL-010, TBL-016 | TC-040 – TC-042 | | — | ⏳ |
| BR-004 | FR-012 | Should | UC-001 | PF-011 | SCR-001, SCR-033 | CMP-001, CMP-003, CMP-005, CMP-018 | API-011, API-016 – API-019, API-027 | TBL-010, TBL-014 | TC-043 – TC-046 | | — | ⏳ |
| BR-005 | FR-011 | Must | — | PF-008, PF-011 | SCR-030 | CMP-009, CMP-014, CMP-016, CMP-043 | API-020 – API-025 | TBL-010, TBL-016 | TC-040 – TC-042 | | — | ⏳ |
| BR-005 | FR-013 | Must | — | PF-011 | SCR-036 | CMP-017, CMP-018, CMP-023, CMP-024, CMP-040 | all (authz pipeline), API-015 | TBL-012, TBL-013 | TC-047 – TC-050 | | — | ⏳ |
| BR-005 | FR-014 | Must | — | PF-008, PF-011 | SCR-030 | CMP-009, CMP-014, CMP-016, CMP-043 | API-030, API-031 | TBL-012 | TC-051 – TC-053 | | — | ⏳ |
| BR-006 | FR-015 | Must | — | PF-011 | SCR-031 | CMP-009, CMP-016, CMP-034 | — (AuditWriter) | TBL-020 | TC-054 – TC-056 | | — | ⏳ |
| BR-006 | FR-016 | Must | — | PF-011 | SCR-031 | CMP-009, CMP-016, CMP-034 | API-040 – API-042 | TBL-020 | TC-057, TC-058 | | — | ⏳ |
| BR-007 | FR-002 | Must | UC-002 | PF-008 | — | — | — (provision CLI) | TBL-001 – TBL-004, TBL-010, TBL-012 | TC-004 – TC-006 | | — | ⏳ |
| BR-007 | FR-017 | Must | — | PF-008 | SCR-027 | CMP-005, CMP-008 | API-052, API-053 | TBL-037 | TC-059, TC-060 | | — | ⏳ |
| BR-007 | FR-018 | Must | — | PF-008 | SCR-028 | CMP-001, CMP-009, CMP-016 | API-045 – API-051 | TBL-030, TBL-032 | TC-061 – TC-063 | | — | ⏳ |
| BR-007 | FR-019 | Must | — | PF-008 | SCR-028 | CMP-001, CMP-009, CMP-016 | API-045 – API-051 | TBL-030, TBL-031, TBL-039 | TC-064 – TC-066 | | — | ⏳ |
| BR-007 | FR-020 | Must | — | PF-008 | SCR-028 | CMP-001, CMP-009, CMP-016 | API-045 – API-051, API-053 | TBL-030, TBL-033, TBL-037 | TC-067, TC-068 | | — | ⏳ |
| BR-007 | FR-021 | Must | — | PF-008 | SCR-007, SCR-028 | CMP-001, CMP-004, CMP-006, CMP-009, CMP-016, CMP-032 | API-045 – API-051 | TBL-030, TBL-034 | TC-069, TC-070 | | — | ⏳ |
| BR-007 | FR-022 | Must | — | PF-008 | SCR-028 | CMP-001, CMP-009, CMP-016 | API-003, API-004, API-045 – API-051 | TBL-001, TBL-030, TBL-035, TBL-036 | TC-071, TC-072 | | — | ⏳ |
| BR-007 | FR-023 | Must | — | PF-001 | SCR-034 | CMP-009, CMP-032, CMP-033 | API-054 – API-057, API-008 | TBL-038 | TC-073 – TC-075 | | — | ⏳ |
| BR-007 | FR-024 | Must | — | PF-008 | SCR-028 | CMP-001, CMP-009, CMP-016 | API-048 – API-050 | TBL-030 | TC-076 | | — | ⏳ |
| BR-008 | FR-037 | Must | UC-002 | PF-001, PF-008 | SCR-029 | CMP-005, CMP-009, CMP-018, CMP-033 | API-120 – API-123 | TBL-060 | TC-109 – TC-111 | | — | ⏳ |
| BR-008 | FR-038 | Must | UC-003 | PF-001 | SCR-029 | CMP-005, CMP-009, CMP-018, CMP-033 | API-124 – API-127 | TBL-061 | TC-112, TC-113 | | — | ⏳ |
| BR-008 | FR-039 | Must | UC-003 | PF-001 | SCR-029 | CMP-005, CMP-009, CMP-018, CMP-033 | API-128, API-129, API-133 | TBL-061, TBL-065 | TC-114 – TC-116 | | — | ⏳ |
| BR-008 | FR-040 | Must | UC-003 | PF-001 | SCR-029 | CMP-005, CMP-009, CMP-018, CMP-033 | API-126, API-128 | TBL-064, TBL-062 | TC-117 – TC-121 | | — | ⏳ |
| BR-008 | FR-041 | Should | UC-003 | PF-001 | SCR-029 | CMP-005, CMP-009, CMP-018, CMP-033 | — (sheet.writeback task) | TBL-061, TBL-062 | TC-122, TC-123 | | — | ⏳ |
| BR-008 | FR-042 | Must | UC-003 | PF-001 | SCR-029 | CMP-005, CMP-009, CMP-018, CMP-033 | API-130 – API-132 | TBL-062, TBL-063 | TC-124, TC-125 | | — | ⏳ |
| BR-008 | FR-043 | Must | UC-003 | PF-001 | SCR-029, SCR-036 | CMP-005, CMP-009, CMP-017, CMP-018, CMP-023, CMP-024, CMP-033, CMP-040 | API-120 | TBL-060 | TC-126, TC-127 | | — | ⏳ |
| BR-009 | FR-025 | Must | UC-004 | PF-001 | SCR-005 | CMP-003, CMP-004, CMP-008, CMP-035, CMP-036 | API-071, API-073, API-079 | TBL-040, TBL-041, TBL-042 | TC-077 – TC-079 | | — | ⏳ |
| BR-009 | FR-026 | Must | — | PF-001 | SCR-034 | CMP-009, CMP-032, CMP-033 | API-082, API-008 | TBL-040, TBL-041, TBL-038 | TC-080, TC-081 | | — | ⏳ |
| BR-009 | FR-027 | Must | UC-004 | PF-001 | SCR-029, SCR-035 | CMP-001, CMP-003, CMP-005, CMP-009, CMP-018, CMP-033 | API-083 – API-086 | TBL-040, TBL-043, TBL-044, TBL-000 | TC-082 – TC-086 | | — | ⏳ |
| BR-010 | FR-028 | Must | UC-003, UC-004 | PF-001 | SCR-005 | CMP-003, CMP-004, CMP-008, CMP-035, CMP-036 | API-071 (normalise) | TBL-040, TBL-041 | TC-087, TC-088 | | — | ⏳ |
| BR-010 | FR-029 | Must | UC-003, UC-004 | PF-001 | SCR-005 | CMP-003, CMP-004, CMP-008, CMP-035, CMP-036 | API-071, API-079 | TBL-040, TBL-041 | TC-089 – TC-091 | | — | ⏳ |
| BR-010 | FR-030 | Should | — | PF-001 | SCR-004 | CMP-025, CMP-027, CMP-028, CMP-032, CMP-039 | API-077 | TBL-040, TBL-050 | TC-092 | | — | ⏳ |
| BR-011 | FR-022 | Must | — | PF-008 | SCR-028 | CMP-001, CMP-009, CMP-016 | API-003, API-004, API-045 – API-051 | TBL-001, TBL-030, TBL-035, TBL-036 | TC-071, TC-072 | | — | ⏳ |
| BR-011 | FR-031 | Must | UC-003, UC-004 | PF-001 | SCR-004, SCR-030 | CMP-009, CMP-014, CMP-016, CMP-025, CMP-027, CMP-028, CMP-032, CMP-039, CMP-043 | API-071, API-075 | TBL-040, TBL-042 | TC-093 – TC-096 | | — | ⏳ |
| BR-011 | FR-032 | Must | — | PF-002 | SCR-003 | CMP-009, CMP-010, CMP-011, CMP-034, CMP-039 | API-076 | TBL-040 | TC-097, TC-098 | | — | ⏳ |
| BR-012 | FR-022 | Must | — | PF-008 | SCR-028 | CMP-001, CMP-009, CMP-016 | API-003, API-004, API-045 – API-051 | TBL-001, TBL-030, TBL-035, TBL-036 | TC-071, TC-072 | | — | ⏳ |
| BR-012 | FR-032 | Must | — | PF-002 | SCR-003 | CMP-009, CMP-010, CMP-011, CMP-034, CMP-039 | API-076 | TBL-040 | TC-097, TC-098 | | — | ⏳ |
| BR-012 | FR-033 | Must | UC-005 | PF-002 | SCR-003, SCR-004 | CMP-009, CMP-010, CMP-011, CMP-025, CMP-027, CMP-028, CMP-032, CMP-034, CMP-039 | API-072, API-074, API-075 | TBL-040 | TC-099 – TC-101 | | — | ⏳ |
| BR-012 | FR-034 | Must | — | PF-002 | SCR-003 | CMP-009, CMP-010, CMP-011, CMP-034, CMP-039 | API-070, API-080, API-081 | TBL-040, TBL-045 | TC-102 – TC-104 | | — | ⏳ |
| BR-012 | FR-035 | Must | — | PF-002 | SCR-004 | CMP-025, CMP-027, CMP-028, CMP-032, CMP-039 | API-100 | TBL-050 | TC-105 | | — | ⏳ |
| BR-013 | FR-021 | Must | — | PF-008 | SCR-007, SCR-028 | CMP-001, CMP-004, CMP-006, CMP-009, CMP-016, CMP-032 | API-045 – API-051 | TBL-030, TBL-034 | TC-069, TC-070 | | — | ⏳ |
| BR-013 | FR-035 | Must | — | PF-002 | SCR-004 | CMP-025, CMP-027, CMP-028, CMP-032, CMP-039 | API-100 | TBL-050 | TC-105 | | — | ⏳ |
| BR-013 | FR-044 | Must | UC-005 | PF-002 | SCR-004, SCR-006 | CMP-005, CMP-006, CMP-007, CMP-016, CMP-025, CMP-027, CMP-028, CMP-032, CMP-039 | API-101, API-102 | TBL-050, TBL-040 | TC-128 – TC-131 | | — | ⏳ |
| BR-013 | FR-045 | Should | UC-005 | PF-002 | SCR-004, SCR-006 | CMP-005, CMP-006, CMP-007, CMP-016, CMP-025, CMP-027, CMP-028, CMP-032, CMP-039 | API-102 | TBL-050, TBL-040, TBL-051 | TC-132, TC-133 | | — | ⏳ |
| BR-013 | FR-046 | Must | UC-007, UC-013 | PF-002 | SCR-004, SCR-007 | CMP-004, CMP-006, CMP-016, CMP-025, CMP-027, CMP-028, CMP-032, CMP-039 | API-106 | TBL-050 | TC-134 – TC-136 | | — | ⏳ |
| BR-013 | FR-047 | Must | UC-007 | PF-002 | SCR-004, SCR-007 | CMP-004, CMP-006, CMP-016, CMP-025, CMP-027, CMP-028, CMP-032, CMP-039 | API-107, API-108, API-110 | TBL-052, TBL-053 | TC-137 – TC-140 | | — | ⏳ |
| BR-013 | FR-048 | Must | — | PF-002 | SCR-004 | CMP-025, CMP-027, CMP-028, CMP-032, CMP-039 | API-101 | TBL-050 | TC-141, TC-142 | | — | ⏳ |
| BR-014 | FR-045 | Should | UC-005 | PF-002 | SCR-004, SCR-006 | CMP-005, CMP-006, CMP-007, CMP-016, CMP-025, CMP-027, CMP-028, CMP-032, CMP-039 | API-102 | TBL-050, TBL-040, TBL-051 | TC-132, TC-133 | | — | ⏳ |
| BR-014 | FR-049 | Must | UC-005 | PF-002 | SCR-002, SCR-004, SCR-008 | CMP-010, CMP-013, CMP-014, CMP-025, CMP-027, CMP-028, CMP-032, CMP-033, CMP-038, CMP-039 | API-103 – API-105 | TBL-051 | TC-143 – TC-146 | | — | ⏳ |
| BR-014 | FR-050 | Must | UC-005 | PF-002 | SCR-002, SCR-004, SCR-026 | CMP-009, CMP-010, CMP-013, CMP-025, CMP-027, CMP-028, CMP-032, CMP-033, CMP-034, CMP-038, CMP-039 | API-101, API-228 (RPT-006) | TBL-040 | TC-147 – TC-149 | | — | ⏳ |
| BR-015 | FR-036 | Must | UC-006, UC-008 | PF-002 | SCR-009 | CMP-003, CMP-005, CMP-015 | API-078 | TBL-040, TBL-085, TBL-086 | TC-106 – TC-108 | | — | ⏳ |
| BR-016 | FR-019 | Must | — | PF-008 | SCR-028 | CMP-001, CMP-009, CMP-016 | API-045 – API-051 | TBL-030, TBL-031, TBL-039 | TC-064 – TC-066 | | — | ⏳ |
| BR-016 | FR-051 | Must | UC-007 | PF-003 | SCR-010, SCR-023 | CMP-004, CMP-007, CMP-010, CMP-014, CMP-029, CMP-030, CMP-034 | API-140 – API-144 | TBL-070 | TC-150 – TC-152 | | — | ⏳ |
| BR-016 | FR-052 | Must | UC-007 | PF-003 | SCR-010 | CMP-004, CMP-007, CMP-029, CMP-030 | API-141, API-150 | TBL-070 | TC-153 – TC-156 | | — | ⏳ |
| BR-016 | FR-053 | Must | UC-007 | PF-003 | SCR-010, SCR-011 | CMP-001, CMP-004, CMP-007, CMP-019, CMP-029, CMP-030, CMP-042 | API-145, API-146 | TBL-070 | TC-157 – TC-161 | | — | ⏳ |
| BR-016 | FR-054 | Must | UC-007 | PF-003 | SCR-010, SCR-011 | CMP-001, CMP-004, CMP-007, CMP-019, CMP-029, CMP-030, CMP-042 | API-147, API-148 | TBL-070 | TC-162 – TC-164 | | — | ⏳ |
| BR-017 | FR-055 | Must | UC-007 | PF-003 | SCR-011 | CMP-001, CMP-019, CMP-042 | API-149, API-210 | TBL-070, TBL-090 | TC-165, TC-166 | | — | ⏳ |
| BR-017 | FR-056 | Must | UC-007 | PF-003 | SCR-011 | CMP-001, CMP-019, CMP-042 | API-145, API-207 | TBL-070, TBL-092 | TC-167, TC-168 | | — | ⏳ |
| BR-017 | FR-057 | Must | UC-008 | PF-003 | SCR-011, SCR-012 | CMP-001, CMP-016, CMP-019, CMP-042 | API-151, API-205 | TBL-070, TBL-092 | TC-169 – TC-172 | | — | ⏳ |
| BR-017 | FR-058 | Must | UC-008 | PF-003 | SCR-011, SCR-012 | CMP-001, CMP-016, CMP-019, CMP-042 | API-142, API-205 | TBL-070, TBL-093 | TC-173 – TC-175 | | — | ⏳ |
| BR-017 | FR-079 | Must | — | PF-003 | SCR-012, SCR-016 | CMP-001, CMP-016, CMP-031, CMP-042 | API-205 – API-209 | TBL-092, TBL-093 | TC-231, TC-232 | | — | ⏳ |
| BR-018 | FR-059 | Must | UC-009 | PF-004 | SCR-011, SCR-013, SCR-023 | CMP-001, CMP-009, CMP-010, CMP-014, CMP-019, CMP-034, CMP-042 | API-152, API-155 | TBL-071, TBL-075 | TC-176 – TC-179 | | — | ⏳ |
| BR-018 | FR-060 | Must | UC-009 | PF-004 | SCR-013 | CMP-009, CMP-019 | API-157 | TBL-071 | TC-180, TC-181 | | — | ⏳ |
| BR-018 | FR-061 | Must | UC-009, UC-012 | PF-004, PF-006 | SCR-013 | CMP-009, CMP-019 | API-156 | TBL-071 | TC-182, TC-183 | | — | ⏳ |
| BR-019 | FR-017 | Must | — | PF-008 | SCR-027 | CMP-005, CMP-008 | API-052, API-053 | TBL-037 | TC-059, TC-060 | | — | ⏳ |
| BR-019 | FR-052 | Must | UC-007 | PF-003 | SCR-010 | CMP-004, CMP-007, CMP-029, CMP-030 | API-141, API-150 | TBL-070 | TC-153 – TC-156 | | — | ⏳ |
| BR-019 | FR-061 | Must | UC-009, UC-012 | PF-004, PF-006 | SCR-013 | CMP-009, CMP-019 | API-156 | TBL-071 | TC-182, TC-183 | | — | ⏳ |
| BR-019 | FR-062 | Must | UC-010 | PF-004 | SCR-014, SCR-023 | CMP-007, CMP-010, CMP-014, CMP-029, CMP-030, CMP-034, CMP-043 | API-160, API-161 | TBL-072 | TC-184, TC-185 | | — | ⏳ |
| BR-019 | FR-063 | Must | UC-010 | PF-004 | SCR-014 | CMP-007, CMP-029, CMP-030, CMP-043 | API-161, API-167 | TBL-072 | TC-186, TC-187 | | — | ⏳ |
| BR-019 | FR-064 | Must | UC-010 | PF-004 | SCR-014 | CMP-007, CMP-029, CMP-030, CMP-043 | API-164 | TBL-072 | TC-188, TC-189 | | — | ⏳ |
| BR-019 | FR-065 | Must | UC-010 | PF-004 | SCR-014, SCR-015 | CMP-007, CMP-019, CMP-029, CMP-030, CMP-031, CMP-042, CMP-043 | API-162 – API-164 | TBL-072, TBL-003, TBL-074 | TC-190 – TC-192 | | — | ⏳ |
| BR-019 | FR-066 | Must | UC-010, UC-012 | PF-004, PF-006 | SCR-015, SCR-019 | CMP-005, CMP-015, CMP-019, CMP-031, CMP-035, CMP-042 | API-165, API-166 | TBL-073, TBL-074 | TC-193, TC-194 | | — | ⏳ |
| BR-019 | FR-067 | Must | UC-010 | PF-004 | SCR-015 | CMP-019, CMP-031, CMP-042 | API-168, API-210 | TBL-072, TBL-090 | TC-195, TC-196 | | — | ⏳ |
| BR-019 | FR-069 | Must | UC-010 | PF-004 | SCR-015, SCR-016 | CMP-019, CMP-031, CMP-042 | API-205 – API-207 | TBL-092, TBL-093 | TC-205 | | — | ⏳ |
| BR-020 | FR-018 | Must | — | PF-008 | SCR-028 | CMP-001, CMP-009, CMP-016 | API-045 – API-051 | TBL-030, TBL-032 | TC-061 – TC-063 | | — | ⏳ |
| BR-020 | FR-067 | Must | UC-010 | PF-004 | SCR-015 | CMP-019, CMP-031, CMP-042 | API-168, API-210 | TBL-072, TBL-090 | TC-195, TC-196 | | — | ⏳ |
| BR-020 | FR-068 | Must | UC-010 | PF-004 | SCR-015, SCR-016 | CMP-019, CMP-031, CMP-042 | API-169, API-205 | TBL-072 | TC-197 – TC-204 | | — | ⏳ |
| BR-020 | FR-069 | Must | UC-010 | PF-004 | SCR-015, SCR-016 | CMP-019, CMP-031, CMP-042 | API-205 – API-207 | TBL-092, TBL-093 | TC-205 | | — | ⏳ |
| BR-021 | FR-070 | Must | UC-011 | PF-005 | SCR-017, SCR-023 | CMP-003, CMP-005, CMP-009, CMP-010, CMP-014, CMP-032, CMP-034, CMP-035 | API-181, API-186 | TBL-080, TBL-082, TBL-000 | TC-206 – TC-209 | | — | ⏳ |
| BR-021 | FR-071 | Must | UC-011, UC-012 | PF-005 | SCR-017 | CMP-003, CMP-005, CMP-009, CMP-032, CMP-035 | API-181, API-184, API-185 | TBL-080, TBL-081, TBL-074 | TC-210 – TC-213 | | — | ⏳ |
| BR-021 | FR-072 | Must | UC-011 | PF-005 | SCR-017, SCR-018 | CMP-003, CMP-005, CMP-009, CMP-032, CMP-035, CMP-042, CMP-043 | API-182 | TBL-080, TBL-090 | TC-214 | | — | ⏳ |
| BR-021 | FR-073 | Must | — | PF-005 | SCR-018 | CMP-042, CMP-043 | API-183 | TBL-080, TBL-081, TBL-074 | TC-215, TC-216 | | — | ⏳ |
| BR-022 | FR-074 | Must | UC-006 | PF-007 | SCR-020, SCR-021 | CMP-009, CMP-010, CMP-013, CMP-014, CMP-025, CMP-027, CMP-034 | API-190 – API-192, API-194, API-195 | TBL-085 – TBL-088 | TC-217, TC-218 | | — | ⏳ |
| BR-022 | FR-075 | Must | UC-011, UC-013 | PF-007 | SCR-021 | CMP-013, CMP-014, CMP-025, CMP-027 | API-193, API-197 | TBL-085, TBL-072 | TC-219 – TC-221 | | — | ⏳ |
| BR-023 | FR-076 | Must | UC-013 | PF-007 | SCR-022 | CMP-007, CMP-009 | API-196 | TBL-074 | TC-222 – TC-224 | | — | ⏳ |
| BR-024 | FR-037 | Must | UC-002 | PF-001, PF-008 | SCR-029 | CMP-005, CMP-009, CMP-018, CMP-033 | API-120 – API-123 | TBL-060 | TC-109 – TC-111 | | — | ⏳ |
| BR-024 | FR-043 | Must | UC-003 | PF-001 | SCR-029, SCR-036 | CMP-005, CMP-009, CMP-017, CMP-018, CMP-023, CMP-024, CMP-033, CMP-040 | API-120 | TBL-060 | TC-126, TC-127 | | — | ⏳ |
| BR-024 | FR-077 | Must | UC-006 | PF-008 | — | — | — (FolderService) | TBL-091 | TC-225, TC-226 | | — | ⏳ |
| BR-024 | FR-078 | Must | — | PF-002, PF-005 | SCR-004 | CMP-025, CMP-027, CMP-028, CMP-032, CMP-039 | API-200 – API-204 | TBL-090, TBL-094 | TC-227 – TC-230 | | — | ⏳ |
| BR-024 | FR-079 | Must | — | PF-003 | SCR-012, SCR-016 | CMP-001, CMP-016, CMP-031, CMP-042 | API-205 – API-209 | TBL-092, TBL-093 | TC-231, TC-232 | | — | ⏳ |
| BR-025 | FR-037 | Must | UC-002 | PF-001, PF-008 | SCR-029 | CMP-005, CMP-009, CMP-018, CMP-033 | API-120 – API-123 | TBL-060 | TC-109 – TC-111 | | — | ⏳ |
| BR-025 | FR-043 | Must | UC-003 | PF-001 | SCR-029, SCR-036 | CMP-005, CMP-009, CMP-017, CMP-018, CMP-023, CMP-024, CMP-033, CMP-040 | API-120 | TBL-060 | TC-126, TC-127 | | — | ⏳ |
| BR-025 | FR-047 | Must | UC-007 | PF-002 | SCR-004, SCR-007 | CMP-004, CMP-006, CMP-016, CMP-025, CMP-027, CMP-028, CMP-032, CMP-039 | API-107, API-108, API-110 | TBL-052, TBL-053 | TC-137 – TC-140 | | — | ⏳ |
| BR-026 | FR-080 | Must | — | PF-002 | SCR-036 | CMP-017, CMP-018, CMP-023, CMP-024, CMP-040 | API-002 (PWA shell, manifest) | — | TC-233 – TC-236 | | — | ⏳ |
| BR-026 | FR-081 | Must | UC-005 | PF-002 | SCR-006, SCR-036 | CMP-005, CMP-006, CMP-007, CMP-016, CMP-017, CMP-018, CMP-023, CMP-024, CMP-040 | API-109 (+ IndexedDB outbox) | TBL-050, TBL-051 | TC-237 – TC-240 | | — | ⏳ |
| BR-027 | FR-082 | Must | UC-008 | PF-002 | SCR-025, SCR-033 | CMP-003, CMP-005, CMP-041 | API-215 – API-219 | TBL-095 – TBL-097 | TC-241 – TC-243 | | — | ⏳ |
| BR-028 | FR-083 | Must | — | PF-002 | SCR-020, SCR-024 | CMP-009, CMP-010, CMP-026, CMP-034 | API-226 | searchTokens on TBL-040, TBL-070, TBL-072, TBL-080, TBL-085 | TC-244 – TC-246 | | — | ⏳ |
| BR-029 | FR-084 | Must | — | PF-007 | SCR-002 | CMP-010, CMP-013, CMP-033, CMP-038, CMP-039 | API-225, API-230 | TBL-100, TBL-101 | TC-247, TC-248 | | — | ⏳ |
| BR-029 | FR-085 | Must | — | PF-007 | SCR-026 | CMP-009, CMP-034, CMP-038 | API-227 – API-229 | TBL-100 | TC-249, TC-250 | | — | ⏳ |
| BR-030 | FR-086 | Must | UC-004 | PF-001 | SCR-005, SCR-035 | CMP-001, CMP-003, CMP-004, CMP-005, CMP-008, CMP-035, CMP-036 | API-071, API-083 | TBL-040, TBL-086 | TC-251, TC-252 | | — | ⏳ |
| BR-030 | FR-087 | Must | UC-014 | PF-010 | SCR-032 | CMP-003, CMP-009, CMP-043 | API-240, API-241, API-243 | TBL-105, TBL-108 | TC-253 | | — | ⏳ |
| BR-030 | FR-088 | Must | UC-014 | PF-010 | SCR-032 | CMP-003, CMP-009, CMP-043 | API-240, API-242, API-243 | TBL-105 – TBL-107 | TC-254 – TC-257 | | — | ⏳ |
| BR-030 | FR-089 | Must | — | PF-010, PF-011 | SCR-030 | CMP-009, CMP-014, CMP-016, CMP-043 | API-035 | TBL-010 | TC-258, TC-259 | | — | ⏳ |
| BR-030 | FR-090 | Must | — | PF-010 | — | — | — (retention.purge job) | TBL-107 | TC-260, TC-261 | | — | ⏳ |
| BR-031 | FR-091 | Could | — | — | SCR-036 | CMP-017, CMP-018, CMP-023, CMP-024, CMP-040 | — (provider ports) | — | TC-262 | | — | ⏳ |

## NFR traceability
| NFR | HLD section | Mechanism | Verified by TC | Status |
|---|---|---|---|---|
| NFR-001 | HLD §10 | Static PWA on Cloudflare CDN; route-level code splitting; precached shell; skeletons; aggregation queries; … | TBD (Phase 8) — method: Lighthouse CI (Moto G Power profile, 4G throttling) on key routes in Phase 8; budgets in CI | ⏳ |
| NFR-002 | HLD §10 | Single warm `api` function (`cpu: 1`, 1 GiB, concurrency 40); lean bundle (esbuild, no heavy frameworks); i… | TBD (Phase 8) — method: k6 load test against staging; **cold-start test** that forces scale-to-zero (idle 20 min) and measures firs… | ⏳ |
| NFR-003 | HLD §10 | Dedicated `pdf` function (2 GiB, `cpu: 2`); async via Cloud Tasks after commit, so the user is never blocke… | TBD (Phase 8) — method: Timed render tests **including cold starts** (H-07). Measured at pilot volume, the cold-start p95 is expect… | ⏳ |
| NFR-004 | HLD §10 | Apps Script HMAC ping → immediate pull; `tick-1m` polls; 15-min safety poll; marker + transactions; sync ru… | TBD (Phase 8) — method: Integration test with emulator + real test sheet; `sync_lag_seconds` metric | ⏳ |
| NFR-005 | HLD §10 | Managed serverless; no single VM; Cloudflare CDN; health endpoint; graceful degradation (cached reads, outbox) | TBD (Phase 8) — method: Cloud Monitoring uptime check every 5 min on `/api/v1/health`; monthly SLO report | ⏳ |
| NFR-006 | HLD §10 | Firestore scheduled backups: **daily, kept 7 days**, plus **weekly, kept 5 weeks** (the platform maximum fo… | TBD (Phase 8) — method: Restore drill into a scratch database before go-live and quarterly | ⏳ |
| NFR-007 | HLD §10 | §9 controls; ASVS checklist per LLD; endpoint security matrix | TBD (Phase 8) — method: ZAP baseline scan in CI **plus an authenticated ZAP full scan on staging per release** (M-11); ASVS L2 chec… | ⏳ |
| NFR-008 | HLD §10 · ADR-004, ADR-005, ADR-006 | ADR-004, ADR-005, ADR-006; gitleaks | TBD (Phase 8) — method: Rules unit tests (emulator); header scan; secret-scan gate | ⏳ |
| NFR-009 | HLD §10 | `_headers` CSP with nonce-less hashed bundles; cookie flags; Renovate + audit gate | TBD (Phase 8) — method: Header assertions in E2E; CI audit gate | ⏳ |
| NFR-010 | HLD §10 | Region pinned in provisioning; pino redaction; privacy module | TBD (Phase 8) — method: Provisioning check; log-redaction unit tests; TC for export/erase timing | ⏳ |
| NFR-011 | HLD §10 | Indexed queries per screen; pagination; token search; summaries | TBD (Phase 8) — method: Synthetic data seeding + k6 at target volumes in Phase 9/10 | ⏳ |
| NFR-012 | HLD §10 | Scale-to-zero; 2 scheduler jobs; minimal reads (denormalised totals); budget alert | TBD (Phase 8) — method: Cost spike in Phase 9 (billing export over 2 weeks synthetic load); budget alert configured | ⏳ |
| NFR-013 | HLD §10 | Design system tokens and components; Radix primitives; jsx-a11y lint | TBD (Phase 8) — method: Playwright + axe on all routes; manual screen-reader checks | ⏳ |
| NFR-014 | HLD §10 | UX flows (SCR-006, SCR-010, SCR-014); defaults from masters; Solo quote → invoice | TBD (Phase 8) — method: Usability test T1–T6 (UX §11); E2E step counts | ⏳ |
| NFR-015 | HLD §10 | pino JSON with request/user ID; Error Reporting; log-based metrics; `/health` with version | TBD (Phase 8) — method: Alert test in staging; dashboard review | ⏳ |
| NFR-016 | HLD §10 | Browserslist targets; responsive design system | TBD (Phase 8) — method: Playwright projects: Chromium, Firefox, WebKit; mobile viewports | ⏳ |
| NFR-017 | HLD §10 | `Intl` with `en-IN`; date-fns-tz IST; i18n message catalogue (ICU) from day 1; Noto fonts in PDF | TBD (Phase 8) — method: Unit tests for formatting; PDF snapshot tests with Indic names | ⏳ |
| NFR-018 | HLD §10 | `packages/domain` isolation; Vitest coverage threshold in CI | TBD (Phase 8) — method: CI coverage gate | ⏳ |
| NFR-019 | HLD §10 | Provisioning script; config-only installs; expand/contract migrations; previous function revision kept | TBD (Phase 8) — method: Timed install rehearsal on staging; rollback drill | ⏳ |
| NFR-020 | HLD §10 | Firestore transactions for counters and payments; `version` + If-Match | TBD (Phase 8) — method: Concurrency tests (parallel issue/pay) on emulator | ⏳ |
| NFR-021 | HLD §10 | IndexedDB outbox replayed by the page on `online`/focus (Background Sync only as a wake-up hint where suppo… | TBD (Phase 8) — method: E2E with offline emulation and restart. iOS Safari may evict storage after 7 days of non-use for non-instal… | ⏳ |
| NFR-022 | HLD §10 | Audit in the same transaction; indexed `(at)`, `(userId, at)` | TBD (Phase 8) — method: Audit-coverage test per endpoint; timed query | ⏳ |

## Gaps
| Type | ID | Issue | Action |
|---|---|---|---|
| Coverage | FR-001 – FR-091 | No TC yet | Phase 8 |
| Info | FR-003, 004, 005, 011, 013–024, 026, 030, 032, 034, 035, 048, 073, 078–080, 083–085, 089–091 (32) | Not linked to a UC — configuration/CRUD/cross-cutting FRs specified by their own acceptance criteria | Review at G2; UCs optional |
