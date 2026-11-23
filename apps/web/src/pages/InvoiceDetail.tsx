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
import { Badge, Banner, Button, Card, Dialog, ErrorState, Field, KeyValue, LinkButton, PageHeader, SelectField, Skeleton, Textarea, TextField, toast } from '../ui';
import { errorToast } from '../ui/toast';

interface Invoice {
  id: string;
  type: string;
  number: string | null;
  status: string;
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string;
  totals: { grandTotal: number };
  paid: number;
  credited: number;
  balanceDue: number;
  lines: { kind?: string; description: string; qty: number; total: number }[];
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
  const q = useQuery({ queryKey: ['invoice', id], queryFn: () => get<Invoice>(`/invoices/${id}`) });
  const upi = useQuery({ queryKey: ['upi', id, q.data?.balanceDue], queryFn: () => get<{ uri: string | null; amount: number; qrSvg: string | null; paid: boolean }>(`/invoices/${id}/upi`), enabled: !!q.data && q.data.status !== 'draft' });
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
  if (q.error) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const i = q.data!;
  const draft = i.status === 'draft';
  const live = ['issued', 'partly_paid'].includes(i.status);
  return (
    <>
      <PageHeader back="/sales?tab=invoices" title={i.number ?? `Draft ${i.type === 'proforma' ? 'proforma' : 'invoice'}`} subtitle={<><Link className="text-primary hover:underline" to={`/customers/${i.customerId}`}>{i.customerName}</Link> · <Badge status={i.status} /></>} actions={<>
        {draft && perm('invoice:issue') && <Button busy={issue.isPending} onClick={() => issue.mutate(undefined)}>Issue invoice</Button>}
        {!draft && <Button onClick={() => void share('whatsapp')}>Share on WhatsApp</Button>}
        {!draft && <Button variant="secondary" onClick={() => void share('copy')}>Copy link</Button>}
        {!draft && <Button variant="secondary" onClick={() => void openPdf()}>PDF</Button>}
        {live && i.type !== 'proforma' && can('payment', 'create') && <LinkButton to={`/sales/payments/new?customerId=${i.customerId}&invoiceId=${i.id}`} variant="primary">Record payment</LinkButton>}
        {!draft && i.type !== 'proforma' && i.status !== 'cancelled' && perm('invoice:credit') && <Button variant="ghost" onClick={() => setCn(true)}>Credit note</Button>}
        {i.type === 'proforma' && i.status === 'issued' && perm('invoice:create') && <Button variant="secondary" busy={convert.isPending} onClick={() => convert.mutate(undefined)}>Convert to invoice</Button>}
      </>} />
      {i.cancelledByNumber && <div className="mb-3"><Banner tone="danger">Cancelled by {i.cancelledByNumber}.</Banner></div>}
      {i.convertedToId && <div className="mb-3"><Banner tone="info">Converted — <Link className="underline" to={`/sales/invoices/${i.convertedToId}`}>open the invoice</Link>.</Banner></div>}
      {i.pdf.status === 'failed' && <div className="mb-3"><Banner tone="warning" action={<Button size="sm" onClick={() => void post(`/invoices/${id}/pdf`).then(() => toast('Regenerating PDF', 'info'))}>Regenerate PDF</Button>}>PDF generation failed.</Banner></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <DocPreview type="invoice" id={id} version={i.version} />
        <div className="flex flex-col gap-4">
          <Card title="Balance">
            <KeyValue items={[['Total', money(i.totals.grandTotal)], ['Received', money(i.paid)], ['Credited', money(i.credited)], ['Balance due', <b key="b">{money(i.balanceDue)}</b>], ['Invoice date', date(i.date)], ['Due date', date(i.dueDate)]]} />
          </Card>
          {upi.data && (
            <Card title="UPI">
              {upi.data.paid ? <Badge tone="success">PAID</Badge> : upi.data.qrSvg ? (
                <div className="flex flex-col items-center gap-2 text-sm">
                  <div className="w-40 rounded-md bg-surface p-2" dangerouslySetInnerHTML={{ __html: upi.data.qrSvg }} role="img" aria-label={`UPI QR code for ${money(upi.data.amount)}`} />
                  <span className="font-semibold">{money(upi.data.amount)}</span>
                </div>
              ) : <p className="text-sm text-muted">Add a UPI ID in Settings → Masters to show a QR.</p>}
            </Card>
          )}
          {!!i.creditNotes?.length && (
            <Card title="Credit notes">
              <ul className="text-sm">{(i.creditNotes ?? []).map((c) => <li key={c.id} className="flex justify-between py-1"><span>{c.number} · {c.reason}</span><span>{money(c.amount)}</span></li>)}</ul>
            </Card>
          )}
        </div>
      </div>
      {cn && <CreditNoteDialog invoice={i} onClose={() => setCn(false)} />}
    </>
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
    <Dialog open onClose={onClose} title="Issue a credit note" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={reason.trim().length < 3 || (mode === 'amount' && !Number(amount))} busy={m.isPending} onClick={() => m.mutate(undefined)}>Issue credit note</Button></>}>
      <div className="flex flex-col gap-3">
        <SelectField label="Credit" value={mode} onChange={(e) => setMode(e.target.value as 'full')} options={[{ value: 'full', label: `Full invoice (cancels it) — ${money(invoice.totals.grandTotal - invoice.credited)}` }, { value: 'amount', label: 'An amount' }]} />
        {mode === 'amount' && <TextField label="Amount (₹)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        <Field label="Reason" required>{(fid) => <Textarea id={fid} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <p className="text-xs text-muted">Any credit beyond the balance due becomes the customer’s on-account credit.</p>
      </div>
    </Dialog>
  );
}
