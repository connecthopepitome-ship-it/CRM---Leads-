import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { computeDocument, GST_STATES, isIntraState } from '@ss/domain';
import { ApiError, get, patch, post } from '../lib/api';
import { money, toPaise } from '../lib/format';
import { useOptions } from '../features/hooks';
import { Banner, Button, Field, PageHeader, Select, Skeleton, toast } from '../ui';
import { errorToast } from '../ui/toast';
import { 
  Check, FileText, Plus, Trash2, User, Users, UserSquare2, Layers, 
  DollarSign, ShieldCheck, Sparkles, RefreshCw, Calculator, FileCheck 
} from 'lucide-react';

interface Line {
  kind: 'item' | 'heading';
  productId: string | null;
  description: string;
  qty: string;
  unit: string;
  rate: string;
  discountPct: string;
  taxRatePct: string;
  hsnSac: string;
}

const DEFAULT_PRODUCTS = [
  { id: 'prod-1', label: 'CRM Enterprise License (Annual)', ratePaise: 2950000, taxRatePct: 18, hsnSac: '997331', unit: 'Year', description: 'Enterprise annual subscription including up to 25 active users with custom workflows.' },
  { id: 'prod-2', label: 'Implementation & Data Migration', ratePaise: 1500000, taxRatePct: 18, hsnSac: '998313', unit: 'Job', description: 'Complete data onboarding, master schema setup, and user training sessions.' },
  { id: 'prod-3', label: 'Custom Integration Pack', ratePaise: 800000, taxRatePct: 18, hsnSac: '998314', unit: 'Pack', description: 'Bi-directional webhooks and REST API integration with external accounting ERP.' },
  { id: 'prod-4', label: 'Dedicated Support Retainer (Monthly)', ratePaise: 500000, taxRatePct: 18, hsnSac: '998319', unit: 'Month', description: '24/7 SLA escalation support with dedicated customer success manager.' },
];

const PRELOADED_PARTIES = {
  customer: [
    { id: 'cust-1', name: 'Fatima Khan', company: 'Khan Enterprises', stateCode: '29', gstin: '29ABCDE1234F1Z5' },
    { id: 'cust-2', name: 'Iyer Consultancy', company: 'Iyer & Associates', stateCode: '29', gstin: '29AABCI5678G2Z3' },
    { id: 'cust-3', name: 'Nair Foods', company: 'Nair Foods Pvt Ltd', stateCode: '27', gstin: '27AABCN9988H1Z8' },
  ],
  lead: [
    { id: 'lead-1', name: 'Mohan Das', company: 'Das Industries', stateCode: '29', gstin: '29AABCD4321J1Z0' },
    { id: 'lead-2', name: 'Deepa Reddy', company: 'Reddy Tech', stateCode: '36', gstin: '36ABCDE8765K1Z4' },
    { id: 'lead-3', name: 'Apex Global Logistics', company: 'Apex Global', stateCode: '29', gstin: '29AABCA2233L1Z9' },
  ],
};

const SAMPLE_PRESETS: Record<string, { label: string; lines: Line[]; partyId: string; pos: string }> = {
  enterprise: {
    label: 'Enterprise Suite (₹1,01,539)',
    partyId: 'cust-1',
    pos: '29',
    lines: [
      {
        kind: 'item',
        productId: 'prod-1',
        description: 'CRM Enterprise License (Annual) - 25 User Seat Tier',
        qty: '2',
        unit: 'Year',
        rate: '29500',
        discountPct: '5',
        taxRatePct: '18',
        hsnSac: '997331',
      },
      {
        kind: 'item',
        productId: 'prod-2',
        description: 'Implementation, Custom Workflows & Data Migration',
        qty: '1',
        unit: 'Job',
        rate: '15000',
        discountPct: '',
        taxRatePct: '18',
        hsnSac: '998313',
      },
      {
        kind: 'item',
        productId: 'prod-4',
        description: 'Dedicated Priority Support Retainer (Quarterly)',
        qty: '3',
        unit: 'Month',
        rate: '5000',
        discountPct: '',
        taxRatePct: '18',
        hsnSac: '998319',
      },
    ],
  },
  starter: {
    label: 'Starter Pack (₹34,810)',
    partyId: 'cust-2',
    pos: '29',
    lines: [
      {
        kind: 'item',
        productId: 'prod-1',
        description: 'CRM Starter License (Annual) - 5 Users',
        qty: '1',
        unit: 'Year',
        rate: '29500',
        discountPct: '',
        taxRatePct: '18',
        hsnSac: '997331',
      },
    ],
  },
};

