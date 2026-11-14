# Project Brief — SaleSphere CRM

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-13 | Product owner | Initial brief (name only: "S2P") |
| 1.0 | 2026-11-13 | Claude (techno-functional consultant) | Refined from source solution design + discovery round 1 (defaults accepted) |

> Primary source: [`00-source/SaleSphere-Solution-Design.md`](00-source/SaleSphere-Solution-Design.md). Where this brief and the source differ, this brief reflects the agreed MVP scope.

## 1. Project
- **Name:** SaleSphere CRM *(A-001: replaces working name "S2P")*
- **One-line idea:** A configurable, resellable lead-to-cash CRM — Lead → Quotation → Order → Invoice (with UPI QR) → Payment, with a Customer 360 view — installed fresh and isolated for each client, on desktop web and as an installable mobile PWA.
- **Organisation / client:** Product owner (independent developer) who installs and supports SaleSphere for paying client businesses.
- **Industry / domain:** Industry-agnostic; target market is **Indian SMBs and freelancers**.

## 2. Problem & goals
- **Problem:** SMBs and freelancers get enquiries from Google Sheets, ad forms, websites and WhatsApp, but leads are missed or followed up late; quotes and invoices are built by hand in Word/Excel; payment follow-up is manual; nobody has one view of what a customer has ordered, owes and has paid.
- **For whom:** Business owners, sales executives working from their phones, accounts staff, and solo freelancers who do all of these jobs.
- **Why now:** UPI makes instant, exact-amount collection possible if the invoice carries the right QR; WhatsApp is the default business channel; generic CRMs are too expensive, too complex, or don't handle Indian GST/UPI.
- **Business goals:**
  1. Product owner: a single codebase that can be installed for a new client in ≤ 1 day, with no code fork per client.
  2. Clients: no lost leads, faster first contact, faster quote-to-cash, lower days-sales-outstanding (DSO).
- **KPIs (Q-001 default):**

| KPI | Target |
|---|---|
| Google Sheet leads imported | 100 %, within 5 min of the row appearing |
| Leads contacted within SLA (default 15 min) | ≥ 80 % |
| Time to create and send a quotation | < 5 min |
| Time to issue an invoice with UPI QR | < 1 min from order |
| Client installs live | 5 within 6 months of MVP release |
| New-client install effort | ≤ 1 working day |

## 3. Users

| User type / role | What they need to do | Approx. number per install |
|---|---|---|
| Owner / Admin | Configure the install, masters, users; see dashboards and money position | 1–2 |
| Sales Manager | Assign/oversee leads, approve discounts, track team pipeline | 0–3 |
| Sales Executive (mobile-first) | Call/WhatsApp/email leads, log outcomes, build quotes, record payments | 1–15 |
| Accounts / Finance | Invoices, payments, receipts, ledgers, GST summary | 0–3 |
| Project / Operations Manager | Run orders and delivery | 0–3 |
| Viewer / Auditor | Read-only access | 0–2 |
| Freelancer (Solo mode) | All of the above as one person | 1 |
| End customer (external) | View/accept quote via secure link; pay invoice via UPI QR | many |
| Product owner (installer/support) | Provision, deploy, upgrade; app login only with client consent | 1 |

**Scale (Q-003 default):** 1–25 users, ≤ 2,000 leads/month, ≤ 500 invoices/month per install.
**Solo / Team mode (Q-004 default):** config switch; Solo hides teams, assignment rules and approvals — same data model.

## 4. Scope

