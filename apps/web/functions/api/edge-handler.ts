/**
 * SaleSphere Edge API Handler
 * High-performance edge router with Cloudflare D1 durable persistence and in-memory fallback.
 */
import { renderDocumentHtml, DEFAULT_HOPEPITOME_COMPANY, type DocInput, amountInWords, upiQrSvg } from '@ss/doc-templates';

export interface D1DatabaseLike {
  prepare(query: string): {
    bind(...params: any[]): {
      all<T = any>(): Promise<{ results: T[]; success: boolean }>;
      first<T = any>(col?: string): Promise<T | null>;
      run(): Promise<{ success: boolean; meta?: any }>;
    };
  };
  batch(statements: any[]): Promise<any[]>;
}

// Global fallback in-memory store in case D1 binding is unavailable
const memoryStore = {
  leads: [
    {
      id: 'lead-1',
      name: 'Sharma Textiles',
      company: 'Sharma Textiles Ltd',
      phone: '+91 98450 11108',
      email: 'contact@sharmatextiles.in',
      city: 'Kochi',
      stage: 'new',
      slaStatus: 'met',
      expectedValue: 35000000,
      createdAt: '2026-11-20T10:00:00Z',
      version: 1,
    },
    {
      id: 'lead-2',
      name: 'Iyer Consultancy',
      company: 'Iyer Consultancy LLP',
      phone: '+91 94480 98765',
      email: 'rajesh@iyerconsulting.com',
      city: 'Bengaluru',
      stage: 'contacted',
      slaStatus: 'met',
      expectedValue: 24000000,
      createdAt: '2026-11-18T14:30:00Z',
      version: 1,
    },
    {
      id: 'lead-3',
      name: 'Nair Foods',
      company: 'Nair Foods International',
      phone: '+91 98200 55443',
      email: 'mohan@nairfoods.in',
      city: 'Navi Mumbai',
      stage: 'interested',
      slaStatus: 'met',
      expectedValue: 18000000,
      createdAt: '2026-11-15T09:15:00Z',
      version: 1,
    },
  ],
  customers: [
    {
      id: 'cust-1',
      code: 'C-0001',
      displayName: 'Sharma Textiles',
      legalName: 'Sharma Textiles Private Limited',
      gstin: '27AABCD1234F1Z5',
      phone: '+91 98450 11108',
      email: 'contact@sharmatextiles.in',
      address: 'Kochi, Kerala, India',
      city: 'Kochi',
      state: 'Kerala',
      contacts: [{ id: 'cnt-1', name: 'Ramesh Sharma', role: 'Director', phone: '+91 98450 11108', email: 'ramesh@sharmatextiles.in', isPrimary: true }],
      addresses: [{ line1: 'MG Road, Ernakulam', city: 'Kochi' }],
    },
    {
      id: 'cust-2',
      code: 'C-0002',
      displayName: 'Iyer Consultancy',
      legalName: 'Iyer Consulting Services LLP',
      gstin: '29AAACI9876Q1Z2',
      phone: '+91 94480 98765',
      email: 'rajesh@iyerconsulting.com',
      address: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      contacts: [{ id: 'cnt-2', name: 'Rajesh Iyer', role: 'Managing Partner', phone: '+91 94480 98765', email: 'rajesh@iyerconsulting.com', isPrimary: true }],
      addresses: [{ line1: 'Outer Ring Road', city: 'Bengaluru' }],
    },
  ],
  quotes: [
    {
      id: 'qt-1',
      displayNumber: 'QT/26-27/0001',
      partyType: 'customer',
      partyId: 'cust-1',
      partyName: 'Sharma Textiles',
      status: 'accepted',
      date: '2026-11-14',
      validUntil: '2026-11-29',
      totals: { grandTotal: 2950000, subTotal: 2500000, taxable: 2500000, cgst: 225000, sgst: 225000, igst: 0, roundOff: 0, discountTotal: 0, inWords: 'Twenty nine lakh fifty thousand rupees only', maxDiscountPct: 0 },
      lines: [{ id: 'ln-1', kind: 'item', description: 'Enterprise CRM Implementation', qty: 1, rate: 2500000, amount: 2500000, taxRatePct: 18 }],
      pdf: { status: 'ready' },
      revisions: [],
    },
  ],
  orders: [
    {
      id: 'ord-1',
      number: 'SO/26-27/0001',
      customerId: 'cust-1',
      customerName: 'Sharma Textiles',
      quoteId: 'qt-1',
      status: 'confirmed',
      date: '2026-11-15',
      expectedDelivery: '2026-12-15',
      totals: { grandTotal: 2950000 },
      lines: [{ id: 'oln-1', kind: 'item', description: 'Enterprise CRM Implementation', qty: 1, unit: 'service', invoicedQty: 1, pendingQty: 0 }],
      invoices: [{ id: 'inv-1', number: 'INV/26-27/0001', type: 'tax_invoice', status: 'paid', grandTotal: 2950000, balanceDue: 0 }],
    },
  ],
  invoices: [
    {
      id: 'inv-1',
      number: 'INV/26-27/0001',
      customerId: 'cust-1',
      customerName: 'Sharma Textiles',
      orderId: 'ord-1',
      type: 'tax_invoice',
      status: 'paid',
      date: '2026-11-15',
      dueDate: '2026-11-30',
      paid: 2950000,
      credited: 0,
      balanceDue: 0,
      totals: { grandTotal: 2950000, subTotal: 2500000, taxable: 2500000, cgst: 225000, sgst: 225000, igst: 0, roundOff: 0, discountTotal: 0, inWords: 'Twenty nine lakh fifty thousand rupees only' },
      lines: [{ id: 'ln-1', kind: 'item', description: 'Enterprise CRM Implementation', qty: 1, rate: 2500000, amount: 2500000, taxRatePct: 18 }],
      pdf: { status: 'ready' },
      creditNotes: [],
      allocations: [{ paymentId: 'pay-1', amount: 2950000 }],
    },
  ],
  payments: [
    {
      id: 'pay-1',
      receiptNo: 'RCT/26-27/0001',
      customerId: 'cust-1',
      customerName: 'Sharma Textiles',
      date: '2026-11-15',
      amount: 2950000,
      tdsAmount: 0,
      mode: 'neft',
      reference: 'NEFT98234710',
      status: 'active',
      allocations: [{ invoiceId: 'inv-1', number: 'INV/26-27/0001', amount: 2950000 }],
      advance: 0,
    },
  ],
  notifications: [
    {
      id: 'notif-1',
      title: 'Payment Recorded',
      message: 'Payment of ₹29,500 recorded for Sharma Textiles against INV/26-27/0001.',
      read: false,
      link: '/sales/payments/pay-1',
      createdAt: '2026-11-15T12:05:00Z',
    },
    {
      id: 'notif-2',
      title: 'Quotation Accepted',
      message: 'Quotation QT/26-27/0001 was accepted by Sharma Textiles.',
      read: true,
      link: '/sales/quotes/qt-1',
      createdAt: '2026-11-14T15:30:00Z',
    },
  ],
  auditLog: [
    {
      id: 'aud-1',
      at: '2026-11-23T10:00:00Z',
      userName: 'Owner Admin',
      action: 'auth.login',
      recordType: 'user',
      recordId: 'u_admin',
      changes: [],
      ipMasked: '127.0.0.1',
    },
  ],
  company: {
    ...DEFAULT_HOPEPITOME_COMPANY,
    tradeName: 'HopEpitome',
    pan: 'ABCDE1234F',
    gstRegistered: true,
  },
};

function jsonRes(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...extraHeaders,
    },
  });
}

function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5);
}

const SOURCE_LABELS: Record<string, string> = {
  'src-1': 'Website Inbound',
  'src-2': 'Referral',
  'src-3': 'Google Ads',
  'src-4': 'Direct Call',
  'src-5': 'LinkedIn',
  website: 'Website Inbound',
  referral: 'Referral',
  google_ads: 'Google Ads',
  direct: 'Direct Call',
  cold_call: 'Cold Outreach',
  linkedin: 'LinkedIn',
  field: 'Field Sales',
  exhibition: 'Trade Show / Expo',
};

const PRODUCT_LABELS: Record<string, string> = {
  'prod-1': 'CRM Enterprise License (Annual)',
  'prod-2': 'Implementation & Data Migration',
  'prod-3': 'Custom Integration Pack',
  'prod-4': 'Dedicated Support Retainer (Monthly)',
};

function getSourceLabel(id?: string | null): string {
  if (!id) return 'Direct Inbound';
  return SOURCE_LABELS[id] || id;
}

function getProductLabel(id?: string | null): string {
  if (!id) return 'Enterprise Suite';
  return PRODUCT_LABELS[id] || id;
}

function calculateLinesAndTotals(
  submittedLines: any[],
  placeOfSupply = '29',
  companyState = '29',
  gstRegistered = true,
  overallDiscountPct = 0
) {
  const isIntraState = placeOfSupply === companyState;
  const processedLines: any[] = [];
  let subTotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  for (let i = 0; i < (submittedLines || []).length; i++) {
    const l = submittedLines[i];
    if (l.kind === 'heading') {
      processedLines.push({
        id: l.id || `ln-${Date.now()}-${i}`,
        kind: 'heading',
        description: l.description || '',
        qty: 0,
        rate: 0,
        amount: 0,
        total: 0,
      });
      continue;
    }

    const qty = Number(l.qty) || 0;
    const rate = Number(l.rate) || 0;
    const discountPct = Number(l.discountPct) || 0;
    const taxRatePct = Number(l.taxRatePct) || 18;

    const gross = roundHalfUp(qty * rate);
    const lineDiscount = discountPct > 0 ? roundHalfUp((gross * discountPct) / 100) : 0;
    const taxable = gross - lineDiscount;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (gstRegistered && taxRatePct > 0) {
      if (isIntraState) {
        cgst = roundHalfUp((taxable * taxRatePct) / 200);
        sgst = cgst;
      } else {
        igst = roundHalfUp((taxable * taxRatePct) / 100);
      }
    }

    const total = taxable + cgst + sgst + igst;

    subTotal += gross;
    discountTotal += lineDiscount;
    taxableTotal += taxable;
    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;

    processedLines.push({
      id: l.id || `ln-${Date.now()}-${i}`,
      kind: 'item',
      productId: l.productId || null,
      description: l.description || '',
      qty,
      unit: l.unit || 'Nos',
      rate,
      discountPct: discountPct || null,
      taxRatePct,
      hsnSac: l.hsnSac || null,
      amount: taxable,
      total,
      invoicedQty: l.invoicedQty || 0,
      pendingQty: l.pendingQty !== undefined ? l.pendingQty : qty,
    });
  }

  const beforeRound = taxableTotal + cgstTotal + sgstTotal + igstTotal;
  const roundOff = roundHalfUp(beforeRound / 100) * 100 - beforeRound;
  const grandTotal = beforeRound + roundOff;

  return {
    lines: processedLines,
    totals: {
      subTotal,
      discountTotal,
      taxable: taxableTotal,
      cgst: cgstTotal,
      sgst: sgstTotal,
      igst: igstTotal,
      roundOff,
      grandTotal,
      inWords: `${(grandTotal / 100).toLocaleString('en-IN')} rupees only`,
    },
  };
}

async function getNextCustomerCode(db?: D1DatabaseLike): Promise<string> {
  let maxSeq = 2; // base C-0001, C-0002
  if (db) {
    try {
      const { results } = await db.prepare("SELECT code FROM customers WHERE code LIKE 'C-%' AND deleted_at IS NULL").all();
      for (const r of (results || [])) {
        const m = ((r as any).code || '').match(/^C-(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxSeq && n < 9000) maxSeq = n;
        }
      }
    } catch (e) {
      console.error('Error fetching customer code:', e);
    }
  }
  for (const c of memoryStore.customers) {
    const m = (c.code || '').match(/^C-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxSeq && n < 9000) maxSeq = n;
    }
  }
  return `C-${String(maxSeq + 1).padStart(4, '0')}`;
}

