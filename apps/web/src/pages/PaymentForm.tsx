/** SCR-017 Record payment (FR-070 – FR-072): allocation preview, UTR check, idempotency key per form. */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, money, toPaise, today, uid } from '../lib/format';
import { useOptions } from '../features/hooks';
import { Banner, Button, Card, Field, PageHeader, SelectField, Table, Textarea, TextField, toast } from '../ui';

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
  const customers = useQuery({ queryKey: ['cust-pick', search], queryFn: () => get<{ items: { id: string; displayName: string }[] }>(`/customers?limit=10${search.length >= 2 ? `&q=${encodeURIComponent(search)}` : ''}`) });
  const [f, setF] = useState({ date: today(), amount: '', mode: 'upi', reference: '', bankAccountId: '', tds: '', tdsSection: '', note: '' });
  const [manual, setManual] = useState<Record<string, string> | null>(null);
  const [utrUsed, setUtrUsed] = useState<string | null>(null);
  const [override, setOverride] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idemKey = useMemo(() => uid(), []); // FR-070 AC4: one key per form
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const preview = useQuery({
    queryKey: ['pay-preview', customerId, f.amount, f.tds],
    queryFn: () => post<{ open: Open[]; plan: { allocations?: { invoiceId: string; amount: number }[]; advance?: number; error?: string } }>('/payments/preview', { customerId, amount: toPaise(f.amount || 0) || 1, tdsAmount: toPaise(f.tds || 0), allocation: { mode: 'auto', preferInvoiceId: params.get('invoiceId') ?? undefined } }),
    enabled: !!customerId,
  });
  // FR-070 AC1: from an invoice, default the amount to its balance
  useEffect(() => {
    const inv = params.get('invoiceId');
    const o = preview.data?.open.find((x) => x.id === inv);
    if (o && !f.amount) setF((x) => ({ ...x, amount: String(o.balance / 100) }));
  }, [preview.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkUtr = async () => {
    if (!f.reference) return;
    const r = await get<{ usedBy?: string }>(`/payments/utr-check?ref=${encodeURIComponent(f.reference)}`).catch(() => ({ usedBy: undefined }));
    setUtrUsed(r.usedBy ?? null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        customerId, date: f.date, amount: toPaise(f.amount), mode: f.mode, reference: f.reference || null, bankAccountId: f.bankAccountId || null,
        tdsAmount: toPaise(f.tds || 0), tdsSection: f.tdsSection || null, note: f.note || null, utrOverrideReason: override || null,
        allocation: manual ? { mode: 'manual', items: Object.entries(manual).filter(([, v]) => toPaise(v) > 0).map(([invoiceId, v]) => ({ invoiceId, amount: toPaise(v) })) } : { mode: 'auto', preferInvoiceId: params.get('invoiceId') ?? undefined },
      };
      const p = await post<{ id: string; receiptNo: string }>('/payments', body, { 'Idempotency-Key': idemKey });
      void qc.invalidateQueries(); // balances change on invoices, customer, statements, home (FR-071)
      toast(`Payment saved — receipt ${p.receiptNo}`);
      nav(`/sales/payments/${p.id}`);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'UTR_DUPLICATE') setUtrUsed(String(err.body.usedBy ?? 'another receipt'));
      setError(err.title);
    } finally {
      setBusy(false);
    }
  };

  const plan = preview.data?.plan;
  return (
    <>
      <PageHeader back="/sales?tab=payments" title="Record payment" />
      {error && <div className="mb-3"><Banner tone="danger">{error}</Banner></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Payment">
          <div className="grid gap-3 md:grid-cols-2">
            {!params.get('customerId') && (
              <>
                <TextField label="Find customer" value={search} onChange={(e) => setSearch(e.target.value)} />
                <SelectField label="Customer" required value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Choose…" options={(customers.data?.items ?? []).map((c) => ({ value: c.id, label: c.displayName }))} />
              </>
            )}
            <TextField label="Amount received (₹)" required inputMode="decimal" value={f.amount} onChange={set('amount')} />
            <TextField label="Date" type="date" max={today()} required value={f.date} onChange={set('date')} />
            <SelectField label="Mode" value={f.mode} onChange={set('mode')} options={[['upi', 'UPI'], ['neft', 'NEFT'], ['rtgs', 'RTGS'], ['imps', 'IMPS'], ['cheque', 'Cheque'], ['card', 'Card'], ['cash', 'Cash']].map(([v, l]) => ({ value: v!, label: l! }))} />
            {f.mode !== 'cash' && <TextField label="UTR / reference" required value={f.reference} onChange={set('reference')} onBlur={() => void checkUtr()} />}
            <SelectField label="Received in" value={f.bankAccountId} onChange={set('bankAccountId')} placeholder="Not specified" options={(banks.data ?? []).map((b) => ({ value: b.id, label: b.label }))} />
            <TextField label="TDS deducted (₹)" inputMode="decimal" value={f.tds} onChange={set('tds')} />
            {!!f.tds && <TextField label="TDS section" value={f.tdsSection} onChange={set('tdsSection')} placeholder="e.g. 194J" />}
            <div className="md:col-span-2"><Field label="Note">{(fid) => <Textarea id={fid} value={f.note} onChange={set('note')} />}</Field></div>
          </div>
          {utrUsed && (
            <div className="mt-3">
              <Banner tone="warning">UTR already used on {utrUsed}.</Banner>
              {perm('payment:utr_override') && <div className="mt-2"><TextField label="Reason to use it again" value={override} onChange={(e) => setOverride(e.target.value)} /></div>}
            </div>
          )}
        </Card>
        <Card title="Apply to invoices" actions={<Button size="sm" variant="ghost" onClick={() => setManual(manual ? null : {})}>{manual ? 'Use oldest-first' : 'Choose manually'}</Button>}>
          {!customerId ? <p className="text-sm text-muted">Choose a customer to see open invoices.</p> : (
            <>
              <Table<Open>
                rows={preview.data?.open ?? []}
                empty={<p className="text-sm text-muted">No open invoices — the whole amount will be kept as an advance.</p>}
                columns={[
                  { key: 'number', label: 'Invoice' },
                  { key: 'dueDate', label: 'Due', render: (o) => date(o.dueDate) },
                  { key: 'balance', label: 'Balance', align: 'right', render: (o) => money(o.balance) },
                  { key: 'apply', label: 'Apply', align: 'right', render: (o) => (manual ? <input aria-label={`Apply to ${o.number}`} inputMode="decimal" className="w-24 rounded-sm border border-border-input bg-surface p-1 text-right" value={manual[o.id] ?? ''} onChange={(e) => setManual({ ...manual, [o.id]: e.target.value })} /> : money(plan?.allocations?.find((a) => a.invoiceId === o.id)?.amount ?? 0)) },
                ]}
              />
              {!manual && !!plan?.advance && toPaise(f.amount) > 0 && <p className="mt-2 text-sm">Advance kept on account: <b>{money(plan.advance)}</b></p>}
            </>
          )}
          <Button className="mt-4 w-full" busy={busy} disabled={!customerId || !toPaise(f.amount) || (f.mode !== 'cash' && !f.reference)} onClick={() => void submit()}>Save payment</Button>
        </Card>
      </div>
    </>
  );
}
