# Design System — {Project Name}

## 1. Brand principles & visual direction

## 2. Design tokens
### 2.1 Colour
| Token | Light | Dark | Usage |
|---|---|---|---|
| --color-bg | | | page background |
| --color-surface | | | cards, panels |
| --color-text | | | body text |
| --color-text-muted | | | secondary text |
| --color-primary | | | primary actions |
| --color-primary-fg | | | text on primary |
| --color-border | | | |
| --color-success / warning / danger / info | | | status |

### 2.2 Typography
| Token | Font | Size / line-height | Weight | Usage |
|---|---|---|---|---|
| display | | | | |
| h1 … h4 | | | | |
| body / body-sm | | | | |
| caption / label / mono | | | | |

### 2.3 Spacing (4 px base): 0, 1=4, 2=8, 3=12, 4=16, 6=24, 8=32, 12=48, 16=64
### 2.4 Radius, elevation, borders
### 2.5 Motion: durations (fast 120 ms, base 200 ms, slow 320 ms), easing, reduced-motion rule
### 2.6 Breakpoints: sm 360, md 768, lg 1024, xl 1280, 2xl 1536
### 2.7 Z-index scale

## 3. Components
### CMP-001 — Button
- **Variants:** primary, secondary, ghost, destructive, link
- **Sizes:** sm, md, lg
- **States:** default, hover, focus-visible, active, disabled, loading
- **Props:** variant, size, icon, loading, disabled, asChild
- **A11y:** native `<button>`, aria-busy when loading, 44 px target
(Repeat for Input, Select, Checkbox, Radio, Switch, Textarea, DatePicker, Table/DataGrid, Card, Modal/Dialog, Drawer, Tabs, Toast, Alert, Badge, Avatar, Breadcrumb, Pagination, EmptyState, Skeleton, Navbar, Sidebar, FormField, FileUpload, Stepper, Chart wrappers.)

## 4. Patterns
Forms, tables, filters, page headers, empty states, error pages.

## 5. Iconography & illustration

## 6. Data visualisation palette