### Must have — MVP (Q-005 – Q-007 defaults)
1. **Install & config:** `clients/<id>/config.json`, provisioning script, per-client branding, terminology, number series, tax mode, Solo/Team mode.
2. **Auth & users:** built-in username/password login (Argon2id, JWT + revocable refresh), lockout, forced password change, user/role admin, 6 default roles, audit log.
3. **Masters:** company, branches/GSTINs, banks, UPI IDs, financial year, branding/footer, products/services, units, tax rates, payment terms, payment modes, number series, T&C, message templates, lead sources, single pipeline stages, lost reasons, call outcomes, territories, tags, customer groups/types, states (GST codes). Excel import.
4. **Leads:** sources = Google Sheet sync, manual, CSV import, website form/webhook; dedupe on phone (E.164) + email; auto-assignment (round-robin, territory, load); list + Kanban; activity timeline; follow-up reminders; convert to customer.
5. **Google Sheet sync:** connect, map columns, near-real-time (Apps Script webhook) or 1–5 min polling, write-back, import-error queue, sync log.
6. **One-tap actions:** Call (with outcome sheet), WhatsApp (click-to-chat `wa.me` with templates), Email (via client's Gmail), Directions.
7. **Quotations:** line items from master, discounts, GST/HSN, versions R0/R1…, approval above discount threshold, PDF, secure expiring link with Accept / Request changes / Reject and view tracking, convert to order/proforma.
8. **Sales orders:** items, status lifecycle, link to quotation, invoiced vs pending.
9. **Invoices:** Tax Invoice, Bill of Supply (non-GST), Proforma, Credit Note; from order (full/selected items); CGST+SGST vs IGST by place of supply; branded A4 PDF; UPI QR with exact balance due; PAID stamp.
10. **Payments:** record (UPI, bank transfer, cash, cheque, card), UTR + optional screenshot, TDS deducted, oldest-first / manual allocation, on-account advances, receipt PDF.
11. **Customer 360:** header + action buttons, KPI tiles, tabs: Overview, Orders, Quotations, Invoices (ageing), Payments, Ledger/Statement, Activities, Contacts, Documents.
12. **Files:** Google Drive folder tree, uploads via API, private files, signed expiring customer links.
13. **App experience:** responsive desktop + installable PWA, bottom tabs, quick-add, swipe actions, global search, home dashboard, push notifications (lead assigned, follow-up due, quote viewed), offline read cache + queued notes/call outcomes, dark mode.
14. **Basic reports:** pipeline by stage, sales, collections/ageing, source performance; Excel export.

### Later / nice to have
- **Phase 2:** project orders with milestones/billing schedule, multiple pipelines, custom fields, multi-currency, recurring invoices, debit notes, delivery challans, cheque lifecycle, quote e-signature, WhatsApp Business API adapter (Meta Cloud API first; client-configured and client-paid), payment-gateway adapters, bank-statement import & auto-match, email open/click tracking, automated payment reminders, report builder, customer portal, Meta Lead Ads / IndiaMART / JustDial / TradeIndia / missed-call adapters, Hindi UI.
- **Phase 3:** intelligent features (lead score, speed-to-lead escalation, next-best-action, AI notes and drafts, forecasts, payment prediction, collections assistant, health score, Ask-your-CRM, anomaly alerts, daily briefing), e-invoice (IRN) / e-way bill, Tally / Zoho Books export, VAT/TCS.
- **Phase 4:** one-command install, release dashboard, industry template library, Play Store / App Store apps (Capacitor; Android call-log).

### Explicitly out of scope
- Multi-tenant SaaS (one shared database for many clients).
- Accounting general ledger / books of accounts (export only).
- Inventory / stock management, purchase orders, payroll.
- Holding or moving customer money (SaleSphere shows QR / links; money goes directly to the client's account).

## 5. Current process
- Leads arrive in Google Sheets (from ad tools/forms), WhatsApp and phone calls; tracked in sheets or not at all.
- Quotes/invoices made in Word/Excel/Tally; sent as PDFs on WhatsApp; UPI ID typed by hand, so customers pay wrong amounts or forget.
- **Pain points:** slow first response, duplicate and lost leads, no follow-up discipline, manual payment matching, outstanding unknown until month-end.

## 6. Integrations & data

| System | MVP? | Notes |
|---|---|---|
| Google Sheets | Yes | Lead import + optional write-back |
| Google Drive (free Gmail account) | Yes | Files and PDFs; `drive.file` scope |
| Gmail (free account) | Yes | Outgoing email via Gmail API; ~500/day limit |
| WhatsApp | Click-to-chat in MVP | Business API = optional pluggable adapter, Phase 2, client-configured and client-paid |
| UPI | Yes | NPCI deep-link QR; manual UTR reconciliation |
| Payment gateway | No | Phase 2+ adapter |
| Web push (FCM / Web Push) | Yes | Notifications |
| GSTIN lookup, e-invoice, Tally | No | Phase 3 |

- **Data migration:** optional Excel import of customers, products and open leads at install.

## 7. Constraints
- **Compliance / regulation:** GST (CGST/SGST/IGST, HSN/SAC, Bill of Supply for unregistered suppliers); TDS recording; **DPDP Act 2023** — data in India (`asia-south1`), lead source/consent captured, export and erase on request, audit log, support access only with client consent; NPCI UPI deep-link format.
- **Platforms:** desktop web + installable mobile PWA (one codebase); native store apps Phase 4.
- **Languages / regions:** English UI in MVP; message templates in any language; India-first (INR, Lakh/Crore, DD-MM-YYYY, Indian FY Apr–Mar).
- **Preferred tech / hosting (Q-015 default — overrides CLAUDE.md §3, ADRs required):** React + TypeScript + Vite PWA, Tailwind + shadcn/ui on **Cloudflare Pages**; **Cloud Functions for Firebase** (2nd gen, Node.js) API; **Cloud Firestore** (`asia-south1`); built-in auth (no Firebase Auth); **Google Drive** for files; Secret Manager; Cloud Scheduler; GitHub Actions; one Git repo with `clients/<id>/` config.
- **NFRs (Q-013 default):** 99.5 % availability target; offline read cache + queued notes/call outcomes (payments/invoices need connectivity); WCAG 2.2 AA.
- **Budget / timeline (Q-014 default):** built by the product owner with Claude Code; MVP ≈ 10 weeks; infra cost per client ≈ free tiers + Firebase Blaze usage (budget alert at install). Pilot client: not yet identified (Q-016).

## 8. Look & feel
- **Brand:** SaleSphere default theme — primary blue (`#2563EB` as in source PDF), Inter typeface, light and dark modes; every client overrides logo, colours, app name, icon and splash.
- **Tone:** plain, friendly, action-first ("Call now", "Send quote", "Record payment").
- **References:** native-feeling mobile patterns (bottom tabs, swipe actions, bottom sheets); desktop split view and Cmd/Ctrl + K search.

## 9. Risks & notes
- **R-001 Free Gmail OAuth:** the client's OAuth consent screen must be set to *In production* (in *Testing*, refresh tokens expire after 7 days); request minimal scopes (`drive.file`, `gmail.send`, Sheets); admin sees a one-time "unverified app" warning. Add to install runbook.
- **R-002 Storage:** free Google account = 15 GB shared across Drive/Gmail/Photos; heavy clients may need Google One.
- **R-003 Gmail send limit:** ~500 emails/day on free Gmail; bulk email not an MVP feature.
- **R-004 Built-in auth:** owning password storage, lockout and sessions is a security responsibility; requires security review before go-live.
- **R-005 UPI to personal VPAs:** freelancers using personal UPI IDs may hit bank/NPCI limits on business collections — advise a business/merchant VPA.
