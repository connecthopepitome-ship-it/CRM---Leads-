# SaleSphere CRM — Master Application

> **SaleSphere** is a high-performance, mobile-first, enterprise-grade CRM and commercial sales operations platform designed for Indian B2B and modern service enterprises. It unifies lead lifecycle management, customer 360, multi-line commercial quotation generation, GST-compliant invoicing, order fulfillment tracking, payment collections, and Google Workspace integrations into a single, cohesive PWA application.

---

## 🌟 Key Features & Modules

### 1. Lead Management & SLA Engine
* **Full Stage Lifecycle**: Track leads from `New` → `Contacted` → `Interested` → `Proposal Sent` → `Negotiation` → `Won` / `Lost`.
* **First-Contact SLA Monitoring**: Configurable SLA thresholds with automated status tracking (`due`, `within SLA`, `breached`).
* **Lead Conversion**: One-click promotion from qualified Lead to Customer with full history retention.
* **Engagement & Activity Feed**: Call logs, meeting notes, email history, WhatsApp interaction logging, and timeline activities.

### 2. Commercial Quotation Builder
* **Interactive Proposal Engine**: Build professional, multi-tier quotations with real-time calculations.
* **Live Presets**: Instant load presets (Enterprise, Starter, Blank) for rapid sales workflows.
* **Granular GST Tax Calculations**: Support for 0% (Exempt), 5%, 12%, 18% (Services), and 28% slabs with automatic IGST vs. CGST/SGST detection based on Place of Supply (POS).
* **Line-Level & Document Discounts**: Percentage and fixed discount rules with automated rounding.
* **Digital Acceptance & Share Links**: Cryptographically signed public share links (`/s/:token`) for client approval.

### 3. Orders & Delivery Tracking
* **Sales Order Lifecycle**: Status transitions from `Confirmed` → `In Progress` → `Delivered` → `Closed` / `Cancelled`.
* **Line-Item Reconciliation**: Track `Ordered` vs. `Invoiced` vs. `Pending` quantities per line item.
* **One-Click Invoicing**: Generate partial or full tax invoices directly from pending order balances.

### 4. Invoicing & GST Compliance
* **Document Types**: Tax Invoices, Bills of Supply (for composition schemes / exempt sales), Proforma Invoices, and Credit Notes.
* **Automated Numbering Series**: Custom FY prefix patterns (e.g. `QT/26-27/0001`, `INV/26-27/0001`, `RCT/26-27/0001`).
* **Dynamic UPI QR Code**: Real-time payment QR embedded directly into invoices with dynamic amount and invoice reference string.
* **PDF Generation**: High-fidelity, print-ready PDFs formatted for A4 business stationery.

### 5. Collections & Payment Receipts
* **Payment Modes**: NEFT, RTGS, IMPS, UPI, Cheque, and Cash.
* **TDS & Advance Handling**: TDS deduction accounting and on-account advances.
* **Multi-Invoice Allocations**: Split a single lump-sum customer payment across multiple outstanding invoices.
* **Payment Reversals**: Audit-logged reversal mechanism restoring invoice balances and UPI statuses.

### 6. Customer 360 & Accounts Statement
* **Holistic Customer Profile**: Consolidated view of all active orders, open quotes, unpaid invoices, and payment receipts.
* **Aging Buckets**: Automated AR aging analysis (`Not yet due`, `1–30 days`, `31–60 days`, `61–90 days`, `90+ days`).
* **Statement of Account**: Date-filtered ledger statement with opening balance, debit/credit entries, running balance, and PDF/Excel export.

### 7. Google Workspace Integration
* **Google AppScript Drive Bridge**: Zero-cost, high-speed document storage bridge syncing attachments to Google Drive folders.
* **Google Contacts & Sheets**: Bi-directional lead imports and backup sheet synchronization.

---

## 🏗️ Architecture & Monorepo Structure

SaleSphere is architected as an ultra-fast, clean monorepo powered by **pnpm workspaces**:

```
.
├── apps/
│   ├── api/                       # REST API service (Express 5 / Node.js, D1 SQLite & Firestore adapters)
│   └── web/                       # Frontend PWA (React 18, Vite, Tailwind CSS, TanStack Query, PWA SW)
│
├── packages/
│   ├── domain/                    # Pure business logic, state machines, GST math, currency formatting
│   ├── contracts/                 # Zod validation schemas and shared TypeScript DTO interfaces
│   ├── ui/                        # Reusable Grovia-inspired design system tokens, Tailwind preset, and components
│   ├── doc-templates/             # Compliant HTML/CSS document templates for Quotes, Invoices, Receipts
│   └── config/                    # Shared ESLint, Prettier, and TypeScript configurations
│
├── infra/
│   └── appscript/                 # Google Apps Script bridge for Google Drive file management
│
├── docs/                          # Comprehensive SDLC specifications (BRD, FRD, UX Spec, HLD, LLD)
├── schema.sql                     # Production Cloudflare D1 SQL database schema
├── wrangler.jsonc                 # Cloudflare Worker configuration & D1 database bindings
└── .env.example                   # Master environment variable template
```