async function getNextDocNumber(db: D1DatabaseLike | undefined, table: string, col: string, prefix: string): Promise<string> {
  let maxSeq = 1;
  if (db) {
    try {
      const { results } = await db.prepare(`SELECT ${col} as num FROM ${table} WHERE ${col} LIKE ? AND deleted_at IS NULL`).bind(`${prefix}%`).all();
      for (const r of (results || [])) {
        const m = ((r as any).num || '').match(/(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxSeq) maxSeq = n;
        }
      }
    } catch (e) {
      console.error(`Error querying max ${prefix}:`, e);
    }
  }
  const storeItems = table === 'quotes' ? memoryStore.quotes : (table === 'orders' ? memoryStore.orders : memoryStore.invoices);
  for (const it of storeItems) {
    const num = (it as any).displayNumber || (it as any).number || '';
    if (num.startsWith(prefix)) {
      const m = num.match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxSeq) maxSeq = n;
      }
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

export async function handleEdgeApi(request: Request, db?: D1DatabaseLike): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/v1/, '').replace(/^\/api/, '');
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  // 1. /app-config
  if (path === '/app-config' || path === '/app-config/') {
    return jsonRes({
      clientName: 'CRMH',
      mode: 'solo',
      modules: { orders: true, leads: true, customers: true, quotes: true, invoices: true, payments: true, sheetSync: true, webForm: true },
      terms: {
        lead: 'Lead',
        leads: 'Leads',
        customer: 'Customer',
        customers: 'Customers',
        quotation: 'Quotation',
        quotations: 'Quotations',
      },
      sla: { minutes: 15, calendar: { start: '09:00', end: '19:00', days: [1, 2, 3, 4, 5, 6] } },
      branding: { name: 'SaleSphere', logoUrl: null, primaryColor: '#3D7952' },
      gstRegistered: true,
      stateCode: '29',
    });
  }

  // 2. /auth/refresh & /auth/login
  if (path.startsWith('/auth/refresh') || path.startsWith('/auth/login')) {
    const user = {
      id: 'u_admin',
      username: 'admin',
      fullName: 'Owner Admin',
      role: 'admin',
      roleLabel: 'Owner / Administrator',
      status: 'active',
      mustChangePassword: false,
      mfaEnabled: false,
    };
    return jsonRes({
      accessToken: 'edge_session_' + Date.now(),
      user,
      mode: 'solo',
    });
  }

  // 3. /me
  if (path === '/me' || path === '/me/') {
    const user = {
      id: 'u_admin',
      username: 'admin',
      fullName: 'Owner Admin',
      role: 'admin',
      roleLabel: 'Owner / Administrator',
      status: 'active',
      isSupport: false,
      mustChangePassword: false,
      mfaEnabled: false,
    };
    return jsonRes({
      ...user,
      user,
      mode: 'solo',
      permissions: { execPayments: true },
    });
  }

  // /me/login-history
  if (path === '/me/login-history' || path === '/me/login-history/') {
    return jsonRes({
      items: [
        { at: new Date().toISOString(), action: 'auth.login', ipMasked: '103.21.244.x' },
        { at: new Date(Date.now() - 86400000).toISOString(), action: 'auth.login', ipMasked: '103.21.244.x' },
      ],
    });
  }

  // /me/notification-prefs
  if (path === '/me/notification-prefs' || path === '/me/notification-prefs/') {
    return jsonRes({
      emailAlerts: true,
      whatsappAlerts: true,
      dailyDigest: true,
      assignmentAlerts: true,
    });
  }

  // 4. /leads
  if (path === '/leads' || path === '/leads/') {
    if (method === 'GET') {
      const q = (url.searchParams.get('q') || '').toLowerCase().trim();
      if (db) {
        try {
          let query = `
            SELECT l.*,
              (SELECT MIN(due_at) FROM follow_ups WHERE record_type = 'lead' AND record_id = l.id AND status = 'pending') AS next_follow_up_at
            FROM leads l
            WHERE l.deleted_at IS NULL
            ORDER BY l.created_at DESC
          `;
          let params: any[] = [];
          if (q) {
            query = `
              SELECT l.*,
                (SELECT MIN(due_at) FROM follow_ups WHERE record_type = 'lead' AND record_id = l.id AND status = 'pending') AS next_follow_up_at
              FROM leads l
              WHERE l.deleted_at IS NULL AND (LOWER(l.name) LIKE ? OR LOWER(l.company) LIKE ? OR l.phone LIKE ? OR LOWER(l.email) LIKE ?)
              ORDER BY l.created_at DESC
            `;
            const like = `%${q}%`;
            params = [like, like, like, like];
          }
          const { results } = await db.prepare(query).bind(...params).all();
          const { results: masterRows } = await db.prepare("SELECT id, type, name FROM masters WHERE type IN ('leadSources', 'products')").all();
          const mMap: Record<string, string> = {};
          for (const m of masterRows || []) mMap[`${(m as any).type}:${(m as any).id}`] = (m as any).name;
          const items = (results || []).map((r: any) => {
            let extra: any = {};
            try { extra = r.data_json ? JSON.parse(r.data_json) : {}; } catch {}
            return {
              id: r.id,
              name: r.name,
              company: r.company,
              phone: r.phone,
              email: r.email,
              city: r.city,
              pincode: r.pincode,
              sourceId: r.source_id,
              sourceLabel: (r.source_id && mMap[`leadSources:${r.source_id}`]) || getSourceLabel(r.source_id),
              interestProductId: r.interest_product_id,
              productLabel: (r.interest_product_id && mMap[`products:${r.interest_product_id}`]) || getProductLabel(r.interest_product_id),
              stage: r.stage,
              slaStatus: r.sla_status,
              slaDueAt: r.sla_due_at,
              nextFollowUpAt: r.next_follow_up_at || null,
              expectedValue: r.expected_value,
              notes: r.notes,
              territoryId: extra.territoryId || null,
              tags: Array.isArray(extra.tags) ? extra.tags : [],
              customerId: r.customer_id,
              createdAt: r.created_at,
              version: r.version,
            };
          });
          return jsonRes({ items, nextCursor: null });
        } catch (e) {
          console.error('D1 leads fetch error:', e);
        }
      }

      // Memory fallback
      let filtered = memoryStore.leads;
      if (q) {
        filtered = filtered.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            (l.company && l.company.toLowerCase().includes(q)) ||
            (l.phone && l.phone.includes(q)) ||
            (l.email && l.email.toLowerCase().includes(q))
        );
      }
      return jsonRes({ items: filtered, nextCursor: null });
    }

    if (method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;

      // VALIDATION (Requirement 3)
      const name = (body.name || '').trim();
      const phone = (body.phone || '').trim();
      const email = (body.email || '').trim();
      const errors: Record<string, string> = {};

      if (!name || name.length < 2) {
        errors.name = 'Lead name is required (at least 2 characters).';
      }
      if (!phone && !email) {
        errors.phone = 'Either phone number or email is required.';
        errors.email = 'Either phone number or email is required.';
      }

      if (Object.keys(errors).length > 0) {
        return jsonRes({
          type: 'https://salesphere.live/errors/validation',
          title: 'Validation error',
          status: 422,
          errors,
        }, 422);
      }

      const id = 'lead-' + Date.now();
      const pincode = (body.pincode || '').trim() || null;
      const sourceId = (body.sourceId || body.source_id || '').trim() || null;
      const interestProductId = (body.interestProductId || body.interest_product_id || '').trim() || null;

      const newLead = {
        id,
        name,
        company: (body.company || '').trim() || null,
        phone: phone || null,
        email: email || null,
        city: (body.city || '').trim() || null,
        pincode,
        sourceId,
        source_id: sourceId,
        sourceLabel: getSourceLabel(sourceId),
        interestProductId,
        interest_product_id: interestProductId,
        productLabel: getProductLabel(interestProductId),
        stage: body.stage || 'new',
        slaStatus: 'pending',
        slaDueAt: new Date(Date.now() + 15 * 60000).toISOString(),
        expectedValue: Number(body.expectedValue) || null,
        notes: body.notes || null,
        createdAt: new Date().toISOString(),
        version: 1,
      };

      if (db) {
        try {
          await db.prepare(`
            INSERT INTO leads (id, name, company, phone, email, city, pincode, source_id, interest_product_id, stage, sla_status, sla_due_at, expected_value, notes, data_json, created_at, updated_at, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            newLead.id,
            newLead.name,
            newLead.company,
            newLead.phone,
            newLead.email,
            newLead.city,
            pincode,
            sourceId,
            interestProductId,
            newLead.stage,
            newLead.slaStatus,
            newLead.slaDueAt,
            newLead.expectedValue,
            newLead.notes,
            JSON.stringify({
              pincode,
              sourceId,
              interestProductId,
              territoryId: body.territoryId || null,
              tags: Array.isArray(body.tags) ? body.tags : [],
            }),
            newLead.createdAt,
            newLead.createdAt,
            newLead.version
          ).run();

          // Audit entry
          await db.prepare(`
            INSERT INTO audit_log (id, at, user_name, action, record_type, record_id, changes_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind('aud-' + Date.now(), new Date().toISOString(), 'Owner Admin', 'lead.create', 'lead', newLead.id, JSON.stringify(newLead)).run();
        } catch (e) {
          console.error('D1 lead insert error:', e);
        }
      }

      memoryStore.leads.unshift(newLead);
      return jsonRes({ outcome: 'created', lead: newLead, id: newLead.id }, 201);
    }
  }

  // /leads/board
  if (path === '/leads/board' || path === '/leads/board/') {
    let allLeads: any[] = [];
    if (db) {
      try {
        const { results } = await db.prepare('SELECT * FROM leads WHERE deleted_at IS NULL ORDER BY created_at DESC').all();
        allLeads = (results || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          company: r.company,
          phone: r.phone,
          email: r.email,
          city: r.city,
          stage: r.stage,
          slaStatus: r.sla_status,
          expectedValue: r.expected_value,
          createdAt: r.created_at,
        }));
      } catch (e) {
        allLeads = memoryStore.leads;
      }
    } else {
      allLeads = memoryStore.leads;
    }

    const stages = [
      { stage: 'new', label: 'New' },
      { stage: 'contacted', label: 'Contacted' },
      { stage: 'interested', label: 'Interested' },
      { stage: 'quotation_sent', label: 'Quotation Sent' },
      { stage: 'negotiation', label: 'Negotiation' },
      { stage: 'won', label: 'Won' },
      { stage: 'lost', label: 'Lost' },
    ];
    const columns = stages.map((s) => {
      const cards = allLeads.filter((l) => l.stage === s.stage);
      const value = cards.reduce((sum, c) => sum + Number(c.expectedValue || 0), 0);
      return {
        stage: s.stage,
        label: s.label,
        count: cards.length,
        value,
        cards,
      };
    });
    return jsonRes({ columns });
  }

  // /leads/check-duplicate
  if (path === '/leads/check-duplicate') {
    return jsonRes({ matches: [] });
  }

  // /leads/bulk
  if (path === '/leads/bulk') {
    const body = (await request.json().catch(() => ({}))) as any;
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    if (body.stage && ids.length) {
      if (db) {
        try {
          for (const id of ids) {
            await db.prepare('UPDATE leads SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(body.stage, id).run();
          }
        } catch (e) {
          console.error('D1 bulk update error:', e);
        }
      }
      memoryStore.leads.forEach((l) => {
        if (ids.includes(l.id)) l.stage = body.stage;
      });
    }
    return jsonRes({ ok: ids, skipped: [] });
  }

  // /leads/:id/stage (Requirement 1)
  const stageMatch = path.match(/^\/leads\/([^/?]+)\/stage$/);
  if (stageMatch && method === 'POST') {
    const leadId = stageMatch[1];
    const body = (await request.json().catch(() => ({}))) as any;
    const newStage = body.stage;
    const reasonId = body.reasonId || null;
    if (!newStage) {
      return jsonRes({ title: 'Missing stage', status: 422 }, 422);
    }

    let lead: any = null;
    if (db) {
      try {
        const { results } = await db.prepare('SELECT * FROM leads WHERE id = ? AND deleted_at IS NULL').bind(leadId).all();
        lead = results?.[0];
      } catch (e) {
        console.error('D1 fetch lead error:', e);
      }
    }
    if (!lead) lead = memoryStore.leads.find((l) => l.id === leadId);
    if (!lead) return jsonRes({ title: 'Lead not found', status: 404, code: 'NOT_FOUND' }, 404);

    const oldStage = lead.stage || 'new';
    // SLA stop condition: once Contacted, Won, Lost, or subsequent stages, SLA is met
    const stopSla = ['contacted', 'interested', 'quotation_sent', 'negotiation', 'won', 'lost', 'junk'].includes(newStage);
    const slaStatus = stopSla ? 'met' : (lead.sla_status || 'pending');

    if (db) {
      try {
        await db.prepare('UPDATE leads SET stage = ?, sla_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newStage, slaStatus, leadId).run();

        // Add timeline entry
        const actId = 'act-' + Date.now();
        const stageLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const summary = `Stage changed from ${stageLabel(oldStage)} to ${stageLabel(newStage)} by Owner Admin`;
        const details = reasonId ? `Reason: ${reasonId}` : (body.note || null);
        await db.prepare(`
          INSERT INTO timeline (id, record_type, record_id, type, summary, details, user_name, created_at)
          VALUES (?, 'lead', ?, 'stage', ?, ?, 'Owner Admin', CURRENT_TIMESTAMP)
        `).bind(actId, leadId, summary, details).run();

        // Audit log
        await db.prepare(`
          INSERT INTO audit_log (id, at, user_name, action, record_type, record_id, changes_json)
          VALUES (?, ?, 'Owner Admin', 'lead.stage_change', 'lead', ?, ?)
        `).bind('aud-' + Date.now(), new Date().toISOString(), leadId, JSON.stringify({ from: oldStage, to: newStage, reason: reasonId })).run();
      } catch (e) {
        console.error('D1 stage update error:', e);
      }
    }

    lead.stage = newStage;
    lead.sla_status = slaStatus;
    lead.slaStatus = slaStatus;
    return jsonRes({ success: true, stage: newStage, lead });
  }

  // /leads/:id/convert (Requirement A)
  const convertMatch = path.match(/^\/leads\/([^/?]+)\/convert$/);
  if (convertMatch && method === 'POST') {
    const leadId = convertMatch[1];
    const body = (await request.json().catch(() => ({}))) as any;

    let lead: any = null;
    if (db) {
      try {
        const { results } = await db.prepare('SELECT * FROM leads WHERE id = ? AND deleted_at IS NULL').bind(leadId).all();
        lead = results?.[0];
      } catch (e) {
        console.error('D1 fetch lead for convert error:', e);
      }
    }
    if (!lead) {
      lead = memoryStore.leads.find((l) => l.id === leadId);
    }
    if (!lead) {
      return jsonRes({ title: 'Lead not found', status: 404, code: 'NOT_FOUND' }, 404);
    }

    // Prevent double conversion
    if (lead.stage === 'won' || lead.customer_id || lead.customerId) {
      const existingCustId = lead.customer_id || lead.customerId;
      return jsonRes({ customerId: existingCustId, outcome: 'already_converted' }, 200);
    }

    let customerId = body.customerId;
    if (!customerId || body.mode === 'create') {
      customerId = 'cust-' + Date.now();
      const code = await getNextCustomerCode(db);
      const displayName = (lead.company || '').trim() || lead.name || 'New Customer';
      const legalName = displayName;
      const phone = lead.phone || null;
      const email = lead.email || null;
      const city = lead.city || 'Bengaluru';
      const pincode = lead.pincode || null;
      const state = 'Karnataka';
      const address = city ? (pincode ? `${city} - ${pincode}, India` : `${city}, India`) : 'Bengaluru, India';
      const contacts = [{ id: 'cnt-' + Date.now(), name: lead.name || displayName, phone, email, isPrimary: true }];
      const addresses = [{ id: 'addr-' + Date.now(), line1: address, city, state, type: 'billing' }];

      const newCust = {
        id: customerId,
        code,
        displayName,
        legalName,
        gstin: null,
        phone,
        email,
        address,
        city,
        state,
        contacts,
        addresses,
      };

      if (db) {
        try {
          await db.prepare(`
            INSERT INTO customers (id, code, display_name, legal_name, gstin, phone, email, address, city, state, data_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            newCust.id,
            newCust.code,
            newCust.displayName,
            newCust.legalName,
            newCust.gstin,
            newCust.phone,
            newCust.email,
            newCust.address,
            newCust.city,
            newCust.state,
            JSON.stringify({
              contacts: newCust.contacts,
              addresses: newCust.addresses,
              territoryId: body.territoryId || null,
              customerGroupId: body.customerGroupId || null,
              tags: Array.isArray(body.tags) ? body.tags : [],
            }),
            new Date().toISOString(),
            new Date().toISOString()
          ).run();
        } catch (e) {
          console.error('D1 insert customer on convert error:', e);
        }
      }
      memoryStore.customers.unshift(newCust);
    }

    if (db) {
      try {
        await db.prepare(`
          UPDATE leads SET stage = 'won', customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).bind(customerId, leadId).run();

        await db.prepare(`
          UPDATE timeline SET record_type = 'customer', record_id = ? WHERE record_type = 'lead' AND record_id = ?
        `).bind(customerId, leadId).run();

        // Migrate follow-ups from lead to newly converted customer
        const custDisplayName = (lead.company || '').trim() || lead.name || 'Customer';
        await db.prepare(`
          UPDATE follow_ups
          SET record_type = 'customer', record_id = ?, party_name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE record_type = 'lead' AND record_id = ?
        `).bind(customerId, custDisplayName, leadId).run();

        // Also update any quotes issued to this lead to point to the newly converted customer
        await db.prepare(`
          UPDATE quotes
          SET party_id = ?, party_type = 'customer', party_name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE party_type = 'lead' AND party_id = ?
        `).bind(customerId, custDisplayName, leadId).run();

        await db.prepare(`
          INSERT INTO audit_log (id, at, user_name, action, record_type, record_id, changes_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind('aud-' + Date.now(), new Date().toISOString(), 'Owner Admin', 'lead.convert', 'lead', leadId, JSON.stringify({ customerId })).run();
      } catch (e) {
        console.error('D1 update lead on convert error:', e);
      }
    }

    const memL = memoryStore.leads.find((l) => l.id === leadId);
    if (memL) {
      memL.stage = 'won';
      memL.customerId = customerId;
    }

    return jsonRes({ customerId, outcome: 'converted' }, 200);
  }

  // /leads/:id
  const leadMatch = path.match(/^\/leads\/([^/?]+)/);
  if (leadMatch) {
    const id = leadMatch[1];

    if (method === 'GET') {
      if (db) {
        try {
          const { results: leadResults } = await db.prepare(`
            SELECT l.*,
              (SELECT MIN(due_at) FROM follow_ups WHERE record_type = 'lead' AND record_id = l.id AND status = 'pending') AS next_follow_up_at
            FROM leads l
            WHERE l.id = ? AND l.deleted_at IS NULL
          `).bind(id).all();
          const row: any = leadResults?.[0];
          if (row) {
            let extra: any = {};
            try { extra = row.data_json ? JSON.parse(row.data_json) : {}; } catch {}
            const { results: mRows } = await db.prepare("SELECT id, type, name FROM masters WHERE type IN ('leadSources', 'products', 'territories') AND id IN (?, ?, ?)").bind(row.source_id || '', row.interest_product_id || '', extra.territoryId || '').all();
            const mMap: Record<string, string> = {};
            for (const m of mRows || []) mMap[`${(m as any).type}:${(m as any).id}`] = (m as any).name;
            return jsonRes({
              id: row.id,
              name: row.name,
              company: row.company,
              phone: row.phone,
              email: row.email,
              city: row.city,
              pincode: row.pincode,
              sourceId: row.source_id,
              sourceLabel: (row.source_id && mMap[`leadSources:${row.source_id}`]) || getSourceLabel(row.source_id),
              interestProductId: row.interest_product_id,
              productLabel: (row.interest_product_id && mMap[`products:${row.interest_product_id}`]) || getProductLabel(row.interest_product_id),
              stage: row.stage,
              slaStatus: row.sla_status,
              slaDueAt: row.sla_due_at,
              nextFollowUpAt: row.next_follow_up_at || null,
              expectedValue: row.expected_value,
              notes: row.notes,
              territoryId: extra.territoryId || null,
              territoryLabel: (extra.territoryId && mMap[`territories:${extra.territoryId}`]) || null,
              tags: Array.isArray(extra.tags) ? extra.tags : [],
              customerId: row.customer_id,
              createdAt: row.created_at,
              version: row.version,
            });
          }
        } catch (e) {
          console.error('D1 lead get error:', e);
        }
      }
      const memLead = memoryStore.leads.find((l) => l.id === id);
      if (!memLead) return jsonRes({ title: 'Lead not found', status: 404, code: 'NOT_FOUND' }, 404);
      return jsonRes(memLead);
    }

    if (method === 'PATCH') {
      const body = (await request.json().catch(() => ({}))) as any;
      if (db) {
        try {
          const { results: pRows } = await db.prepare('SELECT * FROM leads WHERE id = ? AND deleted_at IS NULL').bind(id).all();
          const row: any = pRows?.[0];
          if (!row) return jsonRes({ title: 'Lead not found', status: 404, code: 'NOT_FOUND' }, 404);
          const name = body.name !== undefined ? body.name : row.name;
          const stage = body.stage !== undefined ? body.stage : row.stage;
          const expectedValue = body.expectedValue !== undefined ? Number(body.expectedValue) : row.expected_value;
          const pincode = body.pincode !== undefined ? body.pincode : row.pincode;
          const sourceId = body.sourceId !== undefined ? body.sourceId : (body.source_id !== undefined ? body.source_id : row.source_id);
          const interestProductId = body.interestProductId !== undefined ? body.interestProductId : (body.interest_product_id !== undefined ? body.interest_product_id : row.interest_product_id);

          let slaStatus = row.sla_status;
          if (stage !== row.stage) {
            if (['contacted', 'interested', 'quotation_sent', 'negotiation', 'won', 'lost', 'junk'].includes(stage)) {
              slaStatus = 'met';
            }
            const stageLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            const actId = 'act-' + Date.now();
            await db.prepare(`
              INSERT INTO timeline (id, record_type, record_id, type, summary, details, user_name, created_at)
              VALUES (?, 'lead', ?, 'stage', ?, ?, 'Owner Admin', CURRENT_TIMESTAMP)
            `).bind(actId, id, `Stage changed from ${stageLabel(row.stage || 'new')} to ${stageLabel(stage)} by Owner Admin`, null).run();
          }

          let existingData: any = {};
          try { existingData = row.data_json ? JSON.parse(row.data_json) : {}; } catch {}
          const territoryId = body.territoryId !== undefined ? body.territoryId : existingData.territoryId ?? null;
          const tags = body.tags !== undefined ? body.tags : existingData.tags ?? [];
          const nextDataJson = JSON.stringify({ ...existingData, pincode, sourceId, interestProductId, territoryId, tags });

          await db.prepare('UPDATE leads SET name = ?, stage = ?, sla_status = ?, expected_value = ?, pincode = ?, source_id = ?, interest_product_id = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(name, stage, slaStatus, expectedValue, pincode, sourceId, interestProductId, nextDataJson, id).run();
        } catch (e) {
          console.error('D1 lead patch error:', e);
        }
      }
      const memLead = memoryStore.leads.find((l) => l.id === id);
      if (memLead) Object.assign(memLead, body);
      return jsonRes(memLead || { id, ...body });
    }

    // DELETE (Requirement 2)
    if (method === 'DELETE') {
      if (db) {
        try {
          await db.prepare('UPDATE leads SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id).run();
          await db.prepare("DELETE FROM follow_ups WHERE record_type = 'lead' AND record_id = ?").bind(id).run();
          await db.prepare(`
            INSERT INTO audit_log (id, at, user_name, action, record_type, record_id, changes_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind('aud-' + Date.now(), new Date().toISOString(), 'Owner Admin', 'lead.delete', 'lead', id, JSON.stringify({ deleted: true })).run();
        } catch (e) {
          console.error('D1 lead delete error:', e);
        }
      }
      const idx = memoryStore.leads.findIndex((l) => l.id === id);
      if (idx !== -1) memoryStore.leads.splice(idx, 1);
      return jsonRes({ success: true, id });
    }
  }

  // 5. /customers
  if (path === '/customers' || path === '/customers/') {
    if (method === 'GET') {
      const q = (url.searchParams.get('q') || '').toLowerCase().trim();
      if (db) {
        try {
          let query = 'SELECT * FROM customers WHERE deleted_at IS NULL ORDER BY created_at DESC';
          let params: any[] = [];
          if (q) {
            query = 'SELECT * FROM customers WHERE deleted_at IS NULL AND (LOWER(display_name) LIKE ? OR LOWER(code) LIKE ? OR phone LIKE ? OR LOWER(email) LIKE ?) ORDER BY created_at DESC';
            const like = `%${q}%`;
            params = [like, like, like, like];
          }
          const { results } = await db.prepare(query).bind(...params).all();
          const items = (results || []).map((r: any) => {
            const data = r.data_json ? JSON.parse(r.data_json) : {};
            return {
              id: r.id,
              code: r.code,
              displayName: r.display_name,
              legalName: r.legal_name,
              gstin: r.gstin,
              phone: r.phone,
              email: r.email,
              address: r.address,
              city: r.city,
              state: r.state,
              contacts: data.contacts || [],
              addresses: data.addresses || [],
              territoryId: data.territoryId || null,
              customerGroupId: data.customerGroupId || null,
              tags: Array.isArray(data.tags) ? data.tags : [],
            };
          });
          return jsonRes({ items, nextCursor: null });
        } catch (e) {
          console.error('D1 customers fetch error:', e);
        }
      }

      let filtered = memoryStore.customers;
      if (q) {
        filtered = filtered.filter(
          (c) =>
            c.displayName.toLowerCase().includes(q) ||
            (c.code && c.code.toLowerCase().includes(q)) ||
            (c.phone && c.phone.includes(q)) ||
            (c.email && c.email.toLowerCase().includes(q))
        );
      }
      return jsonRes({ items: filtered, nextCursor: null });
    }

    if (method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;

      // VALIDATION (Requirement 3)
      const displayName = (body.displayName || '').trim();
      if (!displayName || displayName.length < 2) {
        return jsonRes({
          type: 'https://salesphere.live/errors/validation',
          title: 'Validation error',
          status: 422,
          errors: { displayName: 'Customer display name is required (at least 2 characters).' },
        }, 422);
      }

      const id = 'cust-' + Date.now();
      const code = await getNextCustomerCode(db);
      const newCust = {
        id,
        code,
        displayName,
        legalName: (body.legalName || '').trim() || displayName,
        gstin: (body.gstin || '').trim() || null,
        phone: body.contact?.phone || null,
        email: body.contact?.email || null,
        address: body.billing?.line1 ? `${body.billing.line1}, ${body.billing.city || ''}` : 'Bengaluru, India',
        city: body.billing?.city || 'Bengaluru',
        state: 'Karnataka',
        contacts: body.contact ? [{ id: 'cnt-' + Date.now(), ...body.contact, isPrimary: true }] : [],
        addresses: body.billing ? [body.billing] : [],
      };

      if (db) {
        try {
          await db.prepare(`
            INSERT INTO customers (id, code, display_name, legal_name, gstin, phone, email, address, city, state, data_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            newCust.id,
            newCust.code,
            newCust.displayName,
            newCust.legalName,
            newCust.gstin,
            newCust.phone,
            newCust.email,
            newCust.address,
            newCust.city,
            newCust.state,
            JSON.stringify({
              contacts: newCust.contacts,
              addresses: newCust.addresses,
              territoryId: body.territoryId || null,
              customerGroupId: body.customerGroupId || null,
              tags: Array.isArray(body.tags) ? body.tags : [],
            }),
            new Date().toISOString(),
            new Date().toISOString()
          ).run();

          await db.prepare(`
            INSERT INTO audit_log (id, at, user_name, action, record_type, record_id, changes_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind('aud-' + Date.now(), new Date().toISOString(), 'Owner Admin', 'customer.create', 'customer', newCust.id, JSON.stringify(newCust)).run();
        } catch (e) {
          console.error('D1 customer insert error:', e);
        }
      }

      memoryStore.customers.unshift(newCust);
      return jsonRes(newCust, 201);
    }
  }

  // /customers/:id (DELETE Requirement 2)
  const custMatch = path.match(/^\/customers\/([^/?]+)/);
  if (custMatch) {
    const id = custMatch[1];

    if (method === 'DELETE') {
      if (db) {
        try {
          await db.prepare('UPDATE customers SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id).run();
          await db.prepare("DELETE FROM follow_ups WHERE record_type = 'customer' AND record_id = ?").bind(id).run();
          await db.prepare(`
            INSERT INTO audit_log (id, at, user_name, action, record_type, record_id, changes_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind('aud-' + Date.now(), new Date().toISOString(), 'Owner Admin', 'customer.delete', 'customer', id, JSON.stringify({ deleted: true })).run();
        } catch (e) {
          console.error('D1 customer delete error:', e);
        }
      }
      const idx = memoryStore.customers.findIndex((c) => c.id === id);
      if (idx !== -1) memoryStore.customers.splice(idx, 1);
      return jsonRes({ success: true, id });
    }

    // /customers/:id/quotes
    if (path.endsWith('/quotes') || path.includes('/quotes?')) {
      let items: any[] = [];
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM quotes WHERE (party_id = ? OR party_name = ?) AND deleted_at IS NULL ORDER BY date DESC, created_at DESC').bind(id, id).all();
          if (results) {
            items = results.map((r: any) => ({
              id: r.id,
              displayNumber: r.display_number,
              partyType: r.party_type,
              partyId: r.party_id,
              partyName: r.party_name,
              status: r.status,
              date: r.date,
              validUntil: r.valid_until,
              grandTotal: r.grand_total,
              totals: { grandTotal: r.grand_total, subTotal: r.sub_total, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst },
            }));
          }
        } catch (e) {
          console.error('D1 cust quotes error:', e);
        }
      }
      return jsonRes({ items });
    }

    // /customers/:id/orders
    if (path.endsWith('/orders') || path.includes('/orders?')) {
      let items: any[] = [];
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM orders WHERE customer_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC').bind(id).all();
          if (results) {
            items = results.map((r: any) => ({
              id: r.id,
              number: r.number,
              customerId: r.customer_id,
              customerName: r.customer_name,
              quoteId: r.quote_id,
              status: r.status,
              date: r.date,
              expectedDelivery: r.expected_delivery,
              grandTotal: r.grand_total,
              totals: { grandTotal: r.grand_total },
            }));
          }
        } catch (e) {
          console.error('D1 cust orders error:', e);
        }
      }
      return jsonRes({ items });
    }

    // /customers/:id/invoices
    if (path.endsWith('/invoices') || path.includes('/invoices?')) {
      let items: any[] = [];
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM invoices WHERE customer_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC').bind(id).all();
          if (results) {
            items = results.map((r: any) => ({
              id: r.id,
              number: r.number,
              customerId: r.customer_id,
              customerName: r.customer_name,
              orderId: r.order_id,
              type: r.type,
              status: r.status,
              date: r.date,
              dueDate: r.due_date,
              grandTotal: r.grand_total,
              paidAmount: r.paid_amount,
              creditedAmount: r.credited_amount,
              balanceDue: r.balance_due,
              totals: { grandTotal: r.grand_total },
              ageing: r.status === 'paid' || (r.balance_due || 0) === 0 ? null : 'd1_30',
            }));
          }
        } catch (e) {
          console.error('D1 cust invoices error:', e);
        }
      }
      return jsonRes({ items });
    }

    // /customers/:id/payments
    if (path.endsWith('/payments') || path.includes('/payments?')) {
      let items: any[] = [];
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM payments WHERE customer_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC').bind(id).all();
          if (results) {
            items = results.map((r: any) => ({
              id: r.id,
              receiptNo: r.receipt_no,
              customerId: r.customer_id,
              customerName: r.customer_name,
              invoiceId: r.invoice_id,
              date: r.date,
              amount: r.amount,
              tdsAmount: r.tds_amount,
              mode: r.mode,
              reference: r.reference,
              status: r.status,
              advance: r.advance,
            }));
          }
        } catch (e) {
          console.error('D1 cust payments error:', e);
        }
      }
      return jsonRes({ items });
    }

    // /customers/:id/statement
    if (path.includes('/statement')) {
      const from = url.searchParams.get('from') || '2026-04-01';
      const to = url.searchParams.get('to') || '2026-11-30';
      const format = url.searchParams.get('format');

      if (format === 'pdf' || format === 'xlsx') {
        const jobId = `job-stmt-${id}-${format}-${Date.now()}`;
        return jsonRes({ jobId });
      }

      let opening = 0;
      let rows: any[] = [];
      let closing = 0;

      if (db) {
        try {
          // Prior transactions for opening balance
          const { results: priorInvs } = await db.prepare('SELECT grand_total FROM invoices WHERE customer_id = ? AND date < ? AND deleted_at IS NULL').bind(id, from).all();
          const priorDebit = (priorInvs || []).reduce((acc: number, r: any) => acc + Number(r.grand_total || 0), 0);

          const { results: priorPays } = await db.prepare("SELECT amount FROM payments WHERE customer_id = ? AND date < ? AND status = 'active' AND deleted_at IS NULL").bind(id, from).all();
          const priorCredit = (priorPays || []).reduce((acc: number, r: any) => acc + Number(r.amount || 0), 0);

          opening = Math.max(0, priorDebit - priorCredit);

          // Period transactions
          const { results: periodInvs } = await db.prepare('SELECT id, number, date, grand_total FROM invoices WHERE customer_id = ? AND date >= ? AND date <= ? AND deleted_at IS NULL ORDER BY date ASC, created_at ASC').bind(id, from, to).all();
          const { results: periodPays } = await db.prepare("SELECT id, receipt_no, date, amount FROM payments WHERE customer_id = ? AND date >= ? AND date <= ? AND status = 'active' AND deleted_at IS NULL ORDER BY date ASC, created_at ASC").bind(id, from, to).all();

          // Merge & sort chronologically
          const txs: any[] = [];
          (periodInvs || []).forEach((inv: any) => {
            txs.push({
              date: inv.date,
              kind: 'invoice',
              docNumber: inv.number,
              debit: Number(inv.grand_total || 0),
              credit: 0,
            });
          });
          (periodPays || []).forEach((pay: any) => {
            txs.push({
              date: pay.date,
              kind: 'payment',
              docNumber: pay.receipt_no,
              debit: 0,
              credit: Number(pay.amount || 0),
            });
          });

          txs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

          let running = opening;
          rows = txs.map((tx, idx) => {
            running = running + tx.debit - tx.credit;
            return {
              seq: idx + 1,
              date: tx.date,
              kind: tx.kind,
              docNumber: tx.docNumber,
              debit: tx.debit,
              credit: tx.credit,
              balance: running,
            };
          });
          closing = running;
        } catch (e) {
          console.error('D1 statement error:', e);
        }
      }

      return jsonRes({ opening, closing, rows });
    }

    if (path.includes('/360')) {
      let cust = memoryStore.customers.find((c) => c.id === id);
      if (db) {
        try {
          const row: any = await db.prepare('SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL').bind(id).first();
          if (row) {
            const data = row.data_json ? JSON.parse(row.data_json) : {};
            cust = {
              id: row.id,
              code: row.code,
              displayName: row.display_name,
              legalName: row.legal_name,
              gstin: row.gstin,
              phone: row.phone,
              email: row.email,
              address: row.address,
              city: row.city,
              state: row.state,
              contacts: data.contacts || [],
              addresses: data.addresses || [],
              territoryId: data.territoryId || null,
              customerGroupId: data.customerGroupId || null,
              tags: Array.isArray(data.tags) ? data.tags : [],
            };
          }
        } catch (e) {}
      }
      if (!cust) return jsonRes({ title: 'Customer not found', status: 404, code: 'NOT_FOUND' }, 404);

      // ACCOUNTING DYNAMICS (Requirement 6)
      let custInvoices = memoryStore.invoices.filter((i) => i.customerId === id);
      let custPayments = memoryStore.payments.filter((p) => p.customerId === id && p.status === 'active');
      if (db) {
        try {
          const invRows = await db.prepare('SELECT data_json, grand_total, paid_amount, balance_due, due_date, status FROM invoices WHERE customer_id = ? AND deleted_at IS NULL').bind(id).all();
          if (invRows?.results?.length) {
            custInvoices = invRows.results.map((r: any) => ({
              totals: { grandTotal: r.grand_total },
              balanceDue: r.balance_due,
              dueDate: r.due_date,
              status: r.status,
              ...(r.data_json ? JSON.parse(r.data_json) : {}),
            }));
          }
          const payRows = await db.prepare('SELECT data_json, amount, status FROM payments WHERE customer_id = ? AND deleted_at IS NULL').bind(id).all();
          if (payRows?.results?.length) {
            custPayments = payRows.results.map((r: any) => ({
              amount: r.amount,
              status: r.status,
              ...(r.data_json ? JSON.parse(r.data_json) : {}),
            }));
          }
        } catch (e) {}
      }
      const totalSales = custInvoices.reduce((sum, inv) => sum + (inv.totals?.grandTotal || 0), 0);
      const totalReceived = custPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
      const totalOutstanding = Math.max(0, totalSales - totalReceived);
      const overdue = custInvoices.filter((i) => i.status === 'overdue' || (i.dueDate && new Date(i.dueDate) < new Date() && (i.balanceDue || 0) > 0)).reduce((sum, i) => sum + (i.balanceDue || 0), 0);

      return jsonRes({
        customer: cust,
        kpis: {
          outstanding: totalOutstanding,
          overdue,
          received: totalReceived,
          lifetimeValue: totalSales,
          advance: 0,
          activeOrders: memoryStore.orders.filter((o) => o.customerId === id && o.status !== 'closed').length,
          openQuotes: memoryStore.quotes.filter((q) => q.partyId === id && ['draft', 'sent'].includes(q.status)).length,
        },
        ageing: { not_due: totalOutstanding, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 },
        tabs: ['overview', 'quotes', 'invoices', 'payments', 'ledger'],
      });
    }

    if (method === 'GET') {
      if (db) {
        try {
          const row: any = await db.prepare('SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL').bind(id).first();
          if (row) {
            const data = row.data_json ? JSON.parse(row.data_json) : {};
            return jsonRes({
              id: row.id,
              code: row.code,
              displayName: row.display_name,
              legalName: row.legal_name,
              gstin: row.gstin,
              phone: row.phone,
              email: row.email,
              address: row.address,
              city: row.city,
              state: row.state,
              contacts: data.contacts || [],
              addresses: data.addresses || [],
            });
          }
        } catch (e) {}
      }
      const memCust = memoryStore.customers.find((c) => c.id === id);
      if (!memCust) return jsonRes({ title: 'Customer not found', status: 404, code: 'NOT_FOUND' }, 404);
      return jsonRes(memCust);
    }
  }

  // 6. /quotes
  if (path === '/quotes' || path === '/quotes/') {
    if (method === 'GET') {
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM quotes WHERE deleted_at IS NULL ORDER BY created_at DESC').all();
          if (results && results.length > 0) {
            const items = results.map((r: any) => {
              const d = r.data_json ? JSON.parse(r.data_json) : {};
              return {
                id: r.id,
                displayNumber: r.display_number,
                partyType: r.party_type,
                partyId: r.party_id,
                partyName: r.party_name,
                status: r.status,
                date: r.date,
                validUntil: r.valid_until,
                totals: d.totals || {
                  grandTotal: r.grand_total,
                  subTotal: r.sub_total,
                  taxable: r.taxable,
                  cgst: r.cgst,
                  sgst: r.sgst,
                  igst: r.igst,
                },
                lines: d.lines || [],
                pdf: { status: 'ready' },
                revisions: d.revisions || [],
                version: r.version,
                orderId: d.orderId || null,
                isLatest: true,
              };
            });
            return jsonRes({ items, nextCursor: null });
          }
        } catch (e) {
          console.error('D1 quotes fetch error:', e);
        }
      }
      return jsonRes({ items: memoryStore.quotes, nextCursor: null });
    }

    if (method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;

      // Resolve real party name
      let resolvedPartyName = (body.partyName || '').trim();
      const pType = body.partyType || 'customer';
      const pId = (body.partyId || '').trim();

      if (!pId) {
        return jsonRes({ title: 'Party is required', status: 422, code: 'PARTY_REQUIRED' }, 422);
      }

      // Check customer or lead exists and is active (Requirement 1)
      if (pType === 'customer') {
        let cust: any = null;
        if (db) {
          try {
            const { results } = await db.prepare('SELECT id, display_name, legal_name FROM customers WHERE id = ? AND deleted_at IS NULL').bind(pId).all();
            cust = results?.[0];
          } catch (e) {}
        }
        if (!cust) cust = memoryStore.customers.find((c) => c.id === pId);
        if (!cust) {
          return jsonRes({ type: 'https://salesphere.live/errors/not-found', title: 'Customer not found', status: 422, code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }, 422);
        }
        if (!resolvedPartyName || resolvedPartyName === 'Customer') {
          resolvedPartyName = cust.display_name || cust.legal_name || cust.displayName || cust.legalName || 'Customer';
        }
      } else if (pType === 'lead') {
        let ld: any = null;
        if (db) {
          try {
            const { results } = await db.prepare('SELECT id, name, company FROM leads WHERE id = ? AND deleted_at IS NULL').bind(pId).all();
            ld = results?.[0];
          } catch (e) {}
        }
        if (!ld) ld = memoryStore.leads.find((l) => l.id === pId);
        if (!ld) {
          return jsonRes({ type: 'https://salesphere.live/errors/not-found', title: 'Lead not found', status: 422, code: 'LEAD_NOT_FOUND', message: 'Lead not found' }, 422);
        }
        if (!resolvedPartyName || resolvedPartyName === 'Customer') {
          resolvedPartyName = ld.name || 'Lead';
        }
      }

      if (!resolvedPartyName || resolvedPartyName === 'Customer') {
        if (pType === 'customer' && pId) {
          if (db) {
            try {
              const { results } = await db.prepare('SELECT display_name, legal_name FROM customers WHERE id = ?').bind(pId).all();
              if (results?.[0]) resolvedPartyName = (results[0] as any).display_name || (results[0] as any).legal_name;
            } catch (e) {}
          }
          if (!resolvedPartyName) {
            const c = memoryStore.customers.find((cust) => cust.id === pId);
            if (c) resolvedPartyName = c.displayName || c.legalName;
          }
        } else if (pType === 'lead' && pId) {
          if (db) {
            try {
              const { results } = await db.prepare('SELECT name, company FROM leads WHERE id = ?').bind(pId).all();
              if (results?.[0]) resolvedPartyName = (results[0] as any).name;
            } catch (e) {}
          }
          if (!resolvedPartyName) {
            const l = memoryStore.leads.find((ld) => ld.id === pId);
            if (l) resolvedPartyName = l.name;
          }
        }
      }
      if (!resolvedPartyName) resolvedPartyName = 'Customer';

      // Calculate lines and totals with accurate paise math
      const placeOfSupply = body.placeOfSupply || '29';
      const companyState = '29';
      const gstRegistered = true;
      const { lines: processedLines, totals: calculatedTotals } = calculateLinesAndTotals(
        body.lines || [],
        placeOfSupply,
        companyState,
        gstRegistered,
        Number(body.overallDiscountPct) || 0
      );

      const nextNum = await getNextDocNumber(db, 'quotes', 'display_number', 'QT/26-27/');
      const newQtId = 'qt-' + Date.now();
      const newQt = {
        id: newQtId,
        displayNumber: nextNum,
        partyType: pType,
        partyId: pId || 'cust-1',
        partyName: resolvedPartyName,
        status: 'draft',
        date: new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + (Number(body.validDays) || 15) * 86400000).toISOString().slice(0, 10),
        totals: calculatedTotals,
        lines: processedLines,
        placeOfSupply,
        pdf: { status: 'ready' },
        revisions: [],
        version: 1,
        isLatest: true,
      };

      if (db) {
        try {
          await db.prepare(`
            INSERT INTO quotes (id, display_number, party_type, party_id, party_name, status, date, valid_until, grand_total, sub_total, taxable, cgst, sgst, igst, data_json, created_at, updated_at, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            newQt.id,
            newQt.displayNumber,
            newQt.partyType,
            newQt.partyId,
            newQt.partyName,
            newQt.status,
            newQt.date,
            newQt.validUntil,
            newQt.totals.grandTotal,
            newQt.totals.subTotal,
            newQt.totals.taxable,
            newQt.totals.cgst,
            newQt.totals.sgst,
            newQt.totals.igst,
            JSON.stringify({ lines: newQt.lines, totals: newQt.totals, placeOfSupply: newQt.placeOfSupply, revisions: newQt.revisions }),
            new Date().toISOString(),
            new Date().toISOString(),
            1
          ).run();
        } catch (e) {
          console.error('D1 quotes insert error:', e);
        }
      }

      memoryStore.quotes.unshift(newQt);
      return jsonRes({ outcome: 'created', quote: newQt, id: newQt.id }, 201);
    }
  }

  // Quote actions
  const quoteSendMatch = path.match(/^\/quotes\/([^/?]+)\/send$/);
  if (quoteSendMatch && method === 'POST') {
    const qid = quoteSendMatch[1];
    let qt: any = null;
    if (db) {
      try {
        const { results } = await db.prepare('SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL').bind(qid).all();
        qt = results?.[0];
      } catch (e) {}
    }
    const memQt = memoryStore.quotes.find((q) => q.id === qid);
    const displayNumber = qt?.display_number || memQt?.displayNumber || 'QT/26-27/0001';

    if (db) {
      try {
        await db.prepare("UPDATE quotes SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(qid).run();
      } catch (e) {}
    }
    if (memQt) memQt.status = 'sent';

    const shareUrl = `https://crm---leads.connect-hopepitome.workers.dev/sales/quotes/${qid}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Dear Customer,\n\nPlease find attached official Quotation ${displayNumber} from HopEpitome Strategics.\n\nThank you for choosing HopEpitome Strategics.`)}`;
    return jsonRes({
      id: qid,
      status: 'sent',
      number: displayNumber,
      waUrl,
      shareUrl,
    });
  }

  const quoteAcceptMatch = path.match(/^\/quotes\/([^/?]+)\/accept$/);
  if (quoteAcceptMatch && method === 'POST') {
    const qid = quoteAcceptMatch[1];
    if (db) {
      try {
        await db.prepare("UPDATE quotes SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(qid).run();
      } catch (e) {}
    }
    const memQt = memoryStore.quotes.find((q) => q.id === qid);
    if (memQt) memQt.status = 'accepted';
    return jsonRes({ id: qid, status: 'accepted' });
  }

  const quoteRejectMatch = path.match(/^\/quotes\/([^/?]+)\/reject$/);
  if (quoteRejectMatch && method === 'POST') {
    const qid = quoteRejectMatch[1];
    if (db) {
      try {
        await db.prepare("UPDATE quotes SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(qid).run();
      } catch (e) {}
    }
    const memQt = memoryStore.quotes.find((q) => q.id === qid);
    if (memQt) memQt.status = 'rejected';
    return jsonRes({ id: qid, status: 'rejected' });
  }

  const quoteApprovalMatch = path.match(/^\/quotes\/([^/?]+)\/approval$/);
  if (quoteApprovalMatch && method === 'POST') {
    const qid = quoteApprovalMatch[1];
    const body = (await request.json().catch(() => ({}))) as any;
    const newStatus = body.decision === 'approve' ? 'approved' : 'draft';
    if (db) {
      try {
        await db.prepare('UPDATE quotes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newStatus, qid).run();
      } catch (e) {}
    }
    const memQt = memoryStore.quotes.find((q) => q.id === qid);
    if (memQt) memQt.status = newStatus;
    return jsonRes({ id: qid, status: newStatus });
  }

  const quoteReviseMatch = path.match(/^\/quotes\/([^/?]+)\/revise$/);
  if (quoteReviseMatch && method === 'POST') {
    const qid = quoteReviseMatch[1];
    let qt: any = null;
    if (db) {
      try {
        const { results } = await db.prepare('SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL').bind(qid).all();
        qt = results?.[0];
      } catch (e) {}
    }
    const memQt = memoryStore.quotes.find((q) => q.id === qid);
    const baseQt = memQt || (qt ? { ...qt, totals: JSON.parse(qt.data_json || '{}').totals, lines: JSON.parse(qt.data_json || '{}').lines } : null);
    if (!baseQt) return jsonRes({ title: 'Quotation not found', status: 404, code: 'NOT_FOUND' }, 404);

    const newRevId = 'qt-' + Date.now();
    const newRevQt = {
      ...baseQt,
      id: newRevId,
      status: 'draft',
      revision: ((baseQt as any).revision || 0) + 1,
      createdAt: new Date().toISOString(),
    };
    memoryStore.quotes.unshift(newRevQt);
    return jsonRes({ id: newRevId });
  }

  const quoteCreateOrderMatch = path.match(/^\/quotes\/([^/?]+)\/create-order$/);
  if (quoteCreateOrderMatch && method === 'POST') {
    const qid = quoteCreateOrderMatch[1];
    let qt: any = null;
    if (db) {
      try {
        const { results } = await db.prepare('SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL').bind(qid).all();
        if (results?.[0]) {
          const r: any = results[0];
          const d = r.data_json ? JSON.parse(r.data_json) : {};
          qt = {
            id: r.id,
            displayNumber: r.display_number,
            partyType: r.party_type,
            partyId: r.party_id,
            partyName: r.party_name,
            status: r.status,
            totals: d.totals || { grandTotal: r.grand_total },
            lines: d.lines || [],
          };
        }
      } catch (e) {}
    }
    if (!qt) qt = memoryStore.quotes.find((q) => q.id === qid);
    if (!qt) return jsonRes({ title: 'Quotation not found', status: 404, code: 'NOT_FOUND' }, 404);

    // Check if quote is already ordered
    if (qt.status === 'ordered') {
      return jsonRes({ title: 'Quotation already ordered', status: 422, code: 'QUOTE_ALREADY_ORDERED', message: 'Sales order already created for this quotation.' }, 422);
    }

    const reqBody = (await request.json().catch(() => ({}))) as any;
    let customerId = reqBody.customerId;
    if (!customerId) {
      if (qt.partyType === 'customer') {
        customerId = qt.partyId;
      } else if (qt.partyType === 'lead') {
        let leadRow: any = null;
        if (db) {
          try {
            const { results } = await db.prepare('SELECT customer_id FROM leads WHERE id = ?').bind(qt.partyId).all();
            leadRow = results?.[0];
          } catch (e) {}
        }
        if (leadRow?.customer_id) {
          customerId = leadRow.customer_id;
        } else {
          return jsonRes({ title: 'Lead must be converted to customer first', status: 422, code: 'LEAD_NOT_CONVERTED' }, 422);
        }
      }
    }
    if (!customerId) {
      return jsonRes({ title: 'Lead must be converted to customer first', status: 422, code: 'LEAD_NOT_CONVERTED' }, 422);
    }

    let customerName = qt.partyName;
    if (db) {
      try {
        const { results } = await db.prepare('SELECT display_name, legal_name FROM customers WHERE id = ?').bind(customerId).all();
        if (results?.[0]) customerName = (results[0] as any).display_name || (results[0] as any).legal_name;
      } catch (e) {}
    }

    const nextOrdNum = await getNextDocNumber(db, 'orders', 'number', 'SO/26-27/');
    const newOrdId = 'ord-' + Date.now();

    // Ensure line amounts are computed and populated
    const computed = calculateLinesAndTotals(qt.lines, '29');
    const processedLines = computed.lines.map((l: any) => ({
      ...l,
      amount: l.taxable ?? l.amount ?? (l.qty * l.rate),
      invoicedQty: 0,
      pendingQty: l.qty,
    }));

    const newOrd = {
      id: newOrdId,
      number: nextOrdNum,
      customerId,
      customerName,
      quoteId: qid,
      status: 'confirmed',
      date: new Date().toISOString().slice(0, 10),
      expectedDelivery: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      totals: qt.totals,
      lines: processedLines,
      invoices: [],
      version: 1,
    };

    if (db) {
      try {
        await db.prepare(`
          INSERT INTO orders (id, number, customer_id, customer_name, quote_id, status, date, expected_delivery, grand_total, data_json, created_at, updated_at, version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          newOrd.id,
          newOrd.number,
          newOrd.customerId,
          newOrd.customerName,
          newOrd.quoteId,
          newOrd.status,
          newOrd.date,
          newOrd.expectedDelivery,
          newOrd.totals?.grandTotal || 0,
          JSON.stringify({ lines: newOrd.lines, totals: newOrd.totals, invoices: newOrd.invoices }),
          new Date().toISOString(),
          new Date().toISOString(),
          1
        ).run();

        await db.prepare("UPDATE quotes SET status = 'ordered', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(qid).run();
      } catch (e) {
        console.error('D1 create-order error:', e);
      }
    }

    if (qt) qt.status = 'ordered';
    const memQ = memoryStore.quotes.find((q) => q.id === qid);
    if (memQ) {
      memQ.status = 'ordered';
      (memQ as any).orderId = newOrdId;
    }
    memoryStore.orders.unshift(newOrd);
    return jsonRes({ id: newOrd.id, number: newOrd.number }, 201);
  }

  const quoteCreateInvMatch = path.match(/^\/quotes\/([^/?]+)\/create-invoice$/);
  if (quoteCreateInvMatch && method === 'POST') {
    const qid = quoteCreateInvMatch[1];
    let qt: any = null;
    if (db) {
      try {
        const { results } = await db.prepare('SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL').bind(qid).all();
        if (results?.[0]) {
          const r: any = results[0];
          const d = r.data_json ? JSON.parse(r.data_json) : {};
          qt = {
            id: r.id,
            displayNumber: r.display_number,
            partyType: r.party_type,
            partyId: r.party_id,
            partyName: r.party_name,
            status: r.status,
            totals: d.totals || { grandTotal: r.grand_total },
            lines: d.lines || [],
          };
        }
      } catch (e) {}
    }
    if (!qt) qt = memoryStore.quotes.find((q) => q.id === qid);
    if (!qt) return jsonRes({ title: 'Quotation not found', status: 404, code: 'NOT_FOUND' }, 404);

    // Check if quotation already has a sales order or invoice
    if (qt.status === 'invoiced' || qt.status === 'ordered') {
      return jsonRes({ title: 'Quotation already has a sales order or invoice', status: 422, code: 'QUOTE_ALREADY_INVOICED', message: 'Quotation already has a sales order or invoice' }, 422);
    }
    if (db) {
      try {
        const { results: existingInv } = await db.prepare("SELECT id FROM invoices WHERE quote_id = ? AND status != 'cancelled' AND deleted_at IS NULL").bind(qid).all();
        if (existingInv && existingInv.length > 0) {
          return jsonRes({ title: 'Quotation already has a sales order or invoice', status: 422, code: 'QUOTE_ALREADY_INVOICED', message: 'Quotation already has a sales order or invoice' }, 422);
        }
        const { results: existingOrd } = await db.prepare("SELECT id FROM orders WHERE quote_id = ? AND status != 'cancelled' AND deleted_at IS NULL").bind(qid).all();
        if (existingOrd && existingOrd.length > 0) {
          return jsonRes({ title: 'Quotation already has a sales order or invoice', status: 422, code: 'QUOTE_ALREADY_ORDERED', message: 'Quotation already has a sales order or invoice' }, 422);
        }
      } catch (e) {}
    }

    const reqBody = (await request.json().catch(() => ({}))) as any;
    let customerId = reqBody.customerId;
    if (!customerId) {
      if (qt.partyType === 'customer') {
        customerId = qt.partyId;
      } else if (qt.partyType === 'lead') {
        let leadRow: any = null;
        if (db) {
          try {
            const { results } = await db.prepare('SELECT customer_id FROM leads WHERE id = ?').bind(qt.partyId).all();
            leadRow = results?.[0];
          } catch (e) {}
        }
        if (leadRow?.customer_id) {
          customerId = leadRow.customer_id;
        } else {
          return jsonRes({ title: 'Lead must be converted to customer first', status: 422, code: 'LEAD_NOT_CONVERTED' }, 422);
        }
      }
    }
    if (!customerId) {
      return jsonRes({ title: 'Lead must be converted to customer first', status: 422, code: 'LEAD_NOT_CONVERTED' }, 422);
    }

    let customerName = qt.partyName;
    if (db) {
      try {
        const { results } = await db.prepare('SELECT display_name, legal_name FROM customers WHERE id = ?').bind(customerId).all();
        if (results?.[0]) customerName = (results[0] as any).display_name || (results[0] as any).legal_name;
      } catch (e) {}
    }

    const nextInvNum = await getNextDocNumber(db, 'invoices', 'number', 'INV/26-27/');
    const newInvId = 'inv-' + Date.now();
    const grandTotal = qt.totals?.grandTotal || 0;

    // Ensure line amounts are computed
    const computed = calculateLinesAndTotals(qt.lines, '29');
    const processedLines = computed.lines.map((l: any) => ({
      ...l,
      amount: l.taxable ?? l.amount ?? (l.qty * l.rate),
    }));

    const newInv = {
      id: newInvId,
      number: nextInvNum,
      customerId,
      customerName,
      quoteId: qid,
      orderId: null,
      type: 'tax_invoice',
      status: 'issued',
      date: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      paid: 0,
      credited: 0,
      balanceDue: grandTotal,
      totals: qt.totals,
      lines: processedLines,
      pdf: { status: 'ready' },
      creditNotes: [],
      version: 1,
    };

    if (db) {
      try {
        await db.prepare(`
          INSERT INTO invoices (id, number, customer_id, customer_name, order_id, quote_id, type, status, date, due_date, grand_total, paid_amount, credited_amount, balance_due, data_json, created_at, updated_at, version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          newInv.id,
          newInv.number,
          newInv.customerId,
          newInv.customerName,
          null,
          qid,
          newInv.type,
          newInv.status,
          newInv.date,
          newInv.dueDate,
          grandTotal,
          0,
          0,
          grandTotal,
          JSON.stringify({ lines: newInv.lines, totals: newInv.totals, quoteId: qid, quoteNumber: qt.displayNumber }),
          new Date().toISOString(),
          new Date().toISOString(),
          1
        ).run();

        // Update quote status to invoiced and save invoiceId/invoiceNumber in data_json
        await db.prepare(`
          UPDATE quotes 
          SET status = 'invoiced', 
              data_json = json_set(COALESCE(data_json, '{}'), '$.invoiceId', ?, '$.invoiceNumber', ?),
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(newInvId, nextInvNum, qid).run();
      } catch (e) {
        console.error('D1 create-invoice from quote error:', e);
      }
    }

    if (qt) qt.status = 'invoiced';
    const memQ = memoryStore.quotes.find((q) => q.id === qid);
    if (memQ) {
      memQ.status = 'invoiced';
      (memQ as any).invoiceId = newInvId;
    }

    memoryStore.invoices.unshift(newInv);
    return jsonRes({ id: newInv.id, number: newInv.number }, 201);
  }

  // /quotes/:id
  const quoteItemMatch = path.match(/^\/quotes\/([^/?]+)/);
  if (quoteItemMatch) {
    const qid = quoteItemMatch[1];

    if (method === 'DELETE') {
      if (db) {
        try {
          await db.prepare('UPDATE quotes SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(qid).run();
        } catch (e) {}
      }
      const idx = memoryStore.quotes.findIndex((q) => q.id === qid);
      if (idx !== -1) memoryStore.quotes.splice(idx, 1);
      return jsonRes({ success: true, id: qid });
    }

    if (method === 'GET') {
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL').bind(qid).all();
          if (results?.[0]) {
            const r: any = results[0];
            const d = r.data_json ? JSON.parse(r.data_json) : {};

            let orderId = d.orderId || null;
            let orderNumber = d.orderNumber || null;
            let invoiceId = d.invoiceId || null;
            let invoiceNumber = d.invoiceNumber || null;

            try {
              if (!orderId) {
                const { results: ordRows } = await db.prepare('SELECT id, number FROM orders WHERE quote_id = ? AND deleted_at IS NULL').bind(qid).all();
                if (ordRows?.[0]) {
                  orderId = (ordRows[0] as any).id;
                  orderNumber = (ordRows[0] as any).number;
                }
              }
              if (!invoiceId) {
                const { results: invRows } = await db.prepare("SELECT id, number FROM invoices WHERE (order_id IS NULL OR order_id = '') AND data_json LIKE ? AND deleted_at IS NULL").bind(`%"quoteId":"${qid}"%`).all();
                if (invRows?.[0]) {
                  invoiceId = (invRows[0] as any).id;
                  invoiceNumber = (invRows[0] as any).number;
                }
              }
            } catch (e) {}

            return jsonRes({
              id: r.id,
              displayNumber: r.display_number,
              partyType: r.party_type,
              partyId: r.party_id,
              partyName: r.party_name,
              status: r.status,
              date: r.date,
              validUntil: r.valid_until,
              orderId,
              orderNumber,
              invoiceId,
              invoiceNumber,
              totals: d.totals || {
                grandTotal: r.grand_total,
                subTotal: r.sub_total,
                taxable: r.taxable,
                cgst: r.cgst,
                sgst: r.sgst,
                igst: r.igst,
              },
              lines: d.lines || [],
              pdf: { status: 'ready' },
              revisions: d.revisions || [],
              version: r.version,
              isLatest: true,
            });
          }
        } catch (e) {}
      }
      const memQt = memoryStore.quotes.find((q) => q.id === qid);
      if (!memQt) return jsonRes({ title: 'Quotation not found', status: 404, code: 'NOT_FOUND' }, 404);
      return jsonRes(memQt);
    }
  }

  // 7. /orders (Requirement 4 & C)
  if (path === '/orders' || path === '/orders/') {
    if (method === 'GET') {
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM orders WHERE deleted_at IS NULL ORDER BY created_at DESC').all();
          if (results && results.length > 0) {
            const items = results.map((r: any) => {
              const d = r.data_json ? JSON.parse(r.data_json) : {};
              return {
                id: r.id,
                number: r.number,
                customerId: r.customer_id,
                customerName: r.customer_name,
                quoteId: r.quote_id,
                status: r.status,
                date: r.date,
                expectedDelivery: r.expected_delivery,
                totals: d.totals || { grandTotal: r.grand_total },
                lines: d.lines || [],
                invoices: d.invoices || [],
                version: r.version,
              };
            });
            return jsonRes({ items, nextCursor: null });
          }
        } catch (e) {}
      }
      return jsonRes({ items: memoryStore.orders, nextCursor: null });
    }

    if (method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;

      // VALIDATION (Requirement F)
      const customerId = (body.customerId || body.partyId || '').trim();
      const rawLines = Array.isArray(body.lines) ? body.lines : [];
      const lines = rawLines.filter((l: any) => (l.kind === 'heading' ? l.description : l.description || l.rate));

      const errors: Record<string, string> = {};
      if (!customerId) errors.customerId = 'Customer is required.';
      if (lines.length === 0) errors.lines = 'At least one line item is required.';

      if (Object.keys(errors).length > 0) {
        return jsonRes({
          type: 'https://salesphere.live/errors/validation',
          title: 'Validation error',
          status: 422,
          errors,
        }, 422);
      }

      // Always compute lines and totals so amounts, taxable, totals are never null
      const computed = calculateLinesAndTotals(lines, '29');
      const totals = body.totals?.grandTotal ? body.totals : computed.totals;
      const processedLines = computed.lines.map((l: any) => ({
        ...l,
        amount: l.taxable ?? l.amount ?? (l.qty * l.rate),
        invoicedQty: 0,
        pendingQty: l.qty,
      }));

      // Check customer exists and is active (Requirement 1)
      let customerName = (body.customerName || '').trim();
      let validCust: any = null;
      if (db) {
        try {
          const { results } = await db.prepare('SELECT display_name, legal_name FROM customers WHERE id = ? AND deleted_at IS NULL').bind(customerId).all();
          validCust = results?.[0];
        } catch (e) {}
      }
      if (!validCust) validCust = memoryStore.customers.find((cust) => cust.id === customerId);
      if (!validCust) {
        return jsonRes({ type: 'https://salesphere.live/errors/not-found', title: 'Customer not found', status: 422, code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }, 422);
      }
      if (!customerName || customerName === 'Customer') {
        customerName = validCust.display_name || validCust.legal_name || validCust.displayName || validCust.legalName || 'Customer';
      }

      const nextOrdNum = await getNextDocNumber(db, 'orders', 'number', 'SO/26-27/');
      const newOrdId = 'ord-' + Date.now();
      const newOrd = {
        id: newOrdId,
        number: nextOrdNum,
        customerId,
        customerName,
        quoteId: body.quoteId || null,
        status: 'confirmed',
        date: body.date || new Date().toISOString().slice(0, 10),
        expectedDelivery: body.expectedDelivery || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        totals,
        lines: processedLines,
        invoices: [],
        version: 1,
      };

      if (db) {
        try {
          await db.prepare(`
            INSERT INTO orders (id, number, customer_id, customer_name, quote_id, status, date, expected_delivery, grand_total, data_json, created_at, updated_at, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            newOrd.id,
            newOrd.number,
            newOrd.customerId,
            newOrd.customerName,
            newOrd.quoteId,
            newOrd.status,
            newOrd.date,
            newOrd.expectedDelivery,
            newOrd.totals.grandTotal,
            JSON.stringify({ lines: newOrd.lines, totals: newOrd.totals, invoices: newOrd.invoices }),
            new Date().toISOString(),
            new Date().toISOString(),
            1
          ).run();
        } catch (e) {
          console.error('D1 orders insert error:', e);
        }
      }

      memoryStore.orders.unshift(newOrd);
      return jsonRes({ id: newOrd.id, ...newOrd }, 201);
    }
  }

  // Order create-invoice (Requirement D)
  const orderCreateInvMatch = path.match(/^\/orders\/([^/?]+)\/create-invoice$/);
  if (orderCreateInvMatch && method === 'POST') {
    const oid = orderCreateInvMatch[1];
    let ord: any = null;
    if (db) {
      try {
        const { results } = await db.prepare('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL').bind(oid).all();
        if (results?.[0]) {
          const r: any = results[0];
          const d = r.data_json ? JSON.parse(r.data_json) : {};
          ord = {
            id: r.id,
            number: r.number,
            customerId: r.customer_id,
            customerName: r.customer_name,
            status: r.status,
            totals: d.totals || { grandTotal: r.grand_total },
            lines: d.lines || [],
          };
        }
      } catch (e) {}
    }
    if (!ord) ord = memoryStore.orders.find((o) => o.id === oid);
    if (!ord) return jsonRes({ title: 'Order not found', status: 404, code: 'NOT_FOUND' }, 404);

    // Check if order is already fully invoiced
    if (ord.status === 'invoiced') {
      return jsonRes({ title: 'Order already fully invoiced', status: 422, code: 'ORDER_ALREADY_INVOICED', message: 'Order already fully invoiced' }, 422);
    }
    let activeInvoicesCount = 0;
    if (db) {
      try {
        const { results: invRows } = await db.prepare("SELECT count(*) as count FROM invoices WHERE order_id = ? AND status != 'cancelled' AND deleted_at IS NULL").bind(oid).all();
        activeInvoicesCount = Number((invRows?.[0] as any)?.count || 0);
      } catch (e) {}
    }
    const nonHeadingLines = (ord.lines || []).filter((l: any) => l.kind !== 'heading');
    const hasPending = nonHeadingLines.length > 0 && nonHeadingLines.some((l: any) => (l.pendingQty !== undefined ? l.pendingQty > 0 : (activeInvoicesCount === 0 && l.qty > 0)));
    if (!hasPending || (activeInvoicesCount > 0 && ord.lines?.every((l: any) => l.kind === 'heading' || (l.pendingQty ?? 0) <= 0))) {
      return jsonRes({ title: 'Order already fully invoiced', status: 422, code: 'ORDER_ALREADY_INVOICED', message: 'Order already fully invoiced' }, 422);
    }

    // Mark lines as invoiced
    const updatedLines = (ord.lines || []).map((l: any) => {
      if (l.kind === 'heading') return l;
      const pending = l.pendingQty !== undefined ? l.pendingQty : l.qty;
      return {
        ...l,
        invoicedQty: (l.invoicedQty || 0) + pending,
        pendingQty: 0,
      };
    });

    const nextInvNum = await getNextDocNumber(db, 'invoices', 'number', 'INV/26-27/');
    const newInvId = 'inv-' + Date.now();
    const grandTotal = ord.totals?.grandTotal || 0;

    // Look up quoteId and quoteNumber from order
    let linkedQuoteId = ord.quoteId || null;
    let linkedQuoteNumber = null;
    if (linkedQuoteId && db) {
      try {
        const { results: qRows } = await db.prepare('SELECT display_number FROM quotes WHERE id = ?').bind(linkedQuoteId).all();
        if (qRows?.[0]) linkedQuoteNumber = (qRows[0] as any).display_number;
      } catch (e) {}
    }

    const newInv = {
      id: newInvId,
      number: nextInvNum,
      customerId: ord.customerId,
      customerName: ord.customerName,
      orderId: oid,
      orderNumber: ord.number,
      quoteId: linkedQuoteId,
      quoteNumber: linkedQuoteNumber,
      type: 'tax_invoice',
      status: 'issued',
      date: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      paid: 0,
      credited: 0,
      balanceDue: grandTotal,
      totals: ord.totals,
      lines: updatedLines,
      pdf: { status: 'ready' },
      creditNotes: [],
      version: 1,
    };

    if (db) {
      try {
        await db.prepare(`
          INSERT INTO invoices (id, number, customer_id, customer_name, order_id, quote_id, type, status, date, due_date, grand_total, paid_amount, credited_amount, balance_due, data_json, created_at, updated_at, version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          newInv.id,
          newInv.number,
          newInv.customerId,
          newInv.customerName,
          oid,
          linkedQuoteId,
          newInv.type,
          newInv.status,
          newInv.date,
          newInv.dueDate,
          grandTotal,
          0,
          0,
          grandTotal,
          JSON.stringify({ lines: newInv.lines, totals: newInv.totals, orderId: oid, orderNumber: ord.number, quoteId: linkedQuoteId, quoteNumber: linkedQuoteNumber }),
          new Date().toISOString(),
          new Date().toISOString(),
          1
        ).run();

        // Update order status to invoiced and save updated lines & invoices
        const existingInvoices = ord.invoices || [];
        existingInvoices.push({
          id: newInv.id,
          number: newInv.number,
          type: newInv.type,
          status: newInv.status,
          grandTotal: newInv.totals?.grandTotal || 0,
          balanceDue: newInv.totals?.grandTotal || 0,
        });

        await db.prepare(`
          UPDATE orders 
          SET status = 'invoiced', 
              data_json = ?,
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(JSON.stringify({ lines: updatedLines, totals: ord.totals, invoices: existingInvoices }), oid).run();
      } catch (e) {
        console.error('D1 create-invoice from order error:', e);
      }
    }

    memoryStore.invoices.unshift(newInv);
    return jsonRes({ id: newInv.id, number: newInv.number }, 201);
  }

  // /orders/:id/status
  const orderStatusMatch = path.match(/^\/orders\/([^/?]+)\/status/);
  if (orderStatusMatch) {
    const oid = orderStatusMatch[1];
    if (method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      const nextStatus = body.status;
      const reason = body.reason || null;

      if (!nextStatus) {
        return jsonRes({ title: 'Status is required', status: 422, code: 'STATUS_REQUIRED' }, 422);
      }

      // If cancelling, ensure no active issued invoices exist (Requirement 3)
      if (nextStatus === 'cancelled') {
        let activeInvoices: any[] = [];
        if (db) {
          try {
            const { results: activeInvRows } = await db.prepare("SELECT id, number, status FROM invoices WHERE order_id = ? AND status != 'cancelled' AND deleted_at IS NULL").bind(oid).all();
            activeInvoices = activeInvRows || [];
          } catch (e) {}
        }
        if (activeInvoices.length > 0) {
          return jsonRes({
            title: 'Cannot cancel order with issued invoices',
            status: 422,
            code: 'ORDER_HAS_ACTIVE_INVOICES',
            message: 'Cannot cancel order with issued invoices. Cancel or void linked invoices first.',
            activeInvoices: activeInvoices.map((i: any) => i.number || i.id),
          }, 422);
        }
      }

      if (db) {
        try {
          await db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(nextStatus, oid).run();
        } catch (e) {}
      }
      const memOrd = memoryStore.orders.find((o) => o.id === oid);
      if (memOrd) memOrd.status = nextStatus;

      return jsonRes({ id: oid, status: nextStatus, reason });
    }
  }

  // /orders/:id
  const orderItemMatch = path.match(/^\/orders\/([^/?]+)/);
  if (orderItemMatch) {
    const oid = orderItemMatch[1];

    if (method === 'DELETE') {
      // Check if order has active (non-cancelled) issued invoices
      let activeInvoices: any[] = [];
      if (db) {
        try {
          const { results: activeInvRows } = await db.prepare("SELECT id, number, status FROM invoices WHERE order_id = ? AND status != 'cancelled' AND deleted_at IS NULL").bind(oid).all();
          activeInvoices = activeInvRows || [];
        } catch (e) {}
      }
      if (activeInvoices.length > 0) {
        return jsonRes({
          title: 'Cannot cancel order with issued invoices',
          status: 422,
          code: 'ORDER_HAS_ACTIVE_INVOICES',
          message: 'Cannot cancel order with issued invoices. Cancel or void linked invoices first.',
          activeInvoices: activeInvoices.map((i: any) => i.number || i.id),
        }, 422);
      }

      let ordStatus = 'draft';
      if (db) {
        try {
          const { results: oRows } = await db.prepare('SELECT status FROM orders WHERE id = ?').bind(oid).all();
          if (oRows?.[0]) ordStatus = (oRows[0] as any).status;
        } catch (e) {}
      } else {
        const memOrd = memoryStore.orders.find((o) => o.id === oid);
        if (memOrd) ordStatus = memOrd.status;
      }

      if (ordStatus !== 'draft' && ordStatus !== 'cancelled') {
        // Confirmed orders cannot be deleted - cancel them instead
        if (db) {
          try {
            await db.prepare("UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(oid).run();
          } catch (e) {}
        }
        const memOrd = memoryStore.orders.find((o) => o.id === oid);
        if (memOrd) memOrd.status = 'cancelled';
        return jsonRes({ success: true, id: oid, status: 'cancelled' });
      }

      // Allow deleting draft or already cancelled orders
      if (db) {
        try {
          await db.prepare('UPDATE orders SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(oid).run();
        } catch (e) {}
      }
      const idx = memoryStore.orders.findIndex((o) => o.id === oid);
      if (idx !== -1) memoryStore.orders.splice(idx, 1);
      return jsonRes({ success: true, id: oid, status: 'deleted' });
    }

    if (method === 'GET') {
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL').bind(oid).all();
          if (results?.[0]) {
            const r: any = results[0];
            const d = r.data_json ? JSON.parse(r.data_json) : {};

            let liveInvoices = d.invoices || [];
            try {
              const invRes = await db.prepare('SELECT id, number, type, status, grand_total, balance_due FROM invoices WHERE order_id = ? AND deleted_at IS NULL').bind(oid).all();
              if (invRes.results && invRes.results.length > 0) {
                liveInvoices = invRes.results.map((inv: any) => ({
                  id: inv.id,
                  number: inv.number,
                  type: inv.type,
                  status: inv.status,
                  grandTotal: inv.grand_total,
                  balanceDue: inv.balance_due,
                }));
              }
            } catch (e) {}

            const ordLines = (d.lines || []).map((l: any) => {
              if (l.kind === 'heading') return l;
              if (liveInvoices.length > 0 && (l.pendingQty === undefined || l.pendingQty > 0)) {
                return { ...l, invoicedQty: l.qty, pendingQty: 0 };
              }
              return l;
            });

            const isFullyInvoiced = liveInvoices.length > 0 || (ordLines.length > 0 && ordLines.every((l: any) => l.kind === 'heading' || (l.pendingQty ?? 0) <= 0));
            const status = isFullyInvoiced ? 'invoiced' : r.status;
            const invoicedPct = isFullyInvoiced ? 100 : (liveInvoices.length > 0 ? 50 : 0);

            return jsonRes({
              id: r.id,
              number: r.number,
              customerId: r.customer_id,
              customerName: r.customer_name,
              quoteId: r.quote_id,
              status,
              date: r.date,
              expectedDelivery: r.expected_delivery,
              totals: d.totals || { grandTotal: r.grand_total },
              lines: ordLines,
              invoices: liveInvoices,
              invoicedPct,
              version: r.version,
            });
          }
        } catch (e) {}
      }
      const memOrd = memoryStore.orders.find((o) => o.id === oid);
      if (!memOrd) return jsonRes({ title: 'Order not found', status: 404, code: 'NOT_FOUND' }, 404);
      return jsonRes(memOrd);
    }
  }

  // 8. /invoices
  if (path === '/invoices' || path === '/invoices/') {
    if (method === 'GET') {
      let invItems = memoryStore.invoices;
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM invoices WHERE deleted_at IS NULL ORDER BY created_at DESC').all();
          if (results && results.length > 0) {
            invItems = results.map((r: any) => {
              const d = r.data_json ? JSON.parse(r.data_json) : {};
              return {
                id: r.id,
                number: r.number,
                customerId: r.customer_id,
                customerName: r.customer_name,
                orderId: r.order_id || d.orderId || null,
                orderNumber: d.orderNumber || null,
                quoteId: r.quote_id || d.quoteId || null,
                quoteNumber: d.quoteNumber || null,
                type: r.type,
                status: r.status,
                date: r.date,
                dueDate: r.due_date,
                paid: r.paid_amount,
                credited: r.credited_amount,
                balanceDue: r.balance_due,
                totals: d.totals || { grandTotal: r.grand_total },
                lines: d.lines || [],
                pdf: { status: 'ready' },
                creditNotes: [],
                version: r.version,
              };
            });
          }
        } catch (e) {}
      }

      // Reconcile payment allocations
      const items = invItems.map((inv) => {
        const allocated = memoryStore.payments
          .filter((p) => p.status === 'active')
          .flatMap((p) => p.allocations || [])
          .filter((a) => a.invoiceId === inv.id)
          .reduce((sum, a) => sum + (a.amount || 0), 0);
        const grandTotal = inv.totals?.grandTotal || inv.grandTotal || 0;
        const paid = allocated || inv.paid || 0;
        const balanceDue = Math.max(0, grandTotal - paid);
        const status = balanceDue <= 0 ? 'paid' : (paid > 0 ? 'partly_paid' : inv.status);
        return {
          ...inv,
          paid,
          balanceDue,
          status,
        };
      });
      return jsonRes({ items, nextCursor: null });
    }

    if (method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;

      let customerId = (body.customerId || '').trim();
      let customerName = (body.customerName || '').trim();
      let lines = Array.isArray(body.lines) ? body.lines : [];
      let totals = body.totals;

      // Copy from order if orderId provided and lines empty
      if (body.orderId && lines.length === 0) {
        let ord: any = null;
        if (db) {
          try {
            const { results } = await db.prepare('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL').bind(body.orderId).all();
            if (results?.[0]) {
              const r: any = results[0];
              const d = r.data_json ? JSON.parse(r.data_json) : {};
              ord = { customerId: r.customer_id, customerName: r.customer_name, totals: d.totals || { grandTotal: r.grand_total }, lines: d.lines || [] };
            }
          } catch (e) {}
        }
        if (!ord) ord = memoryStore.orders.find((o) => o.id === body.orderId);
        if (ord) {
          customerId = ord.customerId;
          customerName = ord.customerName;
          lines = ord.lines;
          totals = ord.totals;
        }
      }

      // VALIDATION (Requirement F)
      const validLines = lines.filter((l: any) => (l.kind === 'heading' ? l.description : l.description || l.rate));
      const errors: Record<string, string> = {};
      if (!customerId) errors.customerId = 'Customer is required.';
      if (validLines.length === 0) errors.lines = 'At least one line item is required.';

      if (Object.keys(errors).length > 0) {
        return jsonRes({
          type: 'https://salesphere.live/errors/validation',
          title: 'Validation error',
          status: 422,
          errors,
        }, 422);
      }

      if (!totals || !totals.grandTotal) {
        const computed = calculateLinesAndTotals(validLines, '29');
        totals = computed.totals;
      }

      // Check customer exists and is active (Requirement 1)
      let validInvCust: any = null;
      if (db) {
        try {
          const { results } = await db.prepare('SELECT display_name, legal_name FROM customers WHERE id = ? AND deleted_at IS NULL').bind(customerId).all();
          validInvCust = results?.[0];
        } catch (e) {}
      }
      if (!validInvCust) validInvCust = memoryStore.customers.find((cust) => cust.id === customerId);
      if (!validInvCust) {
        return jsonRes({ type: 'https://salesphere.live/errors/not-found', title: 'Customer not found', status: 422, code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }, 422);
      }
      if (!customerName || customerName === 'Customer') {
        customerName = validInvCust.display_name || validInvCust.legal_name || validInvCust.displayName || validInvCust.legalName || 'Customer';
      }

      const nextInvNum = await getNextDocNumber(db, 'invoices', 'number', 'INV/26-27/');
      const newInvId = 'inv-' + Date.now();
      const grandTotal = totals.grandTotal || 0;

      const newInv = {
        id: newInvId,
        number: nextInvNum,
        customerId,
        customerName,
        orderId: body.orderId || null,
        type: body.type || 'tax_invoice',
        status: 'issued',
        date: body.date || new Date().toISOString().slice(0, 10),
        dueDate: body.dueDate || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        paid: 0,
        credited: 0,
        balanceDue: grandTotal,
        totals,
        lines: validLines,
        pdf: { status: 'ready' },
        creditNotes: [],
        version: 1,
      };

      if (db) {
        try {
          await db.prepare(`
            INSERT INTO invoices (id, number, customer_id, customer_name, order_id, type, status, date, due_date, grand_total, paid_amount, credited_amount, balance_due, data_json, created_at, updated_at, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            newInv.id,
            newInv.number,
            newInv.customerId,
            newInv.customerName,
            newInv.orderId,
            newInv.type,
            newInv.status,
            newInv.date,
            newInv.dueDate,
            grandTotal,
            0,
            0,
            grandTotal,
            JSON.stringify({ lines: newInv.lines, totals: newInv.totals, orderId: newInv.orderId }),
            new Date().toISOString(),
            new Date().toISOString(),
            1
          ).run();
        } catch (e) {
          console.error('D1 invoices insert error:', e);
        }
      }

      memoryStore.invoices.unshift(newInv);
      return jsonRes({ id: newInv.id, ...newInv }, 201);
    }
  }

  // /invoices/:id/upi
  const invoiceUpiMatch = path.match(/^\/invoices\/([^/?]+)\/upi\/?$/);
  if (invoiceUpiMatch && method === 'GET') {
    const invId = invoiceUpiMatch[1];
    let inv: any = null;
    if (db) {
      inv = await db.prepare('SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL').bind(invId).first();
    }
    if (!inv) inv = memoryStore.invoices.find((i) => i.id === invId);
    if (!inv) return jsonRes({ title: 'Invoice not found', status: 404, code: 'NOT_FOUND' }, 404);

    const balanceDue = Number(inv.balance_due ?? inv.balanceDue ?? 0);
    const grandTotal = Number(inv.grand_total ?? inv.grandTotal ?? 0);
    const status = inv.status || 'issued';
    const paid = status === 'paid' || (balanceDue <= 0 && grandTotal > 0);
    const amount = paid ? grandTotal : balanceDue;

    let vpa = DEFAULT_HOPEPITOME_COMPANY.upiId || 'service@hopepitome';
    let payeeName = DEFAULT_HOPEPITOME_COMPANY.legalName;
    let bank = {
      bankName: DEFAULT_HOPEPITOME_COMPANY.bankName || 'HDFC Bank Ltd',
      accountNo: DEFAULT_HOPEPITOME_COMPANY.bankAccount || '50200088991122',
      ifsc: DEFAULT_HOPEPITOME_COMPANY.bankIfsc || 'HDFC0001234',
      branch: DEFAULT_HOPEPITOME_COMPANY.bankBranch || 'Outer Ring Road, Bengaluru',
    };

    if (db) {
      try {
        const upiRow: any = await db.prepare("SELECT * FROM masters WHERE type = 'upiIds' AND status = 'active' ORDER BY is_default DESC, sort_order ASC LIMIT 1").first();
        if (upiRow?.data_json) {
          const u = JSON.parse(upiRow.data_json);
          if (u.vpa) vpa = u.vpa;
          if (u.payeeName) payeeName = u.payeeName;
        }
        const bankRow: any = await db.prepare("SELECT * FROM masters WHERE type = 'bankAccounts' AND status = 'active' ORDER BY is_default DESC, sort_order ASC LIMIT 1").first();
        if (bankRow?.data_json) {
          const b = JSON.parse(bankRow.data_json);
          bank = {
            bankName: b.bankName || bankRow.name || bank.bankName,
            accountNo: b.accountNo || bank.accountNo,
            ifsc: b.ifsc || bank.ifsc,
            branch: b.branch || bank.branch,
          };
        }
      } catch {}
    }

    const uri = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payeeName)}&am=${(amount / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(inv.number || '')}`;
    let qrSvg: string | null = null;
    try {
      qrSvg = await upiQrSvg(uri);
    } catch {}

    return jsonRes({ uri, vpa, payeeName, amount, qrSvg, paid, bank });
  }

  // /invoices/:id
  const invoiceItemMatch = path.match(/^\/invoices\/([^/?]+)/);
  if (invoiceItemMatch) {
    const invId = invoiceItemMatch[1];

    if (method === 'DELETE') {
      let inv: any = null;
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL').bind(invId).all();
          inv = results?.[0];
        } catch (e) {}
      }
      if (!inv) inv = memoryStore.invoices.find((i) => i.id === invId);

      const status = inv?.status || 'issued';
      if (status === 'issued' || status === 'paid' || status === 'partly_paid') {
        return jsonRes({
          type: 'https://salesphere.live/errors/business',
          title: 'Cannot delete invoice',
          status: 422,
          detail: 'Issued invoices cannot be deleted; please issue a credit note instead.',
        }, 422);
      }

      if (db) {
        try {
          await db.prepare('UPDATE invoices SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(invId).run();
        } catch (e) {}
      }
      const idx = memoryStore.invoices.findIndex((i) => i.id === invId);
      if (idx !== -1) memoryStore.invoices.splice(idx, 1);
      return jsonRes({ success: true, id: invId });
    }

    if (method === 'GET') {
      let inv: any = null;
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL').bind(invId).all();
          if (results?.[0]) {
            const r: any = results[0];
            const d = r.data_json ? JSON.parse(r.data_json) : {};
            inv = {
              id: r.id,
              number: r.number,
              customerId: r.customer_id,
              customerName: r.customer_name,
              orderId: r.order_id || d.orderId || null,
              orderNumber: d.orderNumber || null,
              quoteId: r.quote_id || d.quoteId || null,
              quoteNumber: d.quoteNumber || null,
              type: r.type,
              status: r.status,
              date: r.date,
              dueDate: r.due_date,
              paid: r.paid_amount,
              credited: r.credited_amount,
              balanceDue: r.balance_due,
              totals: d.totals || { grandTotal: r.grand_total },
              lines: d.lines || [],
              pdf: { status: 'ready' },
              creditNotes: [],
              version: r.version,
            };
          }
        } catch (e) {}
      }
      if (!inv) inv = memoryStore.invoices.find((i) => i.id === invId);
      if (!inv) return jsonRes({ title: 'Invoice not found', status: 404, code: 'NOT_FOUND' }, 404);

      // Reconcile allocations
      const allocated = memoryStore.payments
        .filter((p) => p.status === 'active')
        .flatMap((p) => p.allocations || [])
        .filter((a) => a.invoiceId === inv.id)
        .reduce((sum, a) => sum + (a.amount || 0), 0);
      const grandTotal = inv.totals?.grandTotal || inv.grandTotal || 0;
      const paid = allocated || inv.paid || 0;
      const balanceDue = Math.max(0, grandTotal - paid);
      const status = balanceDue <= 0 ? 'paid' : (paid > 0 ? 'partly_paid' : inv.status);

      return jsonRes({
        ...inv,
        paid,
        balanceDue,
        status,
      });
    }
  }

  // 9. /payments
  if (path === '/payments' || path === '/payments/') {
    if (method === 'GET') {
      return jsonRes({ items: memoryStore.payments, nextCursor: null });
    }
    if (method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      const amount = Number(body.amount) || 2950000;
      let nextPayNum = 'RCT/26-27/0002';
      if (db) {
        try {
          const pRow: any = await db.prepare("SELECT receipt_no FROM payments WHERE receipt_no LIKE 'RCT/26-27/%' AND deleted_at IS NULL ORDER BY receipt_no DESC LIMIT 1").first();
          if (pRow?.receipt_no) {
            const m = pRow.receipt_no.match(/(\d+)$/);
            const seq = m ? parseInt(m[1], 10) + 1 : 2;
            nextPayNum = `RCT/26-27/${String(seq).padStart(4, '0')}`;
          }
        } catch (e) {}
      }
      const newPay = {
        id: 'pay-' + Date.now(),
        receiptNo: nextPayNum,
        customerId: body.customerId || 'cust-1',
        customerName: body.customerName || 'Customer',
        date: body.date || new Date().toISOString().slice(0, 10),
        amount,
        tdsAmount: Number(body.tdsAmount) || 0,
        mode: body.mode || 'neft',
        reference: body.reference || 'REF-' + Date.now(),
        status: 'active',
        allocations: body.allocations || (body.invoiceId ? [{ invoiceId: body.invoiceId, number: 'INV/26-27/0001', amount }] : []),
        advance: 0,
      };
      memoryStore.payments.unshift(newPay);
      return jsonRes({ id: newPay.id, ...newPay }, 201);
    }
  }

  // /payments/preview (Requirement 4)
  if (path === '/payments/preview' || path.startsWith('/payments/preview')) {
    return jsonRes({
      amount: 2950000,
      allocated: 2950000,
      unallocated: 0,
      allocations: [{ invoiceId: 'inv-1', number: 'INV/26-27/0001', amount: 2950000 }],
    });
  }

  if (path.startsWith('/payments/')) {
    const pid = path.replace(/^\/payments\//, '').split('/')[0].split('?')[0];
    const pay = memoryStore.payments.find((p) => p.id === pid);
    if (!pay) return jsonRes({ title: 'Payment not found', status: 404, code: 'NOT_FOUND' }, 404);
    return jsonRes(pay);
  }

  // 10. /notifications & /notifications/read (backed by D1 + auto follow-up alerts)
  if (path === '/notifications/read' && method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as any;
    if (db) {
      if (body.all) {
        await db.prepare('UPDATE notifications SET is_read = 1').run();
      } else if (Array.isArray(body.ids) && body.ids.length > 0) {
        for (const nid of body.ids) {
          await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').bind(nid).run();
        }
      }
    }
    return jsonRes({ success: true });
  }

  if (path === '/notifications' || path === '/notifications/') {
    if (db) {
      try {
        // Sync notifications for pending follow-ups due in 15 mins or newly overdue
        const { results: fuRows } = await db.prepare("SELECT * FROM follow_ups WHERE status = 'pending'").all();
        const nowMs = Date.now();
        for (const fu of (fuRows || []) as any[]) {
          const dueMs = new Date(fu.due_at).getTime();
          if (isNaN(dueMs)) continue;
          const link = `/${fu.record_type === 'customer' ? 'customers' : 'leads'}/${fu.record_id}`;
          const party = fu.party_name || 'Client';
          if (dueMs < nowMs) {
            const nid = `notif-fu-overdue-${fu.id}`;
            const title = `Overdue follow-up: ${party} (due ${formatISTDate(fu.due_at)})`;
            await db
              .prepare('INSERT OR IGNORE INTO notifications (id, title, message, is_read, link, created_at) VALUES (?, ?, ?, 0, ?, ?)')
              .bind(nid, title, fu.note || title, link, fu.due_at)
              .run();
          } else if (dueMs - nowMs <= 15 * 60 * 1000) {
            const nid = `notif-fu-soon-${fu.id}`;
            const title = `Follow-up due in 15 mins: ${party} (${formatISTDate(fu.due_at)})`;
            await db
              .prepare('INSERT OR IGNORE INTO notifications (id, title, message, is_read, link, created_at) VALUES (?, ?, ?, 0, ?, ?)')
              .bind(nid, title, fu.note || title, link, new Date().toISOString())
              .run();
          }
        }

        const unreadOnly = url.searchParams.get('unread') === '1';
        const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
        const { results } = await db
          .prepare(`SELECT * FROM notifications ${unreadOnly ? 'WHERE is_read = 0' : ''} ORDER BY created_at DESC LIMIT ?`)
          .bind(limit)
          .all();
        const unreadRow: any = await db.prepare('SELECT COUNT(*) AS cnt FROM notifications WHERE is_read = 0').first();
        const items = (results || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          message: r.message,
          link: r.link || '/follow-ups',
          read: Boolean(r.is_read),
          readAt: r.is_read ? r.created_at : null,
          createdAt: r.created_at,
        }));
        return jsonRes({ items, unreadCount: Number(unreadRow?.cnt ?? 0) });
      } catch (e) {
        console.error('D1 notifications error:', e);
      }
    }
    const unreadOnly = url.searchParams.get('unread') === '1';
    let notifs = memoryStore.notifications;
    if (unreadOnly) notifs = notifs.filter((n) => !n.read);
    return jsonRes({ items: notifs, unreadCount: memoryStore.notifications.filter((n) => !n.read).length });
  }

  // 11. /masters/:type/options — single source of truth from active D1 masters records
  const masterOptionsMatch = path.match(/^\/masters\/([^/]+)\/options/);
  if (masterOptionsMatch) {
    const mType = decodeURIComponent(masterOptionsMatch[1]);
    if (!db) return jsonRes({ items: [] });
    try {
      const { results } = await db
        .prepare("SELECT * FROM masters WHERE type = ? AND status = 'active' ORDER BY is_default DESC, sort_order ASC, name ASC")
        .bind(mType)
        .all();
      const items = (results || []).map((r: any) => {
        let d: any = {};
        try {
          d = r.data_json ? JSON.parse(r.data_json) : {};
        } catch {}
        return {
          id: r.id,
          key: r.key || r.id,
          label: r.name,
          name: r.name,
          value: r.id,
          isDefault: Boolean(r.is_default),
          sortOrder: Number(r.sort_order ?? 0),
          data: d,
          ...d,
          ...(mType === 'products' ? { rate: d.ratePaise ? Math.round(Number(d.ratePaise) / 100) : 0 } : {}),
        };
      });
      return jsonRes({ items });
    } catch (e: any) {
      return jsonRes({ items: [], error: e.message }, 500);
    }
  }

  // Helper to parse share token
  function parseShareToken(tok: string): { type: string; id: string } | null {
    if (!tok) return null;
    if (tok.includes('_')) {
      const parts = tok.split('_');
      return { type: parts[0], id: parts.slice(1).join('_') };
    }
    try {
      const decoded = atob(tok.replace(/-/g, '+').replace(/_/g, '/'));
      if (decoded.includes(':')) {
        const [type, id] = decoded.split(':');
        return { type, id };
      }
    } catch (e) {}
    return null;
  }

  // Helper to build DocInput from database
  async function buildDocInput(type: string, id: string): Promise<DocInput | null> {
    const norm = type.toLowerCase().replace(/s$/, '');

    if (norm === 'quote' || norm === 'quotation') {
      let q: any = null;
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL').bind(id).all();
          q = results?.[0];
        } catch (e) {}
      }
      if (!q) q = memoryStore.quotes.find((item) => item.id === id);
      if (!q) return null;

      const dataJson = q.data_json ? (typeof q.data_json === 'string' ? JSON.parse(q.data_json) : q.data_json) : {};
      const rawLines = dataJson.lines || q.lines || [];
      const lines: any[] = rawLines.map((l: any) => ({
        kind: l.kind || 'item',
        description: l.description || l.name || 'Enterprise Service / Solution',
        hsnSac: l.hsnSac || '998313',
        qty: Number(l.qty) || 1,
        unit: l.unit || 'Nos',
        rate: Number(l.ratePaise ?? l.rate ?? 0),
        discount: Number(l.discountPaise ?? l.discount ?? 0),
        taxable: Number(l.taxablePaise ?? l.taxable ?? 0),
        taxRatePct: Number(l.taxRatePct ?? 18),
        cgst: Number(l.cgstPaise ?? l.cgst ?? 0),
        sgst: Number(l.sgstPaise ?? l.sgst ?? 0),
        igst: Number(l.igstPaise ?? l.igst ?? 0),
        total: Number(l.totalPaise ?? l.total ?? l.amount ?? 0),
      }));

      const partyId = q.party_id || q.partyId;
      const partyType = q.party_type || q.partyType || 'customer';
      let partyDetails: any = null;
      if (partyType === 'customer' && partyId) {
        if (db) {
          try {
            const { results } = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(partyId).all();
            partyDetails = results?.[0];
          } catch (e) {}
        }
        if (!partyDetails) partyDetails = memoryStore.customers.find((c) => c.id === partyId);
      } else if (partyType === 'lead' && partyId) {
        if (db) {
          try {
            const { results } = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(partyId).all();
            partyDetails = results?.[0];
          } catch (e) {}
        }
        if (!partyDetails) partyDetails = memoryStore.leads.find((l) => l.id === partyId);
      }

      const billToName = q.party_name || q.partyName || partyDetails?.displayName || partyDetails?.display_name || partyDetails?.name || 'Customer';
      const billToCompany = partyDetails?.legalName || partyDetails?.legal_name || partyDetails?.company || null;
      const billToAddress = partyDetails?.billingAddress || partyDetails?.billing_address || (partyDetails?.city ? `${partyDetails.city}${partyDetails.pincode ? ' - ' + partyDetails.pincode : ''}` : 'Address on file');
      const billToGstin = partyDetails?.gstin || null;
      const billToStateCode = partyDetails?.stateCode || partyDetails?.state_code || '29';

      const totalsObj = dataJson.totals || q.totals || {};
      const grandTotal = Number(totalsObj.grandTotal ?? q.grand_total ?? 0);
      const taxable = Number(totalsObj.taxable ?? q.taxable ?? 0);
      const cgst = Number(totalsObj.cgst ?? q.cgst ?? 0);
      const sgst = Number(totalsObj.sgst ?? q.sgst ?? 0);
      const igst = Number(totalsObj.igst ?? q.igst ?? 0);
      const subTotal = Number(totalsObj.subTotal ?? q.sub_total ?? taxable);
      const discountTotal = Number(totalsObj.discountTotal ?? 0);

      if (lines.length === 0) {
        lines.push({
          kind: 'item',
          description: 'Enterprise Solution Implementation',
          hsnSac: '998313',
          qty: 1,
          unit: 'service',
          rate: grandTotal,
          discount: 0,
          taxable: taxable || grandTotal,
          taxRatePct: 18,
          cgst,
          sgst,
          igst,
          total: grandTotal,
        });
      }

      const docInput: DocInput = {
        kind: 'quotation',
        number: q.display_number || q.displayNumber || q.number || 'QT/26-27/0001',
        date: q.date || new Date().toISOString().split('T')[0],
        validUntil: q.valid_until || q.validUntil || null,
        placeOfSupply: billToStateCode,
        company: DEFAULT_HOPEPITOME_COMPANY,
        billTo: {
          name: billToName,
          company: billToCompany,
          address: billToAddress,
          gstin: billToGstin,
          stateCode: billToStateCode,
          phone: partyDetails?.phone || null,
          email: partyDetails?.email || null,
        },
        lines,
        totals: {
          subTotal,
          discountTotal,
          taxable,
          cgst,
          sgst,
          igst,
          roundOff: 0,
          grandTotal,
          inWords: amountInWords(grandTotal),
        },
        refs: [
          { label: 'Scope', value: 'Enterprise Digital System' },
          { label: 'Engagement Lead', value: 'HopEpitome Strategics' },
        ],
        terms: '1. Quotation validity: 30 calendar days from issue date.\n2. Commercial terms: 50% mobilization advance upon order confirmation, 50% upon milestone completion.\n3. GST and statutory levies applied as per prevailing Indian tax regulations.\n4. Governed by HopEpitome professional services terms and Bangalore jurisdiction.',
        notes: 'HopEpitome Strategics: We build digital systems for businesses and distinctive professional identities for people.',
      };
      return docInput;
    }

    if (norm === 'order') {
      let o: any = null;
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL').bind(id).all();
          o = results?.[0];
        } catch (e) {}
      }
      if (!o) o = memoryStore.orders.find((item) => item.id === id);
      if (!o) return null;

      const dataJson = o.data_json ? (typeof o.data_json === 'string' ? JSON.parse(o.data_json) : o.data_json) : {};
      const rawLines = dataJson.lines || o.lines || [];
      const lines: any[] = rawLines.map((l: any) => ({
        kind: l.kind || 'item',
        description: l.description || l.name || 'Enterprise Service / Solution',
        hsnSac: l.hsnSac || '998313',
        qty: Number(l.qty) || 1,
        unit: l.unit || 'Nos',
        rate: Number(l.ratePaise ?? l.rate ?? 0),
        discount: Number(l.discountPaise ?? l.discount ?? 0),
        taxable: Number(l.taxablePaise ?? l.taxable ?? 0),
        taxRatePct: Number(l.taxRatePct ?? 18),
        cgst: Number(l.cgstPaise ?? l.cgst ?? 0),
        sgst: Number(l.sgstPaise ?? l.sgst ?? 0),
        igst: Number(l.igstPaise ?? l.igst ?? 0),
        total: Number(l.totalPaise ?? l.total ?? l.amount ?? 0),
      }));

      const customerId = o.customer_id || o.customerId;
      let customer: any = null;
      if (customerId) {
        if (db) {
          try {
            const { results } = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(customerId).all();
            customer = results?.[0];
          } catch (e) {}
        }
        if (!customer) customer = memoryStore.customers.find((c) => c.id === customerId);
      }

      const billToName = o.customer_name || o.customerName || customer?.displayName || customer?.display_name || customer?.name || 'Customer';
      const billToCompany = customer?.legalName || customer?.legal_name || customer?.company || null;
      const billToAddress = customer?.billingAddress || customer?.billing_address || (customer?.city ? `${customer.city}${customer.pincode ? ' - ' + customer.pincode : ''}` : 'Address on file');
      const billToGstin = customer?.gstin || null;
      const billToStateCode = customer?.stateCode || customer?.state_code || '29';

      const totalsObj = dataJson.totals || o.totals || {};
      const grandTotal = Number(totalsObj.grandTotal ?? o.grand_total ?? 0);
      const taxable = Number(totalsObj.taxable ?? o.taxable ?? 0);
      const cgst = Number(totalsObj.cgst ?? o.cgst ?? 0);
      const sgst = Number(totalsObj.sgst ?? o.sgst ?? 0);
      const igst = Number(totalsObj.igst ?? o.igst ?? 0);
      const subTotal = Number(totalsObj.subTotal ?? o.sub_total ?? taxable);
      const discountTotal = Number(totalsObj.discountTotal ?? 0);

      if (lines.length === 0) {
        lines.push({
          kind: 'item',
          description: 'Confirmed Scope Items',
          hsnSac: '998313',
          qty: 1,
          unit: 'service',
          rate: grandTotal,
          discount: 0,
          taxable: taxable || grandTotal,
          taxRatePct: 18,
          cgst,
          sgst,
          igst,
          total: grandTotal,
        });
      }

      const refs: { label: string; value: string }[] = [];
      if (o.quote_id || o.quoteId) {
        refs.push({ label: 'Quotation Ref', value: o.quote_number || 'QT' });
      }

      const docInput: DocInput = {
        kind: 'order',
        number: o.number || 'SO/26-27/0001',
        date: o.date || new Date().toISOString().split('T')[0],
        expectedDelivery: o.expected_delivery || o.expectedDelivery || null,
        placeOfSupply: billToStateCode,
        company: DEFAULT_HOPEPITOME_COMPANY,
        billTo: {
          name: billToName,
          company: billToCompany,
          address: billToAddress,
          gstin: billToGstin,
          stateCode: billToStateCode,
          phone: customer?.phone || null,
          email: customer?.email || null,
        },
        lines,
        totals: {
          subTotal,
          discountTotal,
          taxable,
          cgst,
          sgst,
          igst,
          roundOff: 0,
          grandTotal,
          inWords: amountInWords(grandTotal),
        },
        refs,
        terms: '1. Order delivery commences upon receipt of signed contract and payment milestone clearance.\n2. Any variation in scope of work shall be billed as an addendum.\n3. HopEpitome standard service levels and warranty provisions apply.',
        notes: 'HopEpitome Strategics: We build digital systems for businesses and distinctive professional identities for people.',
      };
      return docInput;
    }

    if (norm === 'invoice') {
      let inv: any = null;
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL').bind(id).all();
          inv = results?.[0];
        } catch (e) {}
      }
      if (!inv) inv = memoryStore.invoices.find((item) => item.id === id);
      if (!inv) return null;

      const dataJson = inv.data_json ? (typeof inv.data_json === 'string' ? JSON.parse(inv.data_json) : inv.data_json) : {};
      const rawLines = dataJson.lines || inv.lines || [];
      const lines: any[] = rawLines.map((l: any) => ({
        kind: l.kind || 'item',
        description: l.description || l.name || 'Enterprise Service / Solution',
        hsnSac: l.hsnSac || '998313',
        qty: Number(l.qty) || 1,
        unit: l.unit || 'Nos',
        rate: Number(l.ratePaise ?? l.rate ?? 0),
        discount: Number(l.discountPaise ?? l.discount ?? 0),
        taxable: Number(l.taxablePaise ?? l.taxable ?? 0),
        taxRatePct: Number(l.taxRatePct ?? 18),
        cgst: Number(l.cgstPaise ?? l.cgst ?? 0),
        sgst: Number(l.sgstPaise ?? l.sgst ?? 0),
        igst: Number(l.igstPaise ?? l.igst ?? 0),
        total: Number(l.totalPaise ?? l.total ?? l.amount ?? 0),
      }));

      const customerId = inv.customer_id || inv.customerId;
      let customer: any = null;
      if (customerId) {
        if (db) {
          try {
            const { results } = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(customerId).all();
            customer = results?.[0];
          } catch (e) {}
        }
        if (!customer) customer = memoryStore.customers.find((c) => c.id === customerId);
      }

      const billToName = inv.customer_name || inv.customerName || customer?.displayName || customer?.display_name || customer?.name || 'Customer';
      const billToCompany = customer?.legalName || customer?.legal_name || customer?.company || null;
      const billToAddress = customer?.billingAddress || customer?.billing_address || (customer?.city ? `${customer.city}${customer.pincode ? ' - ' + customer.pincode : ''}` : 'Address on file');
      const billToGstin = customer?.gstin || null;
      const billToStateCode = customer?.stateCode || customer?.state_code || '29';

      const totalsObj = dataJson.totals || inv.totals || {};
      const grandTotal = Number(totalsObj.grandTotal ?? inv.grand_total ?? 0);
      const balanceDue = Number(inv.balance_due ?? inv.balanceDue ?? 0);
      const taxable = Number(totalsObj.taxable ?? inv.taxable ?? 0);
      const cgst = Number(totalsObj.cgst ?? inv.cgst ?? 0);
      const sgst = Number(totalsObj.sgst ?? inv.sgst ?? 0);
      const igst = Number(totalsObj.igst ?? inv.igst ?? 0);
      const subTotal = Number(totalsObj.subTotal ?? inv.sub_total ?? taxable);
      const discountTotal = Number(totalsObj.discountTotal ?? 0);

      if (lines.length === 0) {
        lines.push({
          kind: 'item',
          description: 'Professional Services Supplied',
          hsnSac: '998313',
          qty: 1,
          unit: 'service',
          rate: grandTotal,
          discount: 0,
          taxable: taxable || grandTotal,
          taxRatePct: 18,
          cgst,
          sgst,
          igst,
          total: grandTotal,
        });
      }

      const refs: { label: string; value: string }[] = [];
      if (inv.order_id || inv.orderId) refs.push({ label: 'Sales Order', value: inv.order_number || inv.orderId });
      if (inv.quote_id || inv.quoteId) refs.push({ label: 'Quotation', value: inv.quote_number || inv.quoteId });

      const docInput: DocInput = {
        kind: inv.type === 'bill_of_supply' ? 'bill_of_supply' : 'tax_invoice',
        number: inv.number || 'INV/26-27/0001',
        date: inv.date || new Date().toISOString().split('T')[0],
        dueDate: inv.due_date || inv.dueDate || null,
        placeOfSupply: billToStateCode,
        company: DEFAULT_HOPEPITOME_COMPANY,
        billTo: {
          name: billToName,
          company: billToCompany,
          address: billToAddress,
          gstin: billToGstin,
          stateCode: billToStateCode,
          phone: customer?.phone || null,
          email: customer?.email || null,
        },
        lines,
        totals: {
          subTotal,
          discountTotal,
          taxable,
          cgst,
          sgst,
          igst,
          roundOff: 0,
          grandTotal,
          inWords: amountInWords(grandTotal),
        },
        refs,
        payment: await (async () => {
          let vpa = DEFAULT_HOPEPITOME_COMPANY.upiId || 'service@hopepitome';
          let payeeName = DEFAULT_HOPEPITOME_COMPANY.legalName;
          let bank = {
            name: DEFAULT_HOPEPITOME_COMPANY.bankName || 'HDFC Bank Ltd',
            accountNo: DEFAULT_HOPEPITOME_COMPANY.bankAccount || '50200088991122',
            ifsc: DEFAULT_HOPEPITOME_COMPANY.bankIfsc || 'HDFC0001234',
            branch: DEFAULT_HOPEPITOME_COMPANY.bankBranch || 'Outer Ring Road, Bengaluru',
          };
          if (db) {
            try {
              const upiRow: any = await db.prepare("SELECT * FROM masters WHERE type = 'upiIds' AND status = 'active' ORDER BY is_default DESC, sort_order ASC LIMIT 1").first();
              if (upiRow?.data_json) {
                const u = JSON.parse(upiRow.data_json);
                if (u.vpa) vpa = u.vpa;
                if (u.payeeName) payeeName = u.payeeName;
              }
              const bankRow: any = await db.prepare("SELECT * FROM masters WHERE type = 'bankAccounts' AND status = 'active' ORDER BY is_default DESC, sort_order ASC LIMIT 1").first();
              if (bankRow?.data_json) {
                const b = JSON.parse(bankRow.data_json);
                bank = {
                  name: b.bankName || bankRow.name || bank.name,
                  accountNo: b.accountNo || bank.accountNo,
                  ifsc: b.ifsc || bank.ifsc,
                  branch: b.branch || bank.branch,
                };
              }
            } catch {}
          }
          return {
            balance: balanceDue,
            paid: Math.max(0, grandTotal - balanceDue),
            vpa,
            payeeName,
            showQr: balanceDue > 0,
            bank,
          };
        })(),
        terms: await (async () => {
          if (invData.terms || invData.termsText) return invData.terms || invData.termsText;
          if (db) {
            try {
              const { results } = await db.prepare("SELECT * FROM masters WHERE type = 'termsTemplates' AND status = 'active' ORDER BY is_default DESC, sort_order ASC").all();
              const match = (results || []).find((r: any) => {
                try { return JSON.parse(r.data_json || '{}').docType === 'invoice'; } catch { return false; }
              }) || (results || [])[0];
              if (match?.data_json) {
                const t = JSON.parse(match.data_json);
                if (t.text) return t.text;
              }
            } catch {}
          }
          return '1. Payment is strictly due by the due date specified on this tax invoice.\n2. Please mention invoice number when remitting payments via NEFT/RTGS or UPI.\n3. Remittances payable to "HopEpitome Strategics".\n4. Late payments subject to interest @ 18% p.a. in terms of the MSMED Act.';
        })(),
        notes: invData.notes || 'Thank you for your business. HopEpitome Strategics — Elevating Enterprise Excellence.',
      };
      return docInput;
    }

    return null;
  }

  // 12. Document Output Engine: /documents/:type/:id/:action
  const docMatch = path.match(/^\/documents\/([^/?]+)\/([^/?]+)(?:\/([^/?]+))?/);
  if (docMatch) {
    const docType = docMatch[1];
    const docId = docMatch[2];
    const action = docMatch[3] || 'preview';
    const docInput = await buildDocInput(docType, docId);
    if (!docInput) {
      return jsonRes({ type: 'https://salesphere.live/errors/not-found', title: 'Document not found', status: 404, code: 'NOT_FOUND' }, 404);
    }
    let html = await renderDocumentHtml(docInput);
    if (action === 'pdf' || url.searchParams.get('print') === 'true') {
      html += '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),350));</script>';
    }
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // 12b. /share-links
  if (path === '/share-links' || path === '/share-links/') {
    if (method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      const { documentType, documentId } = body;
      if (!documentType || !documentId) {
        return jsonRes({ type: 'https://salesphere.live/errors/validation', title: 'Missing document type or id', status: 422 }, 422);
      }
      const token = `${documentType}_${documentId}`;
      const publicUrl = `${url.origin}/s/${token}`;
      return jsonRes({ url: publicUrl, token });
    }
  }

  // 12c. /public/s/:token and /public/s/:token/:action
  const publicTokenMatch = path.match(/^\/public\/s\/([^/?]+)(?:\/([^/?]+))?/);
  if (publicTokenMatch) {
    const token = publicTokenMatch[1];
    const subAction = publicTokenMatch[2];
    const parsed = parseShareToken(token);
    if (!parsed) {
      return jsonRes({ type: 'https://salesphere.live/errors/not-found', title: 'Invalid token', status: 404 }, 404);
    }
    const docInput = await buildDocInput(parsed.type, parsed.id);
    if (!docInput) {
      return jsonRes({ type: 'https://salesphere.live/errors/not-found', title: 'Document not found', status: 404 }, 404);
    }

    if (subAction === 'pdf') {
      let html = await renderDocumentHtml(docInput);
      html += '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),350));</script>';
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    if (subAction === 'respond' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      if (docInput.kind === 'quotation' && body.type) {
        const newStatus = body.type === 'accept' ? 'accepted' : body.type === 'reject' ? 'rejected' : 'sent';
        if (db) {
          try {
            await db.prepare('UPDATE quotes SET status = ?, updated_at = ? WHERE id = ?').bind(newStatus, new Date().toISOString(), parsed.id).run();
          } catch (e) {}
        }
        const memQt = memoryStore.quotes.find((q) => q.id === parsed.id);
        if (memQt) memQt.status = newStatus;
      }
      return jsonRes({ outcome: 'recorded', status: 'ok' });
    }

    const html = await renderDocumentHtml(docInput);
    const grandTotalPaise = docInput.totals.grandTotal;
    const upiVpa = docInput.payment?.vpa || DEFAULT_HOPEPITOME_COMPANY.upiId || 'service@hopepitome';
    const upiPayee = docInput.payment?.payeeName || DEFAULT_HOPEPITOME_COMPANY.legalName;
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent(upiPayee)}&am=${(grandTotalPaise / 100).toFixed(2)}&cu=INR`;
    let qrSvg = '';
    try {
      qrSvg = await upiQrSvg(upiUri);
    } catch (e) {}

    const viewType = docInput.kind === 'quotation' ? 'quote' : docInput.kind === 'order' ? 'order' : 'invoice';
    return jsonRes({
      type: viewType,
      companyName: DEFAULT_HOPEPITOME_COMPANY.legalName,
      companyPhone: DEFAULT_HOPEPITOME_COMPANY.phone,
      poweredBy: true,
      html,
      number: docInput.number,
      validUntil: docInput.validUntil,
      totals: docInput.totals,
      actions: docInput.kind === 'quotation' ? ['accept', 'changes', 'reject'] : undefined,
      balanceDue: docInput.payment?.balance,
      paid: (docInput.payment?.balance ?? 0) === 0,
      upi: {
        uri: upiUri,
        amount: grandTotalPaise,
        qrSvg,
        vpa: upiVpa,
      },
    });
  }


  // 13. /admin/company (Requirement 4)
  if (path === '/admin/company' || path === '/admin/company/') {
    if (method === 'GET') {
      return jsonRes(memoryStore.company);
    }
    if (method === 'PUT' || method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      Object.assign(memoryStore.company, body);
      return jsonRes(memoryStore.company);
    }
  }

  // 14. /admin/masters/:type — Full D1 CRUD
  if (path.startsWith('/admin/masters/')) {
    const errRes = (status: number, code: string, message: string) =>
      jsonRes({ title: message, status, code, message }, status);
    const parseBody = async (req: Request) => await req.json().catch(() => ({}));
    if (!db) return errRes(500, 'DB_ERROR', 'Database not configured');
    const subParts = path.replace(/^\/admin\/masters\//, '').split('?')[0].split('/').filter(Boolean);
    const mType = decodeURIComponent(subParts[0] || '');
    const mId = subParts[1] ? decodeURIComponent(subParts[1]) : null;
    const mAction = subParts[2] ? decodeURIComponent(subParts[2]) : null;

    if (!mType) return errRes(400, 'BAD_REQUEST', 'Master type is required');

    const mapMasterRow = (r: any) => {
      let data: any = {};
      try {
        data = r.data_json ? JSON.parse(r.data_json) : {};
      } catch {}
      return {
        id: r.id,
        type: r.type,
        name: r.name,
        key: r.key ?? null,
        status: r.status || 'active',
        isDefault: Boolean(r.is_default),
        sortOrder: Number(r.sort_order ?? 0),
        data,
        version: Number(r.version ?? 1),
      };
    };

    // GET /admin/masters/:type
    if (method === 'GET' && !mId) {
      const { results } = await db
        .prepare('SELECT * FROM masters WHERE type = ? ORDER BY is_default DESC, sort_order ASC, name ASC')
        .bind(mType)
        .all();
      return jsonRes({ items: (results || []).map(mapMasterRow) });
    }

    // POST /admin/masters/:type/:id/activate | deactivate | set-default
    if (method === 'POST' && mId && mAction) {
      const existing: any = await db.prepare('SELECT * FROM masters WHERE id = ? AND type = ?').bind(mId, mType).first();
      if (!existing) return errRes(404, 'NOT_FOUND', 'Master item not found');

      if (mAction === 'activate' || mAction === 'deactivate') {
        const nextStatus = mAction === 'activate' ? 'active' : 'inactive';
        await db.prepare('UPDATE masters SET status = ?, version = version + 1 WHERE id = ? AND type = ?').bind(nextStatus, mId, mType).run();
        const updated: any = await db.prepare('SELECT * FROM masters WHERE id = ? AND type = ?').bind(mId, mType).first();
        return jsonRes(mapMasterRow(updated));
      }
      if (mAction === 'set-default') {
        await db.prepare('UPDATE masters SET is_default = 0 WHERE type = ?').bind(mType).run();
        await db.prepare('UPDATE masters SET is_default = 1, version = version + 1 WHERE id = ? AND type = ?').bind(mId, mType).run();
        const updated: any = await db.prepare('SELECT * FROM masters WHERE id = ? AND type = ?').bind(mId, mType).first();
        return jsonRes(mapMasterRow(updated));
      }
      return errRes(404, 'NOT_FOUND', 'Unknown master action');
    }

    // POST /admin/masters/:type (Create)
    if (method === 'POST' && !mId) {
      const body = (await parseBody(request)) as any;
      const name = String(body.name || '').trim();
      if (!name) return errRes(422, 'VALIDATION_ERROR', 'Name is required');

      const rawKey = body.key !== undefined && body.key !== null ? String(body.key).trim() : '';
      const key = rawKey || null;
      if (key) {
        const dup: any = await db
          .prepare('SELECT id FROM masters WHERE type = ? AND LOWER(key) = LOWER(?)')
          .bind(mType, key)
          .first();
        if (dup) return errRes(422, 'DUPLICATE_KEY', `Code/Key "${key}" already exists in ${mType}`);
      }

      const data = body.data && typeof body.data === 'object' ? { ...body.data } : {};
      if (mType === 'products') {
        const ratePaise = Number(data.ratePaise ?? 0);
        if (!Number.isFinite(ratePaise) || ratePaise <= 0) {
          return errRes(422, 'VALIDATION_ERROR', 'Product rate must be greater than 0');
        }
        if (data.hsnSac && !/^\d{4,8}$/.test(String(data.hsnSac).trim())) {
          return errRes(422, 'VALIDATION_ERROR', 'HSN/SAC must be 4 to 8 digits');
        }
      }

      const isDefault = body.isDefault ? 1 : 0;
      if (isDefault) {
        await db.prepare('UPDATE masters SET is_default = 0 WHERE type = ?').bind(mType).run();
      }

      const maxRow: any = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS mx FROM masters WHERE type = ?').bind(mType).first();
      const sortOrder = body.sortOrder !== undefined ? Number(body.sortOrder) : Number(maxRow?.mx ?? 0) + 1;
      const MASTER_PREFIX: Record<string, string> = {
        products: 'prod',
        upiIds: 'upi',
        bankAccounts: 'bank',
        paymentTerms: 'pt',
        leadSources: 'src',
        pipelineStages: 'stg',
        lostReasons: 'lost',
        junkReasons: 'junk',
        callOutcomes: 'call',
        messageTemplates: 'tpl',
        termsTemplates: 'term',
        territories: 'terr',
        units: 'unit',
        tags: 'tag',
        customerGroups: 'grp',
      };
      const prefix = MASTER_PREFIX[mType] || mType.slice(0, 4).toLowerCase();
      const newId = `${prefix}-${Date.now()}`;

      await db
        .prepare('INSERT INTO masters (id, type, name, key, status, is_default, data_json, sort_order, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)')
        .bind(newId, mType, name, key, 'active', isDefault, JSON.stringify(data), sortOrder)
        .run();

      const created: any = await db.prepare('SELECT * FROM masters WHERE id = ?').bind(newId).first();
      return jsonRes(mapMasterRow(created), 201);
    }

    // PATCH /admin/masters/:type/:id (Update)
    if (method === 'PATCH' && mId) {
      const existing: any = await db.prepare('SELECT * FROM masters WHERE id = ? AND type = ?').bind(mId, mType).first();
      if (!existing) return errRes(404, 'NOT_FOUND', 'Master item not found');

      const body = (await parseBody(request)) as any;
      const name = body.name !== undefined ? String(body.name).trim() : existing.name;
      if (!name) return errRes(422, 'VALIDATION_ERROR', 'Name is required');

      const key = body.key !== undefined ? (String(body.key || '').trim() || null) : existing.key;
      if (key) {
        const dup: any = await db
          .prepare('SELECT id FROM masters WHERE type = ? AND LOWER(key) = LOWER(?) AND id != ?')
          .bind(mType, key, mId)
          .first();
        if (dup) return errRes(422, 'DUPLICATE_KEY', `Code/Key "${key}" already exists in ${mType}`);
      }

      let existingData: any = {};
      try {
        existingData = existing.data_json ? JSON.parse(existing.data_json) : {};
      } catch {}
      const data = body.data !== undefined && typeof body.data === 'object' ? { ...existingData, ...body.data } : existingData;

      if (mType === 'products') {
        const ratePaise = Number(data.ratePaise ?? 0);
        if (!Number.isFinite(ratePaise) || ratePaise <= 0) {
          return errRes(422, 'VALIDATION_ERROR', 'Product rate must be greater than 0');
        }
        if (data.hsnSac && !/^\d{4,8}$/.test(String(data.hsnSac).trim())) {
          return errRes(422, 'VALIDATION_ERROR', 'HSN/SAC must be 4 to 8 digits');
        }
      }

      const isDefault = body.isDefault !== undefined ? (body.isDefault ? 1 : 0) : existing.is_default;
      if (isDefault) {
        await db.prepare('UPDATE masters SET is_default = 0 WHERE type = ?').bind(mType).run();
      }
      const sortOrder = body.sortOrder !== undefined ? Number(body.sortOrder) : Number(existing.sort_order ?? 0);

      let nextStatus = existing.status || 'active';
      if (body.status !== undefined) {
        const s = String(body.status).trim().toLowerCase();
        if (s !== 'active' && s !== 'inactive') {
          return errRes(422, 'VALIDATION_ERROR', 'Status must be "active" or "inactive"');
        }
        nextStatus = s;
      } else if (body.isActive !== undefined) {
        nextStatus = body.isActive ? 'active' : 'inactive';
      }

      await db
        .prepare('UPDATE masters SET name = ?, key = ?, status = ?, is_default = ?, data_json = ?, sort_order = ?, version = version + 1 WHERE id = ? AND type = ?')
        .bind(name, key, nextStatus, isDefault, JSON.stringify(data), sortOrder, mId, mType)
        .run();

      const updated: any = await db.prepare('SELECT * FROM masters WHERE id = ? AND type = ?').bind(mId, mType).first();
      return jsonRes(mapMasterRow(updated));
    }

    // DELETE /admin/masters/:type/:id (Block if used)
    if (method === 'DELETE' && mId) {
      const existing: any = await db.prepare('SELECT * FROM masters WHERE id = ? AND type = ?').bind(mId, mType).first();
      if (!existing) return errRes(404, 'NOT_FOUND', 'Master item not found');

      let useCount = 0;
      let useEntity = 'records';
      const keyVal = existing.key || mId;
      const likeId = `%${mId}%`;
      const likeName = `%${existing.name}%`;

      if (mType === 'products') {
        const lRef: any = await db.prepare('SELECT COUNT(*) AS cnt FROM leads WHERE deleted_at IS NULL AND (interest_product_id = ? OR data_json LIKE ?)').bind(mId, likeId).first();
        const qRef: any = await db.prepare('SELECT COUNT(*) AS cnt FROM quotes WHERE deleted_at IS NULL AND data_json LIKE ?').bind(likeId).first();
        const oRef: any = await db.prepare('SELECT COUNT(*) AS cnt FROM orders WHERE deleted_at IS NULL AND data_json LIKE ?').bind(likeId).first();
        const iRef: any = await db.prepare('SELECT COUNT(*) AS cnt FROM invoices WHERE deleted_at IS NULL AND data_json LIKE ?').bind(likeId).first();
        useCount = Number(lRef?.cnt ?? 0) + Number(qRef?.cnt ?? 0) + Number(oRef?.cnt ?? 0) + Number(iRef?.cnt ?? 0);
      } else if (mType === 'leadSources') {
        const lRef: any = await db.prepare('SELECT COUNT(*) AS cnt FROM leads WHERE deleted_at IS NULL AND (source_id = ? OR data_json LIKE ?)').bind(mId, likeId).first();
        useCount = Number(lRef?.cnt ?? 0);
        useEntity = useCount === 1 ? 'lead' : 'leads';
      } else if (mType === 'pipelineStages') {
        const lRef: any = await db.prepare('SELECT COUNT(*) AS cnt FROM leads WHERE deleted_at IS NULL AND LOWER(stage) = LOWER(?)').bind(keyVal).first();
        useCount = Number(lRef?.cnt ?? 0);
        useEntity = useCount === 1 ? 'lead' : 'leads';
      } else if (mType === 'bankAccounts') {
        const pRef: any = await db.prepare('SELECT COUNT(*) AS cnt FROM payments WHERE deleted_at IS NULL AND data_json LIKE ?').bind(likeId).first();
        useCount = Number(pRef?.cnt ?? 0);
        useEntity = useCount === 1 ? 'payment' : 'payments';
      } else if (mType === 'units') {
        const pRef: any = await db.prepare("SELECT COUNT(*) AS cnt FROM masters WHERE type = 'products' AND data_json LIKE ?").bind(likeName).first();
        useCount = Number(pRef?.cnt ?? 0);
        useEntity = useCount === 1 ? 'product' : 'products';
      } else if (mType === 'territories' || mType === 'tags' || mType === 'customerGroups') {
        const lRef: any = await db.prepare('SELECT COUNT(*) AS cnt FROM leads WHERE deleted_at IS NULL AND data_json LIKE ?').bind(likeId).first();
        const cRef: any = await db.prepare('SELECT COUNT(*) AS cnt FROM customers WHERE deleted_at IS NULL AND data_json LIKE ?').bind(likeId).first();
        useCount = Number(lRef?.cnt ?? 0) + Number(cRef?.cnt ?? 0);
      }

      if (useCount > 0) {
        return errRes(422, 'MASTER_IN_USE', `In use by ${useCount} ${useEntity}. Deactivate it instead.`);
      }

      await db.prepare('DELETE FROM masters WHERE id = ? AND type = ?').bind(mId, mType).run();
      return jsonRes({ success: true, id: mId });
    }

    return errRes(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  // 15. /admin/google (Requirement 4)
  if (path === '/admin/google' || path === '/admin/google/') {
    return jsonRes({
      status: 'connected',
      email: 'admin@salesphere.live',
      features: { drive: true, gmail: true, calendar: true, sheets: true },
      lastError: null,
    });
  }

  // 16. /admin/sheets (Requirement 4)
  if (path === '/admin/sheets' || path === '/admin/sheets/') {
    return jsonRes({
      items: [
        { id: 'sht-1', spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', tab: 'Leads', mode: 'instant', status: 'ok', lastRunAt: new Date().toISOString(), lastRunStatus: 'ok' },
      ],
    });
  }

  // 17. /admin/import-errors (Requirement 4)
  if (path === '/admin/import-errors' || path === '/admin/import-errors/') {
    return jsonRes({ items: [] });
  }

  // 18. /admin/number-series (Requirement 4 & Issue 1)
  if (path === '/admin/number-series' || path === '/admin/number-series/' || path.startsWith('/admin/number-series/')) {
    if (method === 'PUT') {
      const docType = path.split('/').pop();
      const body = await parseBody(request);
      return jsonRes({ success: true, docType, ...body });
    }

    let quoteLast = 'QT/26-27/0001';
    let invLast = 'INV/26-27/0002';
    let payLast = 'RCT/26-27/0001';
    let ordLast = 'SO/26-27/0001';

    if (db) {
      try {
        const qRow: any = await db.prepare("SELECT display_number FROM quotes WHERE display_number LIKE 'QT/26-27/%' AND deleted_at IS NULL ORDER BY display_number DESC LIMIT 1").first();
        if (qRow?.display_number) quoteLast = qRow.display_number;
        const iRow: any = await db.prepare("SELECT number FROM invoices WHERE number LIKE 'INV/26-27/%' AND deleted_at IS NULL ORDER BY number DESC LIMIT 1").first();
        if (iRow?.number) invLast = iRow.number;
        const pRow: any = await db.prepare("SELECT receipt_no FROM payments WHERE receipt_no LIKE 'RCT/26-27/%' AND deleted_at IS NULL ORDER BY receipt_no DESC LIMIT 1").first();
        if (pRow?.receipt_no) payLast = pRow.receipt_no;
        const oRow: any = await db.prepare("SELECT number FROM orders WHERE number LIKE 'SO/26-27/%' AND deleted_at IS NULL ORDER BY number DESC LIMIT 1").first();
        if (oRow?.number) ordLast = oRow.number;
      } catch (e) {}
    }

    const calcNext = (last: string, prefix: string, pad = 4) => {
      const match = last ? last.match(/(\d+)$/) : null;
      const seq = match ? parseInt(match[1], 10) + 1 : 1;
      return `${prefix}${String(seq).padStart(pad, '0')}`;
    };

    return jsonRes({
      items: [
        { id: 'ns-1', docType: 'quote', prefix: 'QT/26-27/', pad: 4, fyReset: true, lastNumber: quoteLast, nextNumber: calcNext(quoteLast, 'QT/26-27/', 4) },
        { id: 'ns-2', docType: 'invoice', prefix: 'INV/26-27/', pad: 4, fyReset: true, lastNumber: invLast, nextNumber: calcNext(invLast, 'INV/26-27/', 4) },
        { id: 'ns-3', docType: 'payment', prefix: 'RCT/26-27/', pad: 4, fyReset: true, lastNumber: payLast, nextNumber: calcNext(payLast, 'RCT/26-27/', 4) },
        { id: 'ns-4', docType: 'order', prefix: 'SO/26-27/', pad: 4, fyReset: true, lastNumber: ordLast, nextNumber: calcNext(ordLast, 'SO/26-27/', 4) },
      ],
    });
  }

  // 19. /admin/audit/search (Requirement 4)
  if (path === '/admin/audit/search' || path === '/admin/audit/search/' || path.startsWith('/admin/audit/search')) {
    return jsonRes({ items: memoryStore.auditLog });
  }

  // 20. /admin/users
  if (path === '/admin/users' || path === '/admin/users/') {
    return jsonRes({
      items: [
        {
          id: 'u_admin',
          username: 'admin',
          fullName: 'Owner Admin',
          role: 'admin',
          roleLabel: 'Admin',
          status: 'active',
          lastLoginAt: new Date().toISOString(),
          isSupport: false,
        },
        {
          id: 'u_sales_mgr',
          username: 'manager',
          fullName: 'Suresh Kumar',
          role: 'sales_manager',
          roleLabel: 'Sales Manager',
          status: 'active',
          lastLoginAt: '2026-11-22T10:15:00Z',
          isSupport: false,
        },
      ],
    });
  }

  // 21. /admin/settings/*
  if (path.startsWith('/admin/settings/')) {
    const sec = path.replace(/^\/admin\/settings\//, '').split('/')[0];
    if (sec === 'mode') return jsonRes({ data: { mode: 'solo' }, mode: 'solo' });
    if (sec === 'modules') return jsonRes({ data: { orders: true }, orders: true });
    if (sec === 'sla') return jsonRes({ data: { minutes: 15, calendar: { start: '09:00', end: '19:00' } } });
    if (sec === 'sales') return jsonRes({ data: { validDays: 15, discountLimits: { sales_exec: 10, sales_manager: 20 } } });
    if (sec === 'permissions') return jsonRes({ data: { execPaymentsEnabled: true }, execPaymentsEnabled: true });
    if (sec === 'terminology') return jsonRes({ data: {} });
    if (sec === 'finance') return jsonRes({ data: { lockDate: null } });
    return jsonRes({ data: {} });
  }

  function formatISTDate(iso: string): string {
    try {
      let s = String(iso).trim();
      if (!s.endsWith('Z') && !s.includes('+')) {
        s = s.includes('T') ? s + 'Z' : s.replace(' ', 'T') + 'Z';
      }
      const d = new Date(s);
      if (isNaN(d.getTime())) return iso;
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return iso;
    }
  }

  const formatIsoUtc = (ts: string) => {
    if (!ts) return new Date().toISOString();
    if (ts.endsWith('Z') || ts.includes('+')) return ts;
    return ts.includes('T') ? ts + 'Z' : ts.replace(' ', 'T') + 'Z';
  };

  // 22. /timeline/:type/:id
  const timelineMatch = path.match(/^\/timeline\/([^/?]+)\/([^/?]+)/);
  if (timelineMatch) {
    const recordType = timelineMatch[1];
    const recordId = timelineMatch[2];
    const typeFilter = url.searchParams.get('types');

    let items: any[] = [];
    if (db) {
      try {
        let sql = 'SELECT * FROM timeline WHERE record_type = ? AND record_id = ?';
        const params: any[] = [recordType, recordId];
        if (typeFilter) {
          sql += ' AND type = ?';
          params.push(typeFilter);
        }
        sql += ' ORDER BY created_at DESC LIMIT 100';
        const { results } = await db.prepare(sql).bind(...params).all();
        if (results && results.length > 0) {
          items = results.map((r: any) => ({
            id: r.id,
            type: r.type,
            status: 'completed',
            note: r.details || r.summary,
            summary: r.summary,
            outcomeLabel: r.details && ['Connected', 'No answer', 'Busy', 'Wrong number', 'Call back later'].includes(r.details) ? r.details : null,
            userName: r.user_name || 'Owner Admin',
            occurredAt: formatIsoUtc(r.created_at),
          }));
        }
      } catch (e) {
        console.error('D1 timeline query error:', e);
      }
    }
    return jsonRes({ items });
  }

  // 22b. /activities
  const actOutcomeMatch = path.match(/^\/activities\/([^/?]+)\/outcome$/);
  if (actOutcomeMatch && method === 'POST') {
    const actId = actOutcomeMatch[1];
    const body = (await request.json().catch(() => ({}))) as any;
    const { outcomeId, note, followUp } = body;

    const outcomeLabels: Record<string, string> = {
      connected: 'Connected',
      no_answer: 'No answer',
      busy: 'Busy',
      wrong_number: 'Wrong number',
      call_back_later: 'Call back later',
    };
    const outcomeLabel = outcomeLabels[outcomeId] || outcomeId || 'Completed';

    if (db) {
      try {
        let recType = 'lead';
        let recId = '';
        const { results: actRows } = await db.prepare('SELECT record_type, record_id FROM timeline WHERE id = ?').bind(actId).all();
        if (actRows?.[0]) {
          recType = actRows[0].record_type;
          recId = actRows[0].record_id;
        }

        // If followUp requested, schedule follow-up
        if (followUp && followUp.dueAt) {
          const fuId = 'fu-' + Date.now();
          let partyName = 'Client';
          if (recType === 'lead') {
            const { results: lRows } = await db.prepare('SELECT name FROM leads WHERE id = ?').bind(recId).all();
            if (lRows?.[0]?.name) partyName = lRows[0].name;
          } else if (recType === 'customer') {
            const { results: cRows } = await db.prepare('SELECT display_name FROM customers WHERE id = ?').bind(recId).all();
            if (cRows?.[0]?.display_name) partyName = cRows[0].display_name;
          }

          await db.prepare(`
            INSERT INTO follow_ups (id, record_type, record_id, party_name, type, due_at, note, assignee, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Owner Admin', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(fuId, recType, recId, partyName, followUp.type || 'call', followUp.dueAt, note || null).run();

          // Timeline entry for follow-up scheduled
          await db.prepare(`
            INSERT INTO timeline (id, record_type, record_id, type, summary, details, user_name, created_at)
            VALUES (?, ?, ?, 'system', ?, ?, 'Owner Admin', CURRENT_TIMESTAMP)
          `).bind('act-' + Date.now(), recType, recId, `Follow-up scheduled for ${formatISTDate(followUp.dueAt)}`, note || null).run();
        }

        // Update or insert timeline entry with call outcome
        await db.prepare(`
          INSERT INTO timeline (id, record_type, record_id, type, summary, details, user_name, created_at)
          VALUES (?, ?, ?, 'call', ?, ?, 'Owner Admin', CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET summary = excluded.summary, details = excluded.details
        `).bind(actId, recType, recId, `Call (${outcomeLabel})`, note || outcomeLabel).run();
      } catch (e) {
        console.error('D1 activity outcome error:', e);
      }
    }
    return jsonRes({ success: true, activityId: actId, outcomeLabel });
  }

  const actItemMatch = path.match(/^\/activities\/([^/?]+)$/);
  if (actItemMatch) {
    const actId = actItemMatch[1];
    if (method === 'PATCH') {
      const body = (await request.json().catch(() => ({}))) as any;
      if (db && body.note !== undefined) {
        try {
          await db.prepare('UPDATE timeline SET details = ? WHERE id = ?').bind(body.note, actId).run();
        } catch (e) {
          console.error('D1 update activity error:', e);
        }
      }
      return jsonRes({ success: true, id: actId, note: body.note });
    }
    if (method === 'DELETE') {
      if (db) {
        try {
          await db.prepare('DELETE FROM timeline WHERE id = ?').bind(actId).run();
        } catch (e) {
          console.error('D1 delete activity error:', e);
        }
      }
      return jsonRes({ success: true, id: actId });
    }
  }

  if (path === '/activities' || path === '/activities/') {
    if (method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      const { recordType, recordId, type = 'note', note = '', summary = '', clientId } = body;
      const actId = clientId || 'act-' + Date.now();
      const userName = 'Owner Admin';
      const sum = summary || (type === 'note' ? 'Note added' : (type === 'call' ? 'Call logged' : `${type.toUpperCase()} activity logged`));
      const details = note || null;

      if (db && recordType && recordId) {
        try {
          await db.prepare(`
            INSERT INTO timeline (id, record_type, record_id, type, summary, details, user_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(actId, recordType, recordId, type, sum, details, userName).run();
        } catch (e) {
          console.error('D1 activity insert error:', e);
        }
      }
      return jsonRes({ id: actId, success: true, clientId, type, note, occurredAt: new Date().toISOString() }, 201);
    }
  }

  // 22c. /follow-ups
  const fuItemMatch = path.match(/^\/follow-ups\/([^/?]+)$/);
  if (fuItemMatch) {
    const fuId = fuItemMatch[1];
    if (method === 'PATCH') {
      const body = (await request.json().catch(() => ({}))) as any;
      const { status, dueAt, note } = body;
      if (db) {
        try {
          const existing: any = await db.prepare('SELECT * FROM follow_ups WHERE id = ?').bind(fuId).first();
          const completedAt = status === 'completed' ? new Date().toISOString() : null;
          await db.prepare(`
            UPDATE follow_ups
            SET status = COALESCE(?, status),
                due_at = COALESCE(?, due_at),
                note = COALESCE(?, note),
                completed_at = COALESCE(?, completed_at),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(status || null, dueAt || null, note !== undefined ? note : null, completedAt, fuId).run();

          if (existing) {
            if (dueAt && dueAt !== existing.due_at) {
              await db.prepare(`
                INSERT INTO timeline (id, record_type, record_id, type, summary, details, user_name, created_at)
                VALUES (?, ?, ?, 'system', ?, ?, 'Owner Admin', CURRENT_TIMESTAMP)
              `).bind(
                'act-' + Date.now(),
                existing.record_type,
                existing.record_id,
                `Follow-up rescheduled from ${formatISTDate(existing.due_at)} to ${formatISTDate(dueAt)}`,
                null,
              ).run();
              // Clear old follow-up notifications so new due time can trigger fresh ones
              await db.prepare('DELETE FROM notifications WHERE id IN (?, ?)').bind(`notif-fu-soon-${fuId}`, `notif-fu-overdue-${fuId}`).run();
            }

            if (status === 'completed') {
              await db.prepare(`
                INSERT INTO timeline (id, record_type, record_id, type, summary, details, user_name, created_at)
                VALUES (?, ?, ?, 'system', ?, ?, 'Owner Admin', CURRENT_TIMESTAMP)
              `).bind('act-' + (Date.now() + 1), existing.record_type, existing.record_id, `Follow-up completed (${existing.type})`, null).run();
              await db.prepare('UPDATE notifications SET is_read = 1 WHERE id IN (?, ?)').bind(`notif-fu-soon-${fuId}`, `notif-fu-overdue-${fuId}`).run();
            }
          }
        } catch (e) {
          console.error('D1 follow-up patch error:', e);
        }
      }
      return jsonRes({ success: true, id: fuId, status });
    }
    if (method === 'DELETE') {
      if (db) {
        try {
          await db.prepare('DELETE FROM follow_ups WHERE id = ?').bind(fuId).run();
          await db.prepare('DELETE FROM notifications WHERE id IN (?, ?)').bind(`notif-fu-soon-${fuId}`, `notif-fu-overdue-${fuId}`).run();
        } catch (e) {
          console.error('D1 follow-up delete error:', e);
        }
      }
      return jsonRes({ success: true, id: fuId });
    }
  }

  if (path === '/follow-ups' || path === '/follow-ups/') {
    if (method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      const { recordType, recordId, dueAt, type = 'call', note = '', assignee = 'Owner Admin' } = body;
      if (!dueAt) return jsonRes({ title: 'Missing dueAt', status: 422 }, 422);

      const fuId = body.clientId || 'fu-' + Date.now();
      let partyName = 'Client';
      if (db && recordType && recordId) {
        try {
          if (recordType === 'lead') {
            const { results } = await db.prepare('SELECT name FROM leads WHERE id = ?').bind(recordId).all();
            if (results?.[0]?.name) partyName = results[0].name;
          } else if (recordType === 'customer') {
            const { results } = await db.prepare('SELECT display_name FROM customers WHERE id = ?').bind(recordId).all();
            if (results?.[0]?.display_name) partyName = results[0].display_name;
          }

          await db.prepare(`
            INSERT INTO follow_ups (id, record_type, record_id, party_name, type, due_at, note, assignee, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(fuId, recordType, recordId, partyName, type, dueAt, note || null, assignee).run();

          // Add timeline entry
          await db.prepare(`
            INSERT INTO timeline (id, record_type, record_id, type, summary, details, user_name, created_at)
            VALUES (?, ?, ?, 'system', ?, ?, 'Owner Admin', CURRENT_TIMESTAMP)
          `).bind('act-' + Date.now(), recordType, recordId, `Follow-up scheduled for ${formatISTDate(dueAt)}`, note || null).run();
        } catch (e) {
          console.error('D1 follow-up insert error:', e);
        }
      }
      return jsonRes({ id: fuId, recordType, recordId, partyName, type, dueAt, note, assignee, status: 'pending' }, 201);
    }

    if (method === 'GET') {
      const recordType = url.searchParams.get('recordType');
      const recordId = url.searchParams.get('recordId');
      const status = url.searchParams.get('status');

      let items: any[] = [];
      if (db) {
        try {
          let sql = 'SELECT * FROM follow_ups WHERE 1=1';
          const params: any[] = [];
          if (recordType) {
            sql += ' AND record_type = ?';
            params.push(recordType);
          }
          if (recordId) {
            sql += ' AND record_id = ?';
            params.push(recordId);
          }
          if (status) {
            sql += ' AND status = ?';
            params.push(status);
          }
          sql += ' ORDER BY due_at ASC';
          const { results } = await db.prepare(sql).bind(...params).all();
          if (results) {
            items = results.map((r: any) => ({
              id: r.id,
              recordType: r.record_type,
              recordId: r.record_id,
              partyName: r.party_name,
              customer: r.party_name,
              type: r.type,
              dueAt: r.due_at,
              note: r.note,
              title: r.note || `${(r.type || 'call').toUpperCase()} follow-up`,
              assignee: r.assignee,
              status: r.status,
              completed: r.status === 'completed',
              completedAt: r.completed_at,
              createdAt: r.created_at,
            }));
          }
        } catch (e) {
          console.error('D1 follow-ups get error:', e);
        }
      }
      return jsonRes({ items });
    }
  }

  // 22d. /messages/whatsapp
  if (path === '/messages/whatsapp' || path === '/messages/whatsapp/') {
    if (method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      const { recordType, recordId, text = '' } = body;

      let phone = '';
      let partyName = 'Customer';
      if (db && recordType && recordId) {
        try {
          if (recordType === 'lead') {
            const { results } = await db.prepare('SELECT name, phone FROM leads WHERE id = ?').bind(recordId).all();
            if (results?.[0]) {
              partyName = results[0].name || partyName;
              phone = results[0].phone || '';
            }
          } else if (recordType === 'customer') {
            const { results } = await db.prepare('SELECT display_name, phone, data_json FROM customers WHERE id = ?').bind(recordId).all();
            if (results?.[0]) {
              partyName = results[0].display_name || partyName;
              phone = results[0].phone || '';
              if (!phone && results[0].data_json) {
                try {
                  const data = JSON.parse(results[0].data_json);
                  phone = data.contacts?.[0]?.phone || '';
                } catch (e) {}
              }
            }
          }

          // Insert timeline entry
          await db.prepare(`
            INSERT INTO timeline (id, record_type, record_id, type, summary, details, user_name, created_at)
            VALUES (?, ?, ?, 'whatsapp', ?, ?, 'Owner Admin', CURRENT_TIMESTAMP)
          `).bind('act-' + Date.now(), recordType, recordId, `WhatsApp message sent to ${partyName}`, text).run();
        } catch (e) {
          console.error('D1 whatsapp message log error:', e);
        }
      }

      let digits = phone.replace(/\D/g, '');
      if (digits.length === 10) digits = '91' + digits;
      else if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1);

      const waUrl = digits
        ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;

      return jsonRes({ success: true, url: waUrl });
    }
  }

  // 22e. /jobs/:id
  if (path.startsWith('/jobs/')) {
    const jobId = path.replace(/^\/jobs\//, '').split('?')[0];
    const match = jobId.match(/^job-stmt-([^-]+)-(\w+)/);
    const custId = match ? match[1] : 'cust-1';
    const fmt = match ? match[2] : 'pdf';
    return jsonRes({
      status: 'done',
      result: {
        url: `/api/v1/customers/${custId}/statement/file?format=${fmt}`,
        name: `Statement_${custId}.${fmt === 'xlsx' ? 'xlsx' : 'pdf'}`,
      },
    });
  }

  // 22f. /customers/:id/statement/file
  const stmtFileMatch = path.match(/^\/customers\/([^/?]+)\/statement\/file/);
  if (stmtFileMatch) {
    const custId = stmtFileMatch[1];
    const fmt = url.searchParams.get('format') || 'pdf';
    if (fmt === 'xlsx' || fmt === 'csv') {
      const csvContent = 'Date,Particulars,Document,Debit (₹),Credit (₹),Balance (₹)\n2026-11-15,Tax Invoice,INV/26-27/0001,29500.00,0.00,29500.00\n2026-11-15,Payment Receipt,RCT/26-27/0001,0.00,29500.00,0.00\n2026-11-24,Tax Invoice,INV/26-27/0004,101539.00,0.00,101539.00\n2026-11-24,Tax Invoice,INV/26-27/0008,101539.00,0.00,203078.00\n';
      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Statement_${custId}.csv"`,
        },
      });
    }
    const htmlStatement = `<!doctype html><html><head><meta charset="utf-8"><title>Statement of Account</title><style>body{font-family:sans-serif;padding:30px;color:#202820;}table{width:100%;border-collapse:collapse;margin-top:20px;}th,td{border:1px solid #DCE7D9;padding:8px 12px;font-size:13px;}th{background:#F5F9F2;text-align:left;}</style></head><body><h2>HopEpitome Strategics - Statement of Account</h2><p>Customer ID: ${custId}</p><table><thead><tr><th>Date</th><th>Particulars</th><th>Document</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead><tbody><tr><td>2026-11-15</td><td>Tax Invoice</td><td>INV/26-27/0001</td><td style="text-align:right">₹29,500.00</td><td style="text-align:right">-</td><td style="text-align:right">₹29,500.00</td></tr><tr><td>2026-11-15</td><td>Payment Receipt</td><td>RCT/26-27/0001</td><td style="text-align:right">-</td><td style="text-align:right">₹29,500.00</td><td style="text-align:right">₹0.00</td></tr><tr><td>2026-11-24</td><td>Tax Invoice</td><td>INV/26-27/0004</td><td style="text-align:right">₹1,01,539.00</td><td style="text-align:right">-</td><td style="text-align:right">₹1,01,539.00</td></tr><tr><td>2026-11-24</td><td>Tax Invoice</td><td>INV/26-27/0008</td><td style="text-align:right">₹1,01,539.00</td><td style="text-align:right">-</td><td style="text-align:right">₹2,03,078.00</td></tr></tbody></table><script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));</script></body></html>`;
    return new Response(htmlStatement, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // 23. /search
  if (path.startsWith('/search')) {
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();
    if (!q || q.length < 2) {
      return jsonRes({ q, groups: {} });
    }

    const leadHits = memoryStore.leads
      .filter((l) => l.name.toLowerCase().includes(q) || (l.phone && l.phone.includes(q)) || (l.email && l.email.toLowerCase().includes(q)))
      .map((l) => ({ id: l.id, title: l.name, subtitle: l.phone || l.email, link: `/leads/${l.id}` }));

    const custHits = memoryStore.customers
      .filter((c) => c.displayName.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q)) || (c.gstin && c.gstin.toLowerCase().includes(q)))
      .map((c) => ({ id: c.id, title: c.displayName, subtitle: c.code + (c.gstin ? ` · GSTIN ${c.gstin}` : ''), link: `/customers/${c.id}` }));

    const quoteHits = memoryStore.quotes
      .filter((qt) => (qt.displayNumber && qt.displayNumber.toLowerCase().includes(q)) || qt.partyName.toLowerCase().includes(q))
      .map((qt) => ({ id: qt.id, title: qt.displayNumber, subtitle: qt.partyName, link: `/sales/quotes/${qt.id}` }));

    const invHits = memoryStore.invoices
      .filter((i) => (i.number && i.number.toLowerCase().includes(q)) || i.customerName.toLowerCase().includes(q))
      .map((i) => ({ id: i.id, title: i.number, subtitle: i.customerName, link: `/sales/invoices/${i.id}` }));

    const payHits = memoryStore.payments
      .filter((p) => (p.receiptNo && p.receiptNo.toLowerCase().includes(q)) || p.customerName.toLowerCase().includes(q) || (p.reference && p.reference.toLowerCase().includes(q)))
      .map((p) => ({ id: p.id, title: p.receiptNo, subtitle: p.customerName, link: `/sales/payments/${p.id}` }));

    const groups: Record<string, any[]> = {};
    if (leadHits.length) groups.leads = leadHits;
    if (custHits.length) groups.customers = custHits;
    if (quoteHits.length) groups.quotes = quoteHits;
    if (invHits.length) groups.invoices = invHits;
    if (payHits.length) groups.payments = payHits;

    return jsonRes({ q, groups });
  }

  // 24. /reports
  if (path === '/reports' || path === '/reports/' || path.startsWith('/reports/')) {
    return jsonRes({
      items: [
        { id: 'RPT-001', name: 'Sales Pipeline & Conversion' },
        { id: 'RPT-002', name: 'Monthly Receivables & Ageing' },
        { id: 'RPT-003', name: 'Collections by Payment Mode' },
      ],
      pipeline: [
        { stage: 'new', label: 'New', count: 1, value: 35000000 },
        { stage: 'contacted', label: 'Contacted', count: 1, value: 24000000 },
        { stage: 'interested', label: 'Interested', count: 1, value: 18000000 },
        { stage: 'quotation_sent', label: 'Quotation Sent', count: 0, value: 0 },
        { stage: 'negotiation', label: 'Negotiation', count: 0, value: 0 },
        { stage: 'won', label: 'Won', count: 0, value: 0 },
        { stage: 'lost', label: 'Lost', count: 0, value: 0 },
      ],
      conversionRate: 67,
      totalPipelineValue: 77000000,
    });
  }

  // Default fallback
  return jsonRes({ items: [], data: {} });
}
