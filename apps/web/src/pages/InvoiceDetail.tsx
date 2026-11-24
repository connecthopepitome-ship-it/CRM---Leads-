/** SCR-015 Invoice detail + SCR-019 credit note (FR-063 – FR-069). */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { renderTemplate } from '@ss/domain';
import { api, get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, money } from '../lib/format';
import { DocPreview } from '../features/DocPreview';
import { useAction, useOptions } from '../features/hooks';
import { Badge, Banner, Button, Card, Dialog, EmptyState, ErrorState, Field, LinkButton, SelectField, Skeleton, Table, Textarea, toast } from '../ui';
import { errorToast } from '../ui/toast';
import { 
  ArrowLeft, Copy, FileText, CreditCard, Calendar, 
  MapPin, Building2, Send, RotateCcw, AlertTriangle 
} from 'lucide-react';

interface InvoiceLine {
  id?: string;
  kind?: string;
  description: string;
  qty: number;
  rate?: number;
  taxRatePct?: number;
  amount?: number;
  total?: number;
  unit?: string;
}

interface Invoice {
  id: string;
  type: string;
  number: string | null;
  status: string;
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string;
  totals: {
    grandTotal: number;
    subTotal?: number;
    taxable?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    roundOff?: number;
    discountTotal?: number;
  };
  paid: number;
  credited: number;
  balanceDue: number;
  lines: InvoiceLine[];
  creditNotes: { id: string; number: string; amount: number; reason: string }[];
  allocations: { paymentId: string | null; amount: number }[];
  cancelledByNumber?: string;
  convertedToId?: string;
  pdf: { status: string };
  version: number;
}