### Technology Stack
* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS (Grovia Sage-Green Minimalist SaaS System), Lucide React, TanStack Query v5.
* **Backend**: Express 5 on Cloud Functions / Cloudflare Worker edge proxy, Argon2id password hashing, Ed25519 (EdDSA) JWTs.
* **Database**: Dual-engine support via hexagonal `Db` repository port:
  * **Cloudflare D1** (Distributed SQLite at the edge) for ultra-low latency serverless persistence.
  * **Google Cloud Firestore** for Google Cloud native enterprise deployments.
* **Testing & QA**: Vitest (unit testing), Supertest (API integration testing), Playwright (multi-viewport mobile responsive audits).

---

## 🚀 Quick Start & Local Development

### Prerequisites
* **Node.js**: `v20.x` or `v22.x` (LTS recommended)
* **Package Manager**: `pnpm >= 9.x` (`npm install -g pnpm`)

### 1. Installation
Clone the repository and install all monorepo dependencies:
```bash
git clone https://github.com/connecthopepitome-ship-it/Sales_Sphare_master-.git
cd Sales_Sphare_master-
pnpm install
```

### 2. Environment Setup
Copy the environment template:
```bash
cp .env.example apps/api/.env
```
*(Default values in `.env.example` allow immediate local development with an in-memory database and seeded demo records).*

### 3. Start Development Servers
Run the full monorepo concurrently:
```bash
pnpm dev
```
* **Frontend Web App**: `http://localhost:5173`
* **Backend REST API**: `http://localhost:8787/api/v1`

### 4. Default Demo Credentials
When starting with default seeded credentials:
* **Username**: `admin`
* **Password**: `ChangeMe!2026` *(or select Demo One-Click Sign In)*

---

## 🗄️ Database & Cloudflare D1 Deployment

SaleSphere runs natively on Cloudflare Workers using Cloudflare D1 for persistent storage.

### 1. Initialize Cloudflare D1 Database
Create a new D1 database via Wrangler:
```bash
npx wrangler d1 create salesphere-db
```
Copy the generated `database_id` into `wrangler.jsonc`.

### 2. Run Database Migrations
Execute the SQL schema to create all tables and indices:
```bash
npx wrangler d1 execute salesphere-db --remote --file=schema.sql
```

### 3. Deploy Web & Edge Worker
Build the web assets and deploy the Worker:
```bash
pnpm --filter @ss/web run build
npx wrangler deploy
```

---

## 🧪 Testing & Quality Gates

Run the test suites across the monorepo:

```bash
# Run unit and integration tests across all packages
pnpm test

# Run frontend typechecks and linting
pnpm typecheck
pnpm lint

# Run mobile responsive audit with Playwright
node test-mobile-audit.cjs
```

---

## 📱 Mobile-First Design System

SaleSphere features a dedicated **mobile-first responsive architecture**:
* Zero horizontal scroll blowout across viewports: iPhone SE (320px), Galaxy S8 (360px), iPhone 12/13/14 (375px–390px), iPhone Pro Max (430px).
* Touch-first cards for tables on `< md` screens (`md:hidden`) with full desktop tables preserved on `>= md` (`hidden md:block`).
* Fixed bottom action bar, gesture-friendly quick add FAB, and collapsable floating task drawer.

---

## 🔒 Security & Privacy

* **Strict Role-Based Access Control (RBAC)**: Fine-grained permissions (`owner_admin`, `sales_manager`, `sales_rep`, `finance`, `read_only`).
* **Cryptographic Token Sealing**: Ed25519 asymmetric access tokens with rotation-safe HMAC edge proxy authorization.
* **Audit Trail**: Every creation, modification, status progression, and soft deletion is immutably logged in the Audit repository.
* **Zero Secrets in Repository**: All environment variables and production keys are isolated via Secret Manager / Wrangler Secrets.

---

## 📄 License

SaleSphere CRM is proprietary commercial software. Unauthorized copying, modification, distribution, or reproduction of any portion of this repository is strictly prohibited without explicit written permission.
