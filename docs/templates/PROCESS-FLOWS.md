# Process Flows — {Project Name}

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | | | Initial draft |

## 1. Process inventory
| ID | Process | Owner | Trigger | Frequency | Linked UC / FR |
|---|---|---|---|---|---|
| PF-001 | | | | | |

## 2. Level-0 value chain
```mermaid
flowchart LR
  A[Step 1] --> B[Step 2] --> C[Step 3] --> D[Outcome]
```

## 3. Process details
### PF-001 — {Process name}

**AS-IS**
```mermaid
flowchart TD
  subgraph Customer
    a1([Start]) --> a2[Action]
  end
  subgraph Staff
    a2 --> a3{Decision?}
    a3 -- Yes --> a4[Action]
    a3 -- No --> a5[Manual rework]:::pain
  end
  classDef pain fill:#fde2e2,stroke:#c0392b;
```

**Pain points → improvements**
| # | Pain point | Impact | TO-BE improvement | FR |
|---|---|---|---|---|

**TO-BE**
```mermaid
flowchart TD
  subgraph User
    b1([Start]) --> b2[Submit request]
  end
  subgraph System
    b2 --> b3{Valid?}
    b3 -- No --> b4[Show inline errors] --> b2
    b3 -- Yes --> b5[Save + notify]
  end
  subgraph Approver
    b5 --> b6{Approve?}
  end
```

**Exceptions & SLAs**
| Step | Exception | Handling | SLA |
|---|---|---|---|

## 4. Entity lifecycles
```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Submitted: submit
  Submitted --> Approved: approve
  Submitted --> Rejected: reject
  Rejected --> Draft: edit
  Approved --> [*]
```

## 5. Cross-system sequences
```mermaid
sequenceDiagram
  actor U as User
  participant W as Web
  participant A as API
  participant X as External system
  U->>W: action
  W->>A: request
  A->>X: call
  X-->>A: response
  A-->>W: result
```

## 6. Open questions