export default function InvoiceDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { perm, can } = useAuth();
  const q = useQuery({ queryKey: ['invoice', id], queryFn: () => get<Invoice>(`/invoices/${id}`), enabled: Boolean(id && id !== 'undefined') });
  const upi = useQuery({ queryKey: ['upi', id, q.data?.balanceDue], queryFn: () => get<{ uri: string | null; amount: number; qrSvg: string | null; paid: boolean }>(`/invoices/${id}/upi`), enabled: !!q.data && q.data.status !== 'draft' });
  const cust = useQuery({ queryKey: ['customer', q.data?.customerId], queryFn: () => get<any>(`/customers/${q.data!.customerId}`), enabled: !!q.data?.customerId });
  const templates = useOptions('messageTemplates');
  const [cn, setCn] = useState(false);
  const issue = useAction(() => api(`/invoices/${id}/issue`, { method: 'POST', body: {}, headers: { 'If-Match': String(q.data?.version) } }), [['invoice', id], ['sales']], () => toast('Invoice issued'));
  const convert = useAction(() => post<{ id: string }>(`/invoices/${id}/convert`), [['invoice', id]], (r) => nav(`/sales/invoices/${r.id}`));

  const share = async (via: 'whatsapp' | 'copy') => {
    try {
      const r = await post<{ url: string }>('/share-links', { documentType: 'invoice', documentId: id });
      if (via === 'copy') {
        await navigator.clipboard.writeText(r.url);
        return toast('Invoice link copied');
      }
      const c = await get<{ contacts: { phone: string | null; name: string; isPrimary: boolean }[] }>(`/customers/${q.data!.customerId}`);
      const contact = c.contacts.find((x) => x.isPrimary && x.phone) ?? c.contacts.find((x) => x.phone);
      if (!contact) return toast('Add a mobile number to the customer first.', 'danger');
      const tpl = templates.data?.find((t) => t.key === 'invoice');
      const bodyTpl = (tpl?.data as { body?: string } | undefined)?.body ?? 'Invoice {{doc_no}}: {{link}}';
      const text = renderTemplate(String(bodyTpl), { name: contact.name, doc_no: q.data?.number ?? '', amount: ((q.data?.balanceDue ?? 0) / 100).toFixed(2), link: r.url });
      const w = await post<{ url: string }>('/messages/whatsapp', { recordType: 'customer', recordId: q.data!.customerId, text });
      window.open(w.url, '_blank', 'noopener');
    } catch (e) {
      errorToast(e);
    }
  };

  const openPdf = async () => {
    try {
      const r = await post<{ url: string }>('/share-links', { documentType: 'invoice', documentId: id });
      window.open(`/api/v1/public/s/${r.url.split('/s/')[1]}/pdf`, '_blank', 'noopener');
    } catch (e) {
      errorToast(e);
    }
  };

  if (q.isLoading) return <Skeleton rows={6} />;
  const is404 = !q.data || (q.error as any)?.status === 404 || (q.error as any)?.code === 'NOT_FOUND';
  if (is404) {
    return (
      <EmptyState
        title="Invoice not found"
        description="The requested invoice does not exist or has been removed."
        action={<LinkButton to="/sales?tab=invoices">Back to invoices</LinkButton>}
      />
    );
  }
  if (q.error) return <ErrorState error={q.error} retry={() => void q.refetch()} />;

  const i = q.data;
  const cData = cust.data;
  const draft = i.status === 'draft';
  const live = ['issued', 'partly_paid'].includes(i.status);

  const subTotal = i.totals?.subTotal ?? i.totals?.taxable ?? Math.round((i.totals?.grandTotal ?? 0) / 1.18);
  const discountTotal = i.totals?.discountTotal ?? 0;
  const cgst = i.totals?.cgst ?? 0;
  const sgst = i.totals?.sgst ?? 0;
  const igst = i.totals?.igst ?? 0;
  const grandTotal = i.totals?.grandTotal ?? 0;
  const paid = i.paid ?? 0;
  const balanceDue = i.balanceDue ?? (grandTotal - paid);

  const lines = (i.lines ?? []).filter((l) => l.kind !== 'heading');

  return (
    <div className="space-y-5 pb-16">
      {/* Back Link */}
      <div>
        <Link
          to="/sales?tab=invoices"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3D7952] hover:text-[#233D2D] transition-colors group"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Invoices</span>
        </Link>
      </div>

      {/* ============================================================== */}
      {/* PHASE 3: REBUILT INVOICE HEADER & RESPONSIVE ACTIONS */}
      {/* ============================================================== */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-[#DCE7D9]/60 pb-5">
        <div className="w-full md:w-auto min-w-0 max-w-full">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#778477]">
              {i.type === 'proforma' ? 'Proforma Invoice' : 'Tax Invoice'}
            </span>
            <Badge status={i.status} />
          </div>

          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#202820] font-mono whitespace-nowrap sm:whitespace-normal break-normal max-w-full"
          >
            {i.number ?? `Draft ${i.type === 'proforma' ? 'proforma' : 'invoice'}`}
          </h1>

          <p className="text-xs sm:text-sm text-[#778477] mt-1 font-medium">
            Recipient: <Link className="font-bold text-[#3D7952] hover:underline" to={`/customers/${i.customerId}`}>{i.customerName}</Link>
          </p>
        </div>

        {/* Desktop Action Buttons (Visible only on >= md screens) */}
        <div className="hidden md:flex flex-wrap items-center gap-2">
          {draft && perm('invoice:issue') && (
            <Button busy={issue.isPending} onClick={() => issue.mutate(undefined)}>
              Issue invoice
            </Button>
          )}
          {!draft && (
            <Button onClick={() => void share('whatsapp')} className="bg-[#25D366] hover:bg-[#20bd5a] text-white">
              Share WhatsApp
            </Button>
          )}
          {!draft && <Button variant="secondary" onClick={() => void share('copy')}>Copy link</Button>}
          {!draft && <Button variant="secondary" onClick={() => void openPdf()}>PDF</Button>}
          {live && i.type !== 'proforma' && can('payment', 'create') && (
            <LinkButton to={`/sales/payments/new?customerId=${i.customerId}&invoiceId=${i.id}`} variant="primary">
              Record payment
            </LinkButton>
          )}
          {!draft && i.type !== 'proforma' && i.status !== 'cancelled' && perm('invoice:credit') && (
            <Button variant="ghost" onClick={() => setCn(true)}>Credit note</Button>
          )}
          {i.type === 'proforma' && i.status === 'issued' && perm('invoice:create') && (
            <Button variant="secondary" busy={convert.isPending} onClick={() => convert.mutate(undefined)}>
              Convert to invoice
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Responsive Action Rows (Visible only on < md screens) */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {!draft && (
          <Button
            onClick={() => void share('whatsapp')}
            className="w-full justify-center bg-[#25D366] hover:bg-[#20bd5a] text-white py-2.5 font-bold shadow-xs text-xs"
          >
            <Send size={14} className="mr-1.5" />
            <span>Share on WhatsApp</span>
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2">
          {!draft && (
            <Button
              variant="secondary"
              onClick={() => void share('copy')}
              className="w-full justify-center text-xs py-2 font-semibold"
            >
              <Copy size={13} className="mr-1.5 text-[#3D7952]" />
              <span>Copy Link</span>
            </Button>
          )}
          {!draft && (
            <Button
              variant="secondary"
              onClick={() => void openPdf()}
              className="w-full justify-center text-xs py-2 font-semibold"
            >
              <FileText size={13} className="mr-1.5 text-[#3D7952]" />
              <span>PDF</span>
            </Button>
          )}
        </div>

        {live && i.type !== 'proforma' && can('payment', 'create') && (
          <LinkButton
            to={`/sales/payments/new?customerId=${i.customerId}&invoiceId=${i.id}`}
            variant="primary"
            className="w-full justify-center py-2.5 text-xs font-bold shadow-xs"
          >
            <CreditCard size={14} className="mr-1.5" />
            <span>Record Payment</span>
          </LinkButton>
        )}

        {!draft && i.type !== 'proforma' && i.status !== 'cancelled' && perm('invoice:credit') && (
          <Button
            variant="ghost"
            onClick={() => setCn(true)}
            className="w-full justify-center text-xs py-2 text-[#778477] border border-[#DCE7D9] bg-white hover:bg-[#F5F9F2]"
          >
            <RotateCcw size={13} className="mr-1.5" />
            <span>Issue Credit Note</span>
          </Button>
        )}

        {draft && perm('invoice:issue') && (
          <Button
            busy={issue.isPending}
            onClick={() => issue.mutate(undefined)}
            className="w-full justify-center bg-[#3D7952] text-white py-2.5 text-xs font-bold shadow-xs"
          >
            Issue Invoice
          </Button>
        )}

        {i.type === 'proforma' && i.status === 'issued' && perm('invoice:create') && (
          <Button
            variant="secondary"
            busy={convert.isPending}
            onClick={() => convert.mutate(undefined)}
            className="w-full justify-center py-2 text-xs font-semibold"
          >
            Convert to Invoice
          </Button>
        )}
      </div>

      {i.cancelledByNumber && (
        <Banner tone="danger">Cancelled by {i.cancelledByNumber}.</Banner>
      )}
      {i.convertedToId && (
        <Banner tone="info">
          Converted — <Link className="underline font-bold" to={`/sales/invoices/${i.convertedToId}`}>open the invoice</Link>.
        </Banner>
      )}
      {i.pdf?.status === 'failed' && (
        <Banner
          tone="warning"
          action={
            <Button size="sm" onClick={() => void post(`/invoices/${id}/pdf`).then(() => toast('Regenerating PDF', 'info'))}>
              Regenerate PDF
            </Button>
          }
        >
          PDF generation failed.
        </Banner>
      )}

      {/* ============================================================== */}
      {/* PHASE 3: CUSTOMER INFORMATION FULL-WIDTH CARD */}
      {/* ============================================================== */}
      <Card title="Customer Information">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#778477] block mb-1">
              Customer Name
            </span>
            <Link
              to={`/customers/${i.customerId}`}
              className="font-bold text-sm text-[#202820] hover:text-[#3D7952] hover:underline block"
            >
              {i.customerName}
            </Link>
            {cData?.code && (
              <span className="text-[11px] font-mono text-[#778477] mt-0.5 block">
                Code: {cData.code}
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#778477] block mb-1">
              GSTIN & Tax Identifiers
            </span>
            <span className="font-mono font-semibold text-[#202820] block">
              {cData?.gstin || 'Not registered / Unregistered consumer'}
            </span>
            {cData?.phone && (
              <span className="text-[11px] font-mono text-[#778477] mt-0.5 block">
                Phone: {cData.phone}
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#778477] block mb-1">
              Billing Address
            </span>
            <div className="flex items-start gap-1.5 text-[#202820]">
              <MapPin size={13} className="text-[#3D7952] shrink-0 mt-0.5" />
              <span>{cData?.address || cData?.city || 'Bengaluru, Karnataka, India'}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#DCE7D9]/60 md:border-0 md:pt-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#778477] block mb-1">
              Invoice Date
            </span>
            <div className="flex items-center gap-1.5 text-[#202820] font-semibold">
              <Calendar size={13} className="text-[#3D7952]" />
              <span>{date(i.date)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#DCE7D9]/60 md:border-0 md:pt-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#778477] block mb-1">
              Payment Due Date
            </span>
            <div className="flex items-center gap-1.5 text-[#202820] font-semibold">
              <Calendar size={13} className="text-[#3D7952]" />
              <span>{date(i.dueDate)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#DCE7D9]/60 md:border-0 md:pt-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#778477] block mb-1">
              Payment Status
            </span>
            <Badge status={i.status} />
          </div>
        </div>
      </Card>

      {/* Main Content Grid: Line Items + Summary */}
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5">
          {/* ============================================================== */}
          {/* PHASE 3: LINE ITEMS (Mobile Cards + Desktop Table) */}
          {/* ============================================================== */}
          <Card title="Line Items">
            {lines.length === 0 ? (
              <p className="text-xs text-[#778477]">No line items specified.</p>
            ) : (
              <>
                {/* Mobile Line Item Cards (Visible on < md) */}
                <div className="space-y-3 md:hidden">
                  {lines.map((l, idx) => {
                    const lRate = l.rate ?? (l.amount && l.qty ? l.amount / l.qty : (grandTotal ? Math.round(grandTotal / 1.18 / l.qty) : 0));
                    const lAmount = l.amount ?? l.total ?? (grandTotal ? Math.round(grandTotal / 1.18) : 0);

                    return (
                      <div
                        key={l.id ?? idx}
                        className="rounded-xl border border-[#DCE7D9] bg-[#F5F9F2] p-3.5 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-[#202820] text-sm">
                            {l.description}
                          </span>
                          <span className="rounded-full bg-[#E3EFDF] border border-[#CFE5CB] px-2 py-0.5 text-[10px] font-bold text-[#233D2D] shrink-0">
                            GST {l.taxRatePct ?? 18}%
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#DCE7D9]/60 text-[#778477]">
                          <div>
                            <span className="block text-[10px] uppercase font-bold">Qty:</span>
                            <span className="font-semibold text-[#202820]">{l.qty} {l.unit ?? 'Nos'}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase font-bold">Rate:</span>
                            <span className="font-mono font-semibold text-[#202820]">{money(lRate)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#DCE7D9]/60 font-bold">
                          <span className="text-[#778477]">Line Total:</span>
                          <span className="font-mono text-sm text-[#3D7952]">{money(lAmount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table (Visible on >= md) */}
                <div className="hidden md:block">
                  <Table
                    rows={lines}
                    columns={[
                      { key: 'description', label: 'Item / Description' },
                      { key: 'qty', label: 'Qty', align: 'right', render: (l) => `${l.qty} ${l.unit ?? ''}` },
                      { key: 'rate', label: 'Rate', align: 'right', render: (l) => money(l.rate ?? (l.amount ? l.amount / l.qty : (grandTotal ? Math.round(grandTotal / 1.18 / l.qty) : 0))) },
                      { key: 'taxRatePct', label: 'GST', align: 'right', render: (l) => `${l.taxRatePct ?? 18}%` },
                      { key: 'amount', label: 'Amount', align: 'right', render: (l) => money(l.amount ?? l.total ?? (grandTotal ? Math.round(grandTotal / 1.18) : 0)) },
                    ]}
                  />
                </div>
              </>
            )}
          </Card>

          {/* Desktop PDF Preview Frame */}
          <div className="hidden md:block">
            <DocPreview type="invoice" id={id} version={i.version} />
          </div>
        </div>

        {/* ============================================================== */}
        {/* PHASE 3: INVOICE SUMMARY CARD */}
        {/* ============================================================== */}
        <div className="flex flex-col gap-5">
          <Card title="Invoice Summary">
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-[#778477]">
                <span>Taxable Subtotal</span>
                <span className="font-mono font-semibold text-[#202820]">{money(subTotal)}</span>
              </div>

              {discountTotal > 0 && (
                <div className="flex items-center justify-between text-[#3D7952]">
                  <span>Discount Applied</span>
                  <span className="font-mono font-semibold">-{money(discountTotal)}</span>
                </div>
              )}

              {cgst > 0 && (
                <div className="flex items-center justify-between text-[#778477]">
                  <span>CGST (9%)</span>
                  <span className="font-mono font-medium text-[#202820]">{money(cgst)}</span>
                </div>
              )}

              {sgst > 0 && (
                <div className="flex items-center justify-between text-[#778477]">
                  <span>SGST (9%)</span>
                  <span className="font-mono font-medium text-[#202820]">{money(sgst)}</span>
                </div>
              )}

              {igst > 0 && (
                <div className="flex items-center justify-between text-[#778477]">
                  <span>IGST (18%)</span>
                  <span className="font-mono font-medium text-[#202820]">{money(igst)}</span>
                </div>
              )}

              {/* Total Highlight */}
              <div className="flex items-center justify-between border-t border-[#DCE7D9] pt-2 font-bold text-sm text-[#202820]">
                <span>Grand Total</span>
                <span className="font-mono text-base text-[#3D7952]">{money(grandTotal)}</span>
              </div>

              <div className="flex items-center justify-between text-[#778477] pt-1">
                <span>Amount Paid</span>
                <span className="font-mono font-medium text-[#202820]">{money(paid)}</span>
              </div>

              {i.credited > 0 && (
                <div className="flex items-center justify-between text-[#D66B68]">
                  <span>Credited Amount</span>
                  <span className="font-mono font-medium">-{money(i.credited)}</span>
                </div>
              )}

              {/* Balance Due */}
              <div className="flex items-center justify-between border-t border-[#DCE7D9]/60 pt-2 font-bold">
                <span className="text-[#202820]">Balance Due</span>
                <span className={`font-mono text-sm ${balanceDue > 0 ? 'text-[#D99A45]' : 'text-[#3D7952]'}`}>
                  {money(balanceDue)}
                </span>
              </div>
            </div>
          </Card>

          {upi.data && (
            <Card title="UPI Payment">
              {upi.data.paid ? (
                <Badge tone="success">PAID VIA UPI</Badge>
              ) : upi.data.qrSvg ? (
                <div className="flex flex-col items-center gap-2 text-xs">
                  <div className="w-36 rounded-xl bg-white p-2 border border-[#DCE7D9]" dangerouslySetInnerHTML={{ __html: upi.data.qrSvg }} role="img" aria-label={`UPI QR code for ${money(upi.data.amount)}`} />
                  <span className="font-mono font-bold text-[#202820]">{money(upi.data.amount)}</span>
                </div>
              ) : (
                <p className="text-xs text-[#778477]">Add a UPI ID in Settings to show QR payments.</p>
              )}
            </Card>
          )}

          {!!i.creditNotes?.length && (
            <Card title="Credit Notes">
              <ul className="text-xs space-y-1.5">
                {i.creditNotes.map((c) => (
                  <li key={c.id} className="flex justify-between py-1 border-b border-[#DCE7D9]/40 last:border-0">
                    <span className="font-medium text-[#202820]">{c.number} · {c.reason}</span>
                    <span className="font-mono font-bold text-[#D66B68]">-{money(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {cn && <CreditNoteDialog invoice={i} onClose={() => setCn(false)} />}
    </div>
  );
}

function CreditNoteDialog({ invoice, onClose }: { invoice: Invoice; onClose(): void }) {
  const [mode, setMode] = useState<'full' | 'amount'>('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const m = useAction(() => post(`/invoices/${invoice.id}/credit-notes`, { mode, amount: mode === 'amount' ? Math.round(Number(amount) * 100) : undefined, reason }), [['invoice', invoice.id]], () => {
    toast('Credit note issued');
    onClose();
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Issue a Credit Note"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={!reason.trim() || (mode === 'amount' && !(Number(amount) > 0))}
            busy={m.isPending}
            onClick={() => m.mutate(undefined)}
          >
            Issue Credit Note
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <SelectField
          label="Credit Option"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'full')}
          options={[
            { value: 'full', label: `Full invoice (cancels it) — ${money((invoice.totals?.grandTotal ?? 0) - (invoice.credited ?? 0))}` },
            { value: 'amount', label: 'An amount' },
          ]}
        />
        {mode === 'amount' && (
          <Field label="Amount to credit (₹)" required>
            {(fid) => (
              <input
                id={fid}
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-[#DCE7D9] bg-white px-3 py-2 text-xs"
              />
            )}
          </Field>
        )}
        <Field label="Reason" required>
          {(fid) => (
            <Textarea
              id={fid}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Rate adjustment or billing correction"
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
