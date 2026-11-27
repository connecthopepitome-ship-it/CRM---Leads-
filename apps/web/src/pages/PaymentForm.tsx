/** SCR-017 Record payment (FR-070 – FR-072): allocation preview, UTR check, idempotency key per form.
 * Modern balanced color-coded design with dummy presets.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CURRENCIES, formatCurrency } from '@ss/domain';
import { ApiError, get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, money, toPaise, today, uid } from '../lib/format';
import { useOptions } from '../features/hooks';
import { Banner, Button, Field, PageHeader, SelectField, Table, Textarea, TextField, toast } from '../ui';
import { errorToast } from '../ui/toast';
import { 
  Building2, CheckCircle2, CreditCard, DollarSign, FileCheck, IndianRupee, 
  Receipt, RotateCcw, ShieldCheck, Sparkles, User, Wallet 
} from 'lucide-react';

interface Open {
  id: string;
  number: string;
  dueDate: string;
  balance: number;
}

export default function PaymentForm() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { perm } = useAuth();
  const banks = useOptions('bankAccounts');

  const [customerId, setCustomerId] = useState(params.get('customerId') ?? '');
  const [search, setSearch] = useState('');
  const customers = useQuery({
    queryKey: ['cust-pick', search],
    queryFn: () => get<{ items: { id: string; displayName: string }[] }>(`/customers?limit=50${search.trim().length >= 2 ? `&q=${encodeURIComponent(search.trim())}` : ''}`),
  });

  const selectedCustQuery = useQuery({
    queryKey: ['customer-detail-pick', customerId],
    queryFn: () => get<any>(`/customers/${customerId}`),
    enabled: !!customerId,
  });

  const targetInvoiceId = params.get('invoiceId');
  const targetInvoiceQuery = useQuery({
    queryKey: ['target-invoice', targetInvoiceId],
    queryFn: () => get<any>(`/invoices/${targetInvoiceId}`),
    enabled: !!targetInvoiceId,
  });

  const [f, setF] = useState(() => {
    const pAmt = params.get('amount');
    let amt = '';
    if (pAmt && !isNaN(Number(pAmt)) && Number(pAmt) > 0) {
      amt = String(Number(pAmt) / 100);
    }
    return {
      date: today(),
      amount: amt,
      currency: 'INR',
      exchangeRate: '1.00',
      mode: 'neft',
      reference: '',
      bankAccountId: '',
      tds: '',
      tdsSection: '',
      note: '',
    };
  });

  const [manual, setManual] = useState<Record<string, string> | null>(null);
  const [utrUsed, setUtrUsed] = useState<string | null>(null);
  const [override, setOverride] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idemKey = useMemo(() => uid(), []);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
  };

  const resetForm = () => {
    setCustomerId('');
    setF({
      date: today(),
      amount: '',
      currency: 'INR',
      exchangeRate: '1.00',
      mode: 'neft',
      reference: '',
      bankAccountId: '',
      tds: '',
      tdsSection: '',
      note: '',
    });
    setError(null);
    setUtrUsed(null);
    toast('Form reset');
  };

  useEffect(() => {
    if (selectedCustQuery.data?.currency) {
      const cur = selectedCustQuery.data.currency;
      setF((prev) => ({
        ...prev,
        currency: cur,
        exchangeRate: cur === 'INR' ? '1.00' : (prev.exchangeRate === '1.00' ? (cur === 'USD' ? '84.00' : (cur === 'AED' ? '22.80' : '1.00')) : prev.exchangeRate),
      }));
    }
  }, [selectedCustQuery.data]);

  useEffect(() => {
    if (targetInvoiceQuery.data) {
      if (!f.amount) {
        const bal = targetInvoiceQuery.data.balanceDue ?? (targetInvoiceQuery.data.grandTotal - (targetInvoiceQuery.data.paidAmount || 0));
        if (bal > 0) {
          setF((prev) => ({ ...prev, amount: String(bal / 100) }));
        }
      }
      if (targetInvoiceQuery.data.currency) {
        setF((prev) => ({
          ...prev,
          currency: targetInvoiceQuery.data.currency,
          exchangeRate: targetInvoiceQuery.data.exchangeRate ? String(targetInvoiceQuery.data.exchangeRate) : prev.exchangeRate,
        }));
      }
    }
  }, [targetInvoiceQuery.data]);

  const preview = useQuery({
    queryKey: ['pay-preview', customerId, f.amount, f.tds, targetInvoiceId],
    queryFn: () =>
      post<{ open: Open[]; plan: { allocations?: { invoiceId: string; amount: number }[]; advance?: number; error?: string } }>(
        '/payments/preview',
        { customerId, amount: toPaise(f.amount || 0), tdsAmount: toPaise(f.tds || 0), allocation: { mode: 'auto', preferInvoiceId: targetInvoiceId ?? undefined } }
      ).catch(() => ({
        open: [],
        plan: {
          allocations: [],
          advance: 0,
        },
      })),
    enabled: !!customerId,
  });

  useEffect(() => {
    const inv = params.get('invoiceId');
    const o = preview.data?.open?.find((x) => x.id === inv);
    if (o && !f.amount && o.balance > 0) setF((x) => ({ ...x, amount: String(o.balance / 100) }));
  }, [preview.data]);

  const checkUtr = async () => {
    if (!f.reference) return;
    try {
      const r = await get<{ usedBy?: string }>(`/payments/utr-check?ref=${encodeURIComponent(f.reference)}`);
      setUtrUsed(r?.usedBy ?? null);
    } catch {
      setUtrUsed(null);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        customerId,
        date: f.date,
        amount: toPaise(f.amount),
        currency: f.currency,
        exchangeRate: Number(f.exchangeRate) || 1,
        mode: f.mode,
        reference: f.reference || null,
        bankAccountId: f.bankAccountId || null,
        tdsAmount: toPaise(f.tds || 0),
        tdsSection: f.tdsSection || null,
        note: f.note || null,
        utrOverrideReason: override || null,
        allocation: manual
          ? { mode: 'manual', items: Object.entries(manual).filter(([, v]) => toPaise(v) > 0).map(([invoiceId, v]) => ({ invoiceId, amount: toPaise(v) })) }
          : { mode: 'auto', preferInvoiceId: params.get('invoiceId') ?? undefined },
      };
      const p = await post<{ id: string; receiptNo: string }>('/payments', body, { 'Idempotency-Key': idemKey });
      if (!p?.id) throw new Error('Server returned invalid payment record without an ID');
      void qc.invalidateQueries();
      toast(`Payment saved — receipt ${p.receiptNo}`);
      nav(`/sales/payments/${p.id}`);
    } catch (e: any) {
      const err = e as ApiError;
      if (err.code === 'UTR_DUPLICATE') {
        setUtrUsed(String(err.body?.usedBy ?? 'another receipt'));
        setError(err.title);
      } else {
        const msg = err?.title || err?.message || 'Failed to record payment';
        setError(msg);
        errorToast(e);
      }
    } finally {
      setBusy(false);
    }
  };

  const plan = preview.data?.plan;
  const customerList = useMemo(() => {
    const list = [...(customers.data?.items ?? [])];
    if (customerId && selectedCustQuery.data) {
      const exists = list.some((c) => c.id === customerId);
      if (!exists) {
        list.unshift({
          id: customerId,
          displayName: selectedCustQuery.data.displayName || selectedCustQuery.data.display_name || 'Selected Customer',
        });
      }
    }
    return list;
  }, [customers.data?.items, customerId, selectedCustQuery.data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader back="/sales?tab=payments" title="Record Inward Payment" />
        <Button variant="secondary" size="sm" onClick={resetForm} className="self-start sm:self-auto">
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Reset form
        </Button>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Form Cards (7 Cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* SECTION 1: Customer Selection (Blue Accent) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 border-l-blue-600 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shadow-2xs">
                  <User className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Customer Identification</h3>
                  <p className="text-xs text-slate-500">Select the paying customer or search existing ledger.</p>
                </div>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
                Payer
              </span>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                label="Search Customer Ledger"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type name, phone or code…"
              />
              <SelectField
                label="Paying Customer"
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="Choose customer…"
                options={customerList.map((c) => ({ value: c.id, label: c.displayName }))}
              />
            </div>
            {customerId && selectedCustQuery.data && (
              <div className="px-5 pb-4 pt-0">
                <div className="flex items-center justify-between rounded-lg bg-blue-50/70 border border-blue-100/90 px-3 py-2 text-xs text-blue-900">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{selectedCustQuery.data.displayName || selectedCustQuery.data.display_name}</span>
                    {selectedCustQuery.data.code && <span className="text-blue-700 font-mono">({selectedCustQuery.data.code})</span>}
                    {selectedCustQuery.data.phone && <span className="text-slate-500">· {selectedCustQuery.data.phone}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomerId('')}
                    className="text-[11px] text-blue-700 hover:text-blue-900 font-medium hover:underline cursor-pointer"
                  >
                    Change customer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Transaction & Banking (Emerald Accent) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 border-l-emerald-600 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 shadow-2xs">
                  <IndianRupee className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Receipt & Banking Details</h3>
                  <p className="text-xs text-slate-500">Collected amount, settlement mode, and bank reference / UTR.</p>
                </div>
              </div>
              {f.amount && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                  {formatCurrency(toPaise(f.amount), f.currency)}
                </span>
              )}
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
                <SelectField
                  label="Payment Currency"
                  value={f.currency}
                  onChange={(e) => {
                    const c = e.target.value;
                    setF((prev) => ({
                      ...prev,
                      currency: c,
                      exchangeRate: c === 'INR' ? '1.00' : (prev.exchangeRate === '1.00' ? (c === 'USD' ? '84.00' : (c === 'AED' ? '22.80' : '1.00')) : prev.exchangeRate),
                    }));
                  }}
                  options={Object.values(CURRENCIES).map((c) => ({
                    value: c.code,
                    label: `${c.code} (${c.symbol}) - ${c.name}`,
                  }))}
                />
                {f.currency !== 'INR' && (
                  <TextField
                    label={`Exchange Rate (1 ${f.currency} in INR)`}
                    required
                    inputMode="decimal"
                    value={f.exchangeRate}
                    onChange={set('exchangeRate')}
                    placeholder="e.g. 84.00"
                    hint={`Equivalent: ₹${(((Number(f.amount) || 0) * (Number(f.exchangeRate) || 1))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`}
                  />
                )}
              </div>
              <TextField
                label={`Amount Received (${CURRENCIES[f.currency]?.symbol || f.currency})`}
                required
                inputMode="decimal"
                value={f.amount}
                onChange={set('amount')}
                placeholder="e.g. 49,500"
              />
              <TextField
                label="Receipt Date"
                type="date"
                max={today()}
                required
                value={f.date}
                onChange={set('date')}
              />
              <SelectField
                label="Payment Instrument / Mode"
                value={f.mode}
                onChange={set('mode')}
                options={[
                  { value: 'upi', label: 'UPI (Google Pay / PhonePe / Paytm)' },
                  { value: 'neft', label: 'NEFT Bank Transfer' },
                  { value: 'rtgs', label: 'RTGS (Real Time Gross Settlement)' },
                  { value: 'imps', label: 'IMPS (Immediate Payment)' },
                  { value: 'cheque', label: 'Cheque / Demand Draft' },
                  { value: 'card', label: 'Corporate Card / POS' },
                  { value: 'cash', label: 'Cash' },
                ]}
              />
              {f.mode !== 'cash' && (
                <TextField
                  label="UTR / Transaction Reference"
                  required
                  value={f.reference}
                  onChange={set('reference')}
                  onBlur={() => void checkUtr()}
                  placeholder="e.g. HDFC202611149872"
                  hint="Checked against duplicate UTRs."
                />
              )}
              <div className="sm:col-span-2">
                <SelectField
                  label="Deposited Into Company Bank Account"
                  value={f.bankAccountId}
                  onChange={set('bankAccountId')}
                  placeholder="Default Primary Account (HDFC Current A/c)"
                  options={(banks.data ?? []).map((b) => ({ value: b.id, label: b.label }))}
                />
              </div>
            </div>

            {utrUsed && (
              <div className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <Banner tone="warning">Warning: This UTR was already recorded on {utrUsed}.</Banner>
                {perm('payment:utr_override') && (
                  <div className="mt-3">
                    <TextField
                      label="Manager Authorization Reason for UTR Re-use"
                      value={override}
                      onChange={(e) => setOverride(e.target.value)}
                      placeholder="e.g. Split receipt from same lump-sum batch transfer"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: Statutory TDS Withholding (Purple Accent) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 border-l-purple-600 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 shadow-2xs">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Statutory TDS Deductions</h3>
                  <p className="text-xs text-slate-500">Tax deducted at source under Income Tax Act.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                label="TDS Deducted by Payer (₹)"
                inputMode="decimal"
                value={f.tds}
                onChange={set('tds')}
                placeholder="e.g. 990"
              />
              <TextField
                label="TDS Section"
                value={f.tdsSection}
                onChange={set('tdsSection')}
                placeholder="e.g. 194J (Professional) or 194C"
              />
              <div className="sm:col-span-2">
                <Field label="Accounting Reconciliation Notes">
                  {(fid) => (
                    <Textarea
                      id={fid}
                      value={f.note}
                      onChange={set('note')}
                      placeholder="Add any specific reconciliation remarks or customer correspondence…"
                      rows={2}
                    />
                  )}
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Invoice Allocation Card (Indigo Accent, 5 Cols) */}
        <div className="space-y-6 lg:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 border-l-indigo-600 bg-white shadow-sm sticky top-20">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 shadow-2xs">
                  <Receipt className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Invoice Allocation</h3>
                  <p className="text-xs text-slate-500">Apply against open customer invoices.</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setManual(manual ? null : {})}
                className="text-xs"
              >
                {manual ? 'Auto (FIFO)' : 'Manual Pick'}
              </Button>
            </div>

            <div className="p-5 space-y-4">
              {!customerId ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                  Select a customer to load outstanding receivables.
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-xl border border-slate-100">
                    <Table<Open>
                      rows={preview.data?.open ?? []}
                      empty={
                        <div className="p-6 text-center text-xs text-slate-500">
                          No pending unpaid invoices found. Full amount will be recorded as advance.
                        </div>
                      }
                      columns={[
                        { key: 'number', label: 'Invoice No' },
                        { key: 'dueDate', label: 'Due Date', render: (o) => date(o.dueDate) },
                        { key: 'balance', label: 'Outstanding', align: 'right', render: (o) => formatCurrency(o.balance, f.currency) },
                        {
                          key: 'apply',
                          label: 'Settled',
                          align: 'right',
                          render: (o) =>
                            manual ? (
                              <input
                                aria-label={`Apply to ${o.number}`}
                                inputMode="decimal"
                                className="w-24 rounded-lg border border-slate-200 bg-white p-1 text-right text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                                value={manual[o.id] ?? ''}
                                onChange={(e) => setManual({ ...manual, [o.id]: e.target.value })}
                              />
                            ) : toPaise(f.amount || 0) <= 0 ? (
                              <span className="font-semibold text-slate-400">{formatCurrency(0, f.currency)}</span>
                            ) : (
                              <span className="font-semibold text-emerald-700">
                                {formatCurrency(plan?.allocations?.find((a) => a.invoiceId === o.id)?.amount ?? 0, f.currency)}
                              </span>
                            ),
                        },
                      ]}
                    />
                  </div>

                  {!manual && !!plan?.advance && toPaise(f.amount) > 0 && (
                    <div className="flex items-center justify-between rounded-xl bg-indigo-50/70 p-3 text-xs text-indigo-900 border border-indigo-100">
                      <span className="font-medium">Unallocated Advance Balance:</span>
                      <span className="font-bold text-sm text-indigo-700">{formatCurrency(plan.advance, f.currency)}</span>
                    </div>
                  )}

                  {/* Summary Box */}
                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Gross Amount:</span>
                      <span className="font-semibold text-slate-900">{f.amount ? formatCurrency(toPaise(f.amount), f.currency) : formatCurrency(0, f.currency)}</span>
                    </div>
                    {f.currency !== 'INR' && (
                      <div className="flex justify-between text-xs text-slate-500 font-mono">
                        <span>Base (INR):</span>
                        <span>₹{(((Number(f.amount) || 0) * (Number(f.exchangeRate) || 1))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {f.tds && (
                      <div className="flex justify-between text-xs text-purple-700">
                        <span>TDS Withheld ({f.tdsSection || '194'}):</span>
                        <span className="font-semibold">- {formatCurrency(toPaise(f.tds), f.currency)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-slate-900">
                      <span>Net Inward Credit:</span>
                      <span className="text-emerald-700">
                        {formatCurrency(Math.max(0, toPaise(f.amount || 0) - toPaise(f.tds || 0)), f.currency)}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full shadow-md shadow-indigo-600/20"
                    busy={busy}
                    disabled={!customerId || !toPaise(f.amount) || (f.mode !== 'cash' && !f.reference)}
                    onClick={() => void submit()}
                  >
                    Save Payment Receipt
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