interface QuoteBuilderProps {
  mode?: 'quote' | 'order' | 'invoice';
}

export default function QuoteBuilder({ mode: initialMode }: QuoteBuilderProps) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const loc = useLocation();
  const mode = initialMode || (loc.pathname.includes('/orders/') ? 'order' : loc.pathname.includes('/invoices/') ? 'invoice' : 'quote');
  const isOrder = mode === 'order';
  const isInvoice = mode === 'invoice';
  const isQuote = !isOrder && !isInvoice;

  const productsQuery = useOptions('products');
  const company = useQuery({ queryKey: ['company'], queryFn: () => get<{ gstRegistered: boolean; stateCode: string } | null>('/admin/company').catch(() => null) });
  const existing = useQuery({ queryKey: ['quote', id], queryFn: () => get<Record<string, unknown>>(`/quotes/${id}`), enabled: !!id && isQuote });

  const [partyType, setPartyType] = useState(isOrder || isInvoice ? 'customer' : (params.get('partyType') ?? 'customer'));
  const [partyId, setPartyId] = useState(params.get('partyId') ?? 'cust-1');
  const [partySearch, setPartySearch] = useState('');
  
  // Default to rich enterprise sample data for instant testing
  const [lines, setLines] = useState<Line[]>(SAMPLE_PRESETS.enterprise.lines);
  const [validDays, setValidDays] = useState('15');
  const [pos, setPos] = useState('29');
  const [overall, setOverall] = useState('');
  const [terms, setTerms] = useState('1. 50% advance upon acceptance, balance upon deployment.\n2. Standard 18% GST applicable.\n3. Quotation valid for 15 days.');
  const [notes, setNotes] = useState('Thank you for choosing SaleSphere. We look forward to working with your team.');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parties = useQuery({
    queryKey: ['party-search', partyType, partySearch],
    queryFn: () => get<{ items: { id: string; name?: string; displayName?: string }[] }>(`/${partyType === 'lead' ? 'leads' : 'customers'}?limit=10${partySearch.length >= 2 ? `&q=${encodeURIComponent(partySearch)}` : ''}`),
    enabled: !id,
  });

  const availableParties = useMemo(() => {
    const serverItems = parties.data?.items ?? [];
    const list: { id: string; name: string; company: string; stateCode: string; gstin: string }[] = [];
    for (const item of serverItems) {
      list.push({
        id: item.id,
        name: item.displayName || item.name || item.id,
        company: (item as any).company || (item as any).legalName || '',
        stateCode: (item as any).stateCode || (item as any).state || '29',
        gstin: (item as any).gstin || '29ABCDE1234F1Z5',
      });
    }
    const fallbackList = PRELOADED_PARTIES[partyType as keyof typeof PRELOADED_PARTIES] || [];
    for (const fb of fallbackList) {
      if (!list.some((p) => p.id === fb.id)) {
        list.push(fb);
      }
    }
    return list;
  }, [partyType, parties.data]);

  const availableProducts = useMemo(() => {
    const list = [...DEFAULT_PRODUCTS];
    const serverItems = productsQuery.data ?? [];
    for (const item of serverItems) {
      if (!list.some((p) => p.id === item.id)) {
        const d = (item.data as { ratePaise?: number; taxRatePct?: number; hsnSac?: string; unit?: string; description?: string }) || {};
        list.push({
          id: item.id,
          label: item.label,
          ratePaise: d.ratePaise ?? 0,
          taxRatePct: d.taxRatePct ?? 18,
          hsnSac: d.hsnSac ?? '',
          unit: d.unit ?? 'Nos',
          description: d.description ?? item.label,
        });
      }
    }
    return list;
  }, [productsQuery.data]);

  useEffect(() => {
    const q = existing.data;
    if (!q) return;
    setPartyType(String(q.partyType));
    setPartyId(String(q.partyId));
    setValidDays(String(q.validDays ?? 15));
    setPos(String(q.placeOfSupply ?? ''));
    setOverall(q.overallDiscountPct ? String(q.overallDiscountPct) : '');
    setTerms(String(q.termsText ?? ''));
    setNotes(String(q.notes ?? ''));
    if (Array.isArray(q.lines) && q.lines.length > 0) {
      setLines((q.lines as Record<string, unknown>[]).map((l) => ({
        kind: (l.kind as 'item' | 'heading') || 'item',
        productId: (l.productId as string) ?? null,
        description: String(l.description ?? ''),
        qty: String(l.qty ?? '1'),
        unit: String(l.unit ?? ''),
        rate: String(Number(l.rate || 0) / 100),
        discountPct: l.discountPct ? String(l.discountPct) : '',
        taxRatePct: String(l.taxRatePct ?? 18),
        hsnSac: String(l.hsnSac ?? ''),
      })));
    }
  }, [existing.data]);

  const placeOfSupply = pos || company.data?.stateCode || '29';
  const toBody = (l: Line) => ({
    kind: l.kind,
    productId: l.productId,
    description: l.description,
    qty: Number(l.qty) || 0,
    unit: l.unit,
    rate: toPaise(l.rate || 0),
    discountPct: l.discountPct ? Number(l.discountPct) : null,
    taxRatePct: Number(l.taxRatePct) || 0,
    hsnSac: l.hsnSac || null,
  });

  const calc = useMemo(() => {
    try {
      return computeDocument(lines.map(toBody), {
        gst: company.data?.gstRegistered ?? true,
        intraState: isIntraState(company.data?.stateCode ?? '29', placeOfSupply),
        overallDiscountPct: Number(overall) || 0,
        roundOff: true,
      });
    } catch {
      return null;
    }
  }, [lines, company.data, placeOfSupply, overall]);

  const upd = (i: number, k: keyof Line, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const pickProduct = (i: number, pid: string) => {
    const p = availableProducts.find((x) => x.id === pid);
    if (!p) {
      setLines((ls) => ls.map((l, j) => (j === i ? { ...l, productId: null } : l)));
      return;
    }
    setLines((ls) =>
      ls.map((l, j) =>
        j === i
          ? {
              ...l,
              productId: pid,
              description: p.description ?? p.label,
              rate: String(p.ratePaise / 100),
              taxRatePct: String(p.taxRatePct),
              hsnSac: p.hsnSac ?? '',
              unit: p.unit ?? 'Nos',
            }
          : l
      )
    );
  };

  const loadPreset = (key: 'enterprise' | 'starter' | 'blank') => {
    if (key === 'blank') {
      setLines([
        {
          kind: 'item',
          productId: null,
          description: '',
          qty: '1',
          unit: 'Nos',
          rate: '',
          discountPct: '',
          taxRatePct: '18',
          hsnSac: '',
        },
      ]);
      toast('Loaded blank line item');
      return;
    }
    const preset = SAMPLE_PRESETS[key];
    if (preset) {
      setLines(preset.lines);
      setPartyId(preset.partyId);
      setPos(preset.pos);
      toast(`Loaded ${preset.label}`);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const validLines = lines.filter((l) => (l.kind === 'heading' ? l.description : l.description || l.rate)).map(toBody);

    if (isOrder) {
      const orderBody = {
        customerId: partyId,
        customerName: selectedParty?.name || 'Customer',
        date: new Date().toISOString().slice(0, 10),
        expectedDelivery: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        lines: validLines,
        totals: t,
      };
      try {
        const ord = await post<{ id: string }>('/orders', orderBody);
        if (!ord?.id) throw new Error('Failed to create sales order');
        toast('Sales order created successfully');
        nav(`/sales/orders/${ord.id}`);
      } catch (err: any) {
        const msg = err?.title || err?.message || 'Failed to create sales order';
        setError(msg);
        errorToast(err);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (isInvoice) {
      const invBody = {
        customerId: partyId,
        customerName: selectedParty?.name || 'Customer',
        type: company.data?.gstRegistered === false ? 'bill_of_supply' : 'tax_invoice',
        date: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        lines: validLines,
        totals: t,
      };
      try {
        const invRes = await post<{ id: string }>('/invoices', invBody);
        if (!invRes?.id) throw new Error('Failed to create invoice');
        toast('Invoice created successfully');
        nav(`/sales/invoices/${invRes.id}`);
      } catch (err: any) {
        const msg = err?.title || err?.message || 'Failed to create invoice';
        setError(msg);
        errorToast(err);
      } finally {
        setBusy(false);
      }
      return;
    }

    const body = {
      partyType,
      partyId,
      validDays: Number(validDays) || 15,
      placeOfSupply,
      overallDiscountPct: Number(overall) || 0,
      termsText: terms || null,
      notes: notes || null,
      lines: validLines,
    };
    try {
      const q = id ? await patch<{ id: string }>(`/quotes/${id}`, body, Number(existing.data?.version)) : await post<{ id: string }>('/quotes', body);
      if (!q?.id) throw new Error('Server returned invalid quotation record without an ID');
      toast('Draft quotation saved successfully');
      nav(`/sales/quotes/${q.id}`);
    } catch (err: any) {
      const msg = err?.title || err?.message || 'Failed to save quotation';
      setError(msg);
      errorToast(err);
    } finally {
      setBusy(false);
    }
  };

  if (id && existing.isLoading) return <Skeleton rows={6} />;
  const DEFAULT_TOTALS = {
    grandTotal: 0,
    subTotal: 0,
    taxable: 0,
    discountTotal: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    roundOff: 0,
    inWords: 'Zero rupees only',
    maxDiscountPct: 0,
  };
  const t = calc?.totals ?? DEFAULT_TOTALS;
  const selectedParty = availableParties.find((p) => p.id === partyId);

  return (
    <div className="space-y-6 pb-28 sm:pb-16 font-sans">
      {/* Page Header */}
      <PageHeader
        back={isOrder ? '/sales?tab=orders' : isInvoice ? '/sales?tab=invoices' : id ? `/sales/quotes/${id}` : '/sales'}
        title={isOrder ? 'New Sales Order' : isInvoice ? 'New Invoice' : id ? 'Edit Quotation' : 'New Quotation'}
        subtitle={
          isOrder
            ? 'Create a confirmed sales order with delivery terms and line items.'
            : isInvoice
            ? 'Create and issue a commercial invoice with automatic GST calculations.'
            : 'Commercial proposal builder with automatic GST tax calculations and live totals.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Responsive Sample Data Preset Selector */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#E3EFDF] p-1 text-xs border border-[#CFE5CB] shadow-2xs">
              <span className="flex items-center gap-1 px-1.5 font-semibold text-[#233D2D]">
                <Sparkles size={13} className="text-[#3D7952]" />
                <span className="hidden sm:inline">Presets:</span>
              </span>
              <button
                type="button"
                onClick={() => loadPreset('enterprise')}
                className="px-2 py-0.5 rounded-lg font-semibold bg-[#233D2D] text-white shadow-2xs hover:bg-[#1a2e22] transition-colors text-[11px]"
              >
                Enterprise
              </button>
              <button
                type="button"
                onClick={() => loadPreset('starter')}
                className="px-2 py-0.5 rounded-lg font-medium text-[#202820] bg-white/70 hover:bg-white transition-colors text-[11px]"
              >
                Starter
              </button>
              <button
                type="button"
                onClick={() => loadPreset('blank')}
                className="px-1.5 py-0.5 rounded-lg font-medium text-[#778477] hover:text-[#202820] transition-colors text-[11px]"
              >
                Reset
              </button>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E3EFDF] text-[#233D2D] border border-[#CFE5CB]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3D7952] animate-pulse" />
              {isOrder ? 'Order' : isInvoice ? 'Invoice' : 'Draft'}
            </span>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Banner tone="info">{error}</Banner>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] w-full max-w-full min-w-0">
        {/* Left Column: Color-Coded Form Cards */}
        <div className="space-y-6 w-full max-w-full min-w-0">
          {/* ============================================================== */}
          {/* CARD 1: RECIPIENT & CLIENT IDENTITY (ROYAL BLUE ACCENT) */}
          {/* ============================================================== */}
          <section className="w-full max-w-full min-w-0 rounded-2xl border border-blue-200/70 border-l-[5px] border-l-blue-600 bg-white p-4 sm:p-5 shadow-sm space-y-4 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100/60 pb-3 w-full max-w-full">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                  <User size={16} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">Recipient & Client Information</h2>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                      Client Scope
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">Commercial entity and billing contact details</p>
                </div>
              </div>

              {/* Segmented Radio Pill for Party Type */}
              {isQuote && (
                <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-xs font-semibold self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setPartyType('customer');
                      setPartyId('cust-1');
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1 transition-all ${
                      partyType === 'customer'
                        ? 'bg-white text-blue-700 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users size={13} />
                    <span>Customer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPartyType('lead');
                      setPartyId('lead-1');
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1 transition-all ${
                      partyType === 'lead'
                        ? 'bg-white text-blue-700 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <UserSquare2 size={13} />
                    <span>Lead</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 w-full max-w-full min-w-0">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select {partyType === 'lead' ? 'Lead' : 'Customer'} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full max-w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-2xs cursor-pointer font-medium truncate"
                >
                  <option value="">Choose party...</option>
                  {availableParties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.company ? `(${p.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Search Contacts</label>
                <input
                  type="text"
                  placeholder="Filter name or phone..."
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                  className="w-full max-w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-2xs"
                />
              </div>
            </div>

            {selectedParty && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 text-xs w-full max-w-full min-w-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shrink-0 shadow-xs">
                    {selectedParty.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-sm truncate">{selectedParty.name}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span>{selectedParty.company || 'Direct Client'}</span>
                      <span>·</span>
                      <span className="font-mono text-slate-600">GSTIN: {selectedParty.gstin || '29ABCDE1234F1Z5'}</span>
                      <span>·</span>
                      <span>State: {selectedParty.stateCode || '29'}</span>
                    </div>
                  </div>
                </div>
                <span className="self-start sm:self-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                  Verified Taxpayer
                </span>
              </div>
            )}
          </section>

          {/* ============================================================== */}
          {/* CARD 2: LINE ITEMS & COMMERCIAL SCOPE (EMERALD ACCENT) */}
          {/* ============================================================== */}
          <section className="w-full max-w-full min-w-0 rounded-2xl border border-emerald-200/70 border-l-[5px] border-l-emerald-600 bg-white p-4 sm:p-5 shadow-sm space-y-4 transition-all">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100/60 pb-3 w-full max-w-full">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                  <Layers size={16} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">Scope & Line Items</h2>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                      Commercial Items ({lines.length})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">Products, quantities, rate schedules, and line discounts</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() =>
                    setLines((ls) => [
                      ...ls,
                      {
                        kind: 'item',
                        productId: 'prod-3',
                        description: 'Custom Integration Pack',
                        qty: '1',
                        unit: 'Pack',
                        rate: '8000',
                        discountPct: '',
                        taxRatePct: '18',
                        hsnSac: '998314',
                      },
                    ])
                  }
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors shadow-2xs"
                >
                  <Plus size={14} />
                  <span>Add Line Item</span>
                </button>
              </div>
            </div>

            {/* Line Cards List */}
            <div className="space-y-3.5 w-full max-w-full min-w-0">
              {lines.map((l, i) => (
                <div
                  key={i}
                  className="w-full max-w-full min-w-0 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all space-y-3"
                >
                  {/* Line Item Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 w-full max-w-full">
                    <div className="flex items-center justify-between gap-2.5 w-full sm:w-auto">
                      <span className="flex h-6 px-2.5 items-center justify-center rounded-md bg-emerald-50 border border-emerald-200/70 text-[11px] font-bold text-emerald-800 shrink-0">
                        {l.kind === 'heading' ? 'Section Header' : `Line Item #${i + 1}`}
                      </span>

                      <div className="flex items-center gap-2 sm:hidden">
                        <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md tabular-nums">
                          {calc ? money(calc.lines[i]?.total ?? 0) : '—'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLines((ls) => ls.filter((_x, j) => j !== i))}
                          disabled={lines.length === 1}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {l.kind !== 'heading' && (
                      <div className="w-full sm:w-72 min-w-0">
                        <select
                          value={l.productId ?? ''}
                          onChange={(e) => pickProduct(i, e.target.value)}
                          className="w-full max-w-full text-xs font-semibold text-emerald-800 bg-emerald-50/50 border border-emerald-200/80 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer truncate"
                        >
                          <option value="">Custom Free Text</option>
                          {availableProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-semibold text-slate-400">Total:</span>
                      <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md tabular-nums">
                        {calc ? money(calc.lines[i]?.total ?? 0) : '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLines((ls) => ls.filter((_x, j) => j !== i))}
                        disabled={lines.length === 1}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        title="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Description Input */}
                  <div className="w-full min-w-0">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Deliverable & Scope Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Enterprise License Tier or Consultation Deliverables"
                      value={l.description}
                      onChange={(e) => upd(i, 'description', e.target.value)}
                      className="w-full max-w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 shadow-2xs font-medium"
                    />
                  </div>

                  {/* Pricing & Tax Grid */}
                  {l.kind !== 'heading' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1 text-xs w-full max-w-full min-w-0">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={l.qty}
                          onChange={(e) => upd(i, 'qty', e.target.value)}
                          className="w-full min-h-[36px] rounded-xl border border-slate-200 px-2.5 py-1 text-xs text-slate-800 text-center font-bold focus:outline-none focus:border-emerald-500 shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Rate (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={l.rate}
                          onChange={(e) => upd(i, 'rate', e.target.value)}
                          className="w-full min-h-[36px] rounded-xl border border-slate-200 px-2.5 py-1 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500 shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Discount %</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={l.discountPct}
                          onChange={(e) => upd(i, 'discountPct', e.target.value)}
                          className="w-full min-h-[36px] rounded-xl border border-slate-200 px-2.5 py-1 text-xs text-slate-800 text-center focus:outline-none focus:border-emerald-500 shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">GST Slab</label>
                        <select
                          value={l.taxRatePct}
                          onChange={(e) => upd(i, 'taxRatePct', e.target.value)}
                          className="w-full min-h-[36px] rounded-xl border border-slate-200 px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-2xs cursor-pointer font-semibold"
                        >
                          <option value="0">0% Exempt</option>
                          <option value="5">5% Standard</option>
                          <option value="12">12% Standard</option>
                          <option value="18">18% Services</option>
                          <option value="28">28% High Slab</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">HSN / SAC</label>
                        <input
                          type="text"
                          placeholder="997331"
                          value={l.hsnSac}
                          onChange={(e) => upd(i, 'hsnSac', e.target.value)}
                          className="w-full min-h-[36px] rounded-xl border border-slate-200 px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-2xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Add Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 w-full max-w-full">
              <button
                type="button"
                onClick={() =>
                  setLines((ls) => [
                    ...ls,
                    {
                      kind: 'item',
                      productId: null,
                      description: 'Custom Consulting Deliverable',
                      qty: '1',
                      unit: 'Nos',
                      rate: '10000',
                      discountPct: '',
                      taxRatePct: '18',
                      hsnSac: '998311',
                    },
                  ])
                }
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs"
              >
                <Plus size={14} />
                <span>Add Item</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setLines((ls) => [
                    ...ls,
                    { ...blank(), kind: 'heading', description: 'Phase 2 Deliverables', qty: '0', taxRatePct: '0' },
                  ])
                }
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-emerald-700 hover:bg-emerald-50/50 transition-colors"
              >
                <FileText size={14} />
                <span>Add Section Heading</span>
              </button>
            </div>
          </section>

          {/* ============================================================== */}
          {/* CARD 3: COMMERCIAL TERMS & DELIVERY (PURPLE ACCENT) */}
          {/* ============================================================== */}
          <section className="w-full max-w-full min-w-0 rounded-2xl border border-purple-200/70 border-l-[5px] border-l-purple-600 bg-white p-4 sm:p-5 shadow-sm space-y-4 transition-all">
            <div className="flex items-center gap-2.5 border-b border-purple-100/60 pb-3 w-full max-w-full">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100 shrink-0">
                <ShieldCheck size={16} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">Terms & Delivery Governance</h2>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                    Governance & Terms
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">Validity period, tax jurisdiction, and client notes</p>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 text-xs w-full max-w-full">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Validity Period (Days)</label>
                <input
                  type="number"
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                  className="w-full max-w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Place of Supply (GST)</label>
                <select
                  value={placeOfSupply}
                  onChange={(e) => setPos(e.target.value)}
                  className="w-full max-w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 shadow-2xs cursor-pointer font-medium"
                >
                  {Object.entries(GST_STATES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l} ({v})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Overall Discount %</label>
                <input
                  type="number"
                  placeholder="0"
                  value={overall}
                  onChange={(e) => setOverall(e.target.value)}
                  className="w-full max-w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 text-xs pt-1 w-full max-w-full">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Terms & Conditions</label>
                <textarea
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full max-w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 shadow-2xs leading-relaxed font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes to Customer</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full max-w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 shadow-2xs leading-relaxed font-mono"
                />
              </div>
            </div>
          </section>
        </div>

        {/* ============================================================== */}
        {/* RIGHT STICKY TOTALS SUMMARY CARD */}
        {/* ============================================================== */}
        <aside className="lg:sticky lg:top-20 lg:self-start space-y-4 w-full max-w-full min-w-0">
          <div className="w-full max-w-full min-w-0 rounded-2xl border border-[#DCE7D9] bg-white p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCE7D9] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E3EFDF] text-[#3D7952]">
                  <Calculator size={15} />
                </div>
                <h2 className="text-sm font-bold text-[#202820] tracking-tight">
                  {isOrder ? 'Order Summary' : isInvoice ? 'Invoice Summary' : 'Quotation Summary'}
                </h2>
              </div>
              <span className="text-[10px] font-bold text-[#233D2D] bg-[#E3EFDF] px-2 py-0.5 rounded-full">
                INR (₹)
              </span>
            </div>

            {!calc ? (
              <p className="text-xs text-rose-600 font-medium">Please check rates and discount limits.</p>
            ) : (
              <dl className="text-xs space-y-2.5">
                <div className="flex justify-between items-center text-[#778477]">
                  <span>Gross Sub-total</span>
                  <span className="font-semibold text-[#202820] tabular-nums">{money(t!.subTotal)}</span>
                </div>

                {t!.discountTotal > 0 && (
                  <div className="flex justify-between items-center text-[#3D7952]">
                    <span>Total Discount Applied</span>
                    <span className="font-semibold tabular-nums">-{money(t!.discountTotal)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-[#778477]">
                  <span>Net Taxable Value</span>
                  <span className="font-semibold text-[#202820] tabular-nums">{money(t!.taxable)}</span>
                </div>

                {t!.cgst > 0 && (
                  <div className="flex justify-between items-center text-[#778477]">
                    <span>CGST (9%)</span>
                    <span className="font-medium text-[#202820] tabular-nums">{money(t!.cgst)}</span>
                  </div>
                )}

                {t!.sgst > 0 && (
                  <div className="flex justify-between items-center text-[#778477]">
                    <span>SGST (9%)</span>
                    <span className="font-medium text-[#202820] tabular-nums">{money(t!.sgst)}</span>
                  </div>
                )}

                {t!.igst > 0 && (
                  <div className="flex justify-between items-center text-[#778477]">
                    <span>IGST (18%)</span>
                    <span className="font-medium text-[#202820] tabular-nums">{money(t!.igst)}</span>
                  </div>
                )}

                {t!.roundOff !== 0 && (
                  <div className="flex justify-between items-center text-[#778477] text-[11px]">
                    <span>Round-off Adjustment</span>
                    <span className="tabular-nums">{money(t!.roundOff)}</span>
                  </div>
                )}

                {/* Highlighted Total Box */}
                <div className="mt-3 p-4 rounded-xl bg-[#233D2D] text-white shadow-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-[#CFE5CB]">Total Payable</span>
                    <span className="text-2xl font-bold tracking-tight text-white tabular-nums">
                      {money(t!.grandTotal)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] font-medium text-[#CFE5CB]/90 leading-tight">
                    {t!.inWords}
                  </p>
                </div>
              </dl>
            )}

            <Button
              className="mt-4 w-full py-3.5 bg-[#3D7952] hover:bg-[#2F5E3F] text-white rounded-xl font-bold shadow-xs transition-colors"
              busy={busy}
              disabled={!partyId || !calc}
              onClick={() => void save()}
            >
              <Check size={16} strokeWidth={2.5} />
              <span>{isOrder ? 'Create Sales Order' : isInvoice ? 'Create Invoice' : 'Save Draft Proposal'}</span>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
