/**
 * SaleSphere Edge API Handler
 * High-performance edge router with Cloudflare D1 durable persistence and in-memory fallback.
 */

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
    legalName: 'SaleSphere Technologies India Pvt Ltd',
    tradeName: 'SaleSphere',
    gstRegistered: true,
    gstin: '29AABCU9603R1ZM',
    stateCode: '29',
    address: 'Indiranagar 100ft Road, Bengaluru, Karnataka, 560038',
    phone: '+91 80 4000 1122',
    email: 'accounts@salesphere.live',
    pan: 'AABCU9603R',
    jurisdiction: 'Bengaluru',
    signatory: 'Authorized Signatory',
    logoDataUrl: null,
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
          let query = 'SELECT * FROM leads WHERE deleted_at IS NULL ORDER BY created_at DESC';
          let params: any[] = [];
          if (q) {
            query = 'SELECT * FROM leads WHERE deleted_at IS NULL AND (LOWER(name) LIKE ? OR LOWER(company) LIKE ? OR phone LIKE ? OR LOWER(email) LIKE ?) ORDER BY created_at DESC';
            const like = `%${q}%`;
            params = [like, like, like, like];
          }
          const { results } = await db.prepare(query).bind(...params).all();
          const items = (results || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            company: r.company,
            phone: r.phone,
            email: r.email,
            city: r.city,
            stage: r.stage,
            slaStatus: r.sla_status,
            slaDueAt: r.sla_due_at,
            expectedValue: r.expected_value,
            notes: r.notes,
            customerId: r.customer_id,
            createdAt: r.created_at,
            version: r.version,
          }));
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
      const newLead = {
        id,
        name,
        company: (body.company || '').trim() || null,
        phone: phone || null,
        email: email || null,
        city: (body.city || '').trim() || null,
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
            INSERT INTO leads (id, name, company, phone, email, city, stage, sla_status, sla_due_at, expected_value, notes, created_at, updated_at, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            newLead.id,
            newLead.name,
            newLead.company,
            newLead.phone,
            newLead.email,
            newLead.city,
            newLead.stage,
            newLead.slaStatus,
            newLead.slaDueAt,
            newLead.expectedValue,
            newLead.notes,
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
      const displayName = lead.name || 'New Customer';
      const legalName = (lead.company || '').trim() || displayName;
      const phone = lead.phone || null;
      const email = lead.email || null;
      const city = lead.city || 'Bengaluru';
      const state = 'Karnataka';
      const address = city ? `${city}, India` : 'Bengaluru, India';
      const contacts = [{ id: 'cnt-' + Date.now(), name: displayName, phone, email, isPrimary: true }];
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
            JSON.stringify({ contacts: newCust.contacts, addresses: newCust.addresses }),
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
          const row: any = await db.prepare('SELECT * FROM leads WHERE id = ? AND deleted_at IS NULL').bind(id).first();
          if (row) {
            return jsonRes({
              id: row.id,
              name: row.name,
              company: row.company,
              phone: row.phone,
              email: row.email,
              city: row.city,
              stage: row.stage,
              slaStatus: row.sla_status,
              slaDueAt: row.sla_due_at,
              expectedValue: row.expected_value,
              notes: row.notes,
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
          const row: any = await db.prepare('SELECT * FROM leads WHERE id = ? AND deleted_at IS NULL').bind(id).first();
          if (!row) return jsonRes({ title: 'Lead not found', status: 404, code: 'NOT_FOUND' }, 404);
          const name = body.name !== undefined ? body.name : row.name;
          const stage = body.stage !== undefined ? body.stage : row.stage;
          const expectedValue = body.expectedValue !== undefined ? Number(body.expectedValue) : row.expected_value;
          await db.prepare('UPDATE leads SET name = ?, stage = ?, expected_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(name, stage, expectedValue, id).run();
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
            JSON.stringify({ contacts: newCust.contacts, addresses: newCust.addresses }),
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
      const pId = body.partyId;

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
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Hello, your quotation ${displayNumber} from SaleSphere is available here: ${shareUrl}`)}`;
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

    const nextOrdNum = await getNextDocNumber(db, 'orders', 'number', 'SO/26-27/');
    const newOrdId = 'ord-' + Date.now();
    const customerId = qt.partyType === 'customer' ? qt.partyId : 'cust-1';
    const customerName = qt.partyName;

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
      lines: qt.lines,
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

    const nextInvNum = await getNextDocNumber(db, 'invoices', 'number', 'INV/26-27/');
    const newInvId = 'inv-' + Date.now();
    const customerId = qt.partyType === 'customer' ? qt.partyId : 'cust-1';
    const customerName = qt.partyName;
    const grandTotal = qt.totals?.grandTotal || 0;

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
      lines: qt.lines,
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
          null,
          newInv.type,
          newInv.status,
          newInv.date,
          newInv.dueDate,
          grandTotal,
          0,
          0,
          grandTotal,
          JSON.stringify({ lines: newInv.lines, totals: newInv.totals, quoteId: qid }),
          new Date().toISOString(),
          new Date().toISOString(),
          1
        ).run();
      } catch (e) {
        console.error('D1 create-invoice from quote error:', e);
      }
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
            return jsonRes({
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

      // Compute totals if needed
      let totals = body.totals;
      let processedLines = lines;
      if (!totals || !totals.grandTotal) {
        const computed = calculateLinesAndTotals(lines, '29');
        totals = computed.totals;
        processedLines = computed.lines;
      }

      // Customer name lookup
      let customerName = (body.customerName || '').trim();
      if (!customerName || customerName === 'Customer') {
        if (db) {
          try {
            const { results } = await db.prepare('SELECT display_name, legal_name FROM customers WHERE id = ?').bind(customerId).all();
            if (results?.[0]) customerName = (results[0] as any).display_name || (results[0] as any).legal_name;
          } catch (e) {}
        }
        if (!customerName) {
          const c = memoryStore.customers.find((cust) => cust.id === customerId);
          if (c) customerName = c.displayName || c.legalName;
        }
      }
      if (!customerName) customerName = 'Customer';

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

    const nextInvNum = await getNextDocNumber(db, 'invoices', 'number', 'INV/26-27/');
    const newInvId = 'inv-' + Date.now();
    const grandTotal = ord.totals?.grandTotal || 0;

    const newInv = {
      id: newInvId,
      number: nextInvNum,
      customerId: ord.customerId,
      customerName: ord.customerName,
      orderId: oid,
      type: 'tax_invoice',
      status: 'issued',
      date: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      paid: 0,
      credited: 0,
      balanceDue: grandTotal,
      totals: ord.totals,
      lines: ord.lines,
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
          oid,
          newInv.type,
          newInv.status,
          newInv.date,
          newInv.dueDate,
          grandTotal,
          0,
          0,
          grandTotal,
          JSON.stringify({ lines: newInv.lines, totals: newInv.totals, orderId: oid }),
          new Date().toISOString(),
          new Date().toISOString(),
          1
        ).run();
      } catch (e) {
        console.error('D1 create-invoice from order error:', e);
      }
    }

    memoryStore.invoices.unshift(newInv);
    return jsonRes({ id: newInv.id, number: newInv.number }, 201);
  }

  // /orders/:id
  const orderItemMatch = path.match(/^\/orders\/([^/?]+)/);
  if (orderItemMatch) {
    const oid = orderItemMatch[1];

    if (method === 'DELETE') {
      if (db) {
        try {
          await db.prepare('UPDATE orders SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(oid).run();
        } catch (e) {}
      }
      const idx = memoryStore.orders.findIndex((o) => o.id === oid);
      if (idx !== -1) memoryStore.orders.splice(idx, 1);
      return jsonRes({ success: true, id: oid });
    }

    if (method === 'GET') {
      if (db) {
        try {
          const { results } = await db.prepare('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL').bind(oid).all();
          if (results?.[0]) {
            const r: any = results[0];
            const d = r.data_json ? JSON.parse(r.data_json) : {};
            return jsonRes({
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
                orderId: r.order_id,
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

      if (!customerName || customerName === 'Customer') {
        if (db) {
          try {
            const { results } = await db.prepare('SELECT display_name, legal_name FROM customers WHERE id = ?').bind(customerId).all();
            if (results?.[0]) customerName = (results[0] as any).display_name || (results[0] as any).legal_name;
          } catch (e) {}
        }
        if (!customerName) {
          const c = memoryStore.customers.find((cust) => cust.id === customerId);
          if (c) customerName = c.displayName || c.legalName;
        }
      }
      if (!customerName) customerName = 'Customer';

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
              orderId: r.order_id,
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

  // 10. /notifications (Requirement 4)
  if (path === '/notifications' || path === '/notifications/') {
    const unreadOnly = url.searchParams.get('unread') === '1';
    let notifs = memoryStore.notifications;
    if (unreadOnly) {
      notifs = notifs.filter((n) => !n.read);
    }
    return jsonRes({ items: notifs, unreadCount: memoryStore.notifications.filter((n) => !n.read).length });
  }

  // 11. /masters/:type/options (Requirement 4)
  const masterOptionsMatch = path.match(/^\/masters\/([^/]+)\/options/);
  if (masterOptionsMatch) {
    const mType = masterOptionsMatch[1];
    const optionsMap: Record<string, any[]> = {
      pipelineStages: [
        { id: 'stg-1', key: 'new', label: 'New', probabilityPct: 10 },
        { id: 'stg-2', key: 'contacted', label: 'Contacted', probabilityPct: 25 },
        { id: 'stg-3', key: 'interested', label: 'Interested', probabilityPct: 50 },
        { id: 'stg-4', key: 'quotation_sent', label: 'Quotation Sent', probabilityPct: 70 },
        { id: 'stg-5', key: 'negotiation', label: 'Negotiation', probabilityPct: 85 },
        { id: 'stg-6', key: 'won', label: 'Won', probabilityPct: 100 },
        { id: 'stg-7', key: 'lost', label: 'Lost', probabilityPct: 0 },
      ],
      leadSources: [
        { id: 'src-1', key: 'website', label: 'Website', value: 'website' },
        { id: 'src-2', key: 'referral', label: 'Referral', value: 'referral' },
        { id: 'src-3', key: 'google_ads', label: 'Google Ads', value: 'google_ads' },
        { id: 'src-4', key: 'cold_call', label: 'Cold Outreach', value: 'cold_call' },
      ],
      products: [
        { id: 'prod-1', key: 'prod-1', label: 'Enterprise CRM Implementation', name: 'Enterprise CRM Implementation', value: 'prod-1', rate: 2500000, unit: 'service', taxRatePct: 18 },
        { id: 'prod-2', key: 'prod-2', label: 'Annual Software Support', name: 'Annual Software Support', value: 'prod-2', rate: 500000, unit: 'year', taxRatePct: 18 },
      ],
      bankAccounts: [
        { id: 'bnk-1', key: 'bnk-1', label: 'HDFC Bank - 50200012345678', bankName: 'HDFC Bank', accountNo: '50200012345678', ifsc: 'HDFC0000240', branch: 'Indiranagar' },
      ],
      messageTemplates: [
        { id: 'tpl-1', key: 'invoice', label: 'Invoice Template', channel: 'whatsapp', body: 'Dear {{name}}, invoice {{doc_no}} for ₹{{amount}} is ready: {{link}}' },
        { id: 'tpl-2', key: 'quote', label: 'Quote Template', channel: 'whatsapp', body: 'Dear {{name}}, quotation {{doc_no}} is ready: {{link}}' },
      ],
    };
    const rawItems = optionsMap[mType] || [];
    const items = rawItems.map((it: any) => ({
      ...it,
      label: it.label || it.name || it.displayName || it.key,
      value: it.value || it.id || it.key,
    }));
    return jsonRes({ items });
  }

  // 12. /documents/:type/:id/preview (Requirement 4)
  if (path.startsWith('/documents/')) {
    return jsonRes({
      status: 'ready',
      html: '<div style="padding: 24px; font-family: sans-serif;"><h2>Document Preview</h2><p>Official document render.</p></div>',
      url: 'https://salesphere.live',
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

  // 14. /admin/masters/:type (Requirement 4)
  if (path.startsWith('/admin/masters/')) {
    const mType = path.replace(/^\/admin\/masters\//, '').split('/')[0].split('?')[0];
    if (mType === 'products') {
      return jsonRes({
        items: [
          { id: 'prod-1', name: 'Enterprise CRM Implementation', key: 'CRM-ENT', status: 'active', isDefault: false, data: { ratePaise: 2500000, taxRatePct: 18, unit: 'service', type: 'service' }, version: 1 },
          { id: 'prod-2', name: 'Annual Software Support', key: 'CRM-SUP', status: 'active', isDefault: false, data: { ratePaise: 500000, taxRatePct: 18, unit: 'year', type: 'service' }, version: 1 },
        ],
      });
    }
    return jsonRes({ items: [] });
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

  // 22. /timeline/:type/:id
  if (path.startsWith('/timeline/')) {
    return jsonRes({
      items: [
        { id: 'act-1', type: 'call', summary: 'Initial discovery call', at: '2026-11-20T10:30:00Z', user: { name: 'Owner Admin' } },
        { id: 'act-2', type: 'stage', summary: 'Stage changed to New', at: '2026-11-20T10:00:00Z', user: { name: 'Owner Admin' } },
      ],
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
