/** SCR-013 Order detail: status lifecycle, invoiced vs pending, create invoice (FR-059 – FR-061). Shown only when the Orders module is on. */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ORDER_TRANSITIONS } from '@ss/domain';
import { get, post } from '../lib/api';
import { useAppConfig } from '../lib/appConfig';
import { useAuth } from '../lib/auth';
import { date, money } from '../lib/format';
import { useAction } from '../features/hooks';
import { Badge, Banner, Button, Card, Dialog, ErrorState, Field, KeyValue, PageHeader, SelectField, Skeleton, Table, Textarea, toast } from '../ui';

interface OrderLine { id: string; kind?: string; description: string; qty: number; invoicedQty?: number; pendingQty: number; unit?: string }
interface Order {
  id: string;
  number: string;
  status: string;
  date: string;
  customerId: string;
  customerName?: string;
  expectedDelivery?: string | null;
  totals: { grandTotal: number };
  lines: OrderLine[];
  invoices: { id: string; number: string | null; type: string; status: string; grandTotal: number; balanceDue: number }[];
  invoicedPct?: number;
}

const LABEL: Record<string, string> = { confirmed: 'Confirmed', in_progress: 'In progress', on_hold: 'On hold', delivered: 'Delivered', closed: 'Closed', cancelled: 'Cancelled' };

export default function OrderDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { perm } = useAuth();
  const cfg = useAppConfig().data;
  const q = useQuery({ queryKey: ['order', id], queryFn: () => get<Order>(`/orders/${id}`) });
  const [next, setNext] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const setStatus = useAction(() => post(`/orders/${id}/status`, { status: next, reason: reason || null }), [['order', id], ['sales']], () => {
    toast(`Order ${LABEL[next ?? ''] ?? 'updated'}`);
    setNext(null);
    setReason('');
  });
  const invoice = useAction(() => post<{ id: string }>('/invoices', { type: cfg?.gstRegistered === false ? 'bill_of_supply' : 'tax_invoice', orderId: id }), [['order', id], ['sales']], (r) => nav(`/sales/invoices/${r.id}`));

  if (q.isLoading) return <Skeleton rows={6} />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const o = q.data;
  const lines = Array.isArray(o.lines) ? o.lines : [];
  const invoices = Array.isArray(o.invoices) ? o.invoices : [];
  const pending = lines.some((l) => l.kind !== 'heading' && (l.pendingQty ?? 0) > 0);
  const moves = ORDER_TRANSITIONS[o.status] ?? [];
  return (
    <>
      <PageHeader back="/sales?tab=orders" title={`Order ${o.number}`} subtitle={<><Link className="underline" to={`/customers/${o.customerId}`}>{o.customerName ?? 'Customer'}</Link> · <Badge status={o.status}>{LABEL[o.status] ?? o.status}</Badge></>} actions={<>
        {pending && perm('invoice:create') && !['cancelled', 'closed', 'on_hold'].includes(o.status) && <Button busy={invoice.isPending} onClick={() => invoice.mutate(undefined)}>Create invoice for pending items</Button>}
        {perm('order:status') && moves.length > 0 && <Button variant="secondary" onClick={() => setNext(moves[0]!)}>Change status</Button>}
      </>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Items" className="lg:col-span-2">
          <Table rows={lines.filter((l) => l.kind !== 'heading')} columns={[
            { key: 'description', label: 'Item' },
            { key: 'qty', label: 'Ordered', align: 'right', render: (l) => `${l.qty} ${l.unit ?? ''}` },
            { key: 'invoicedQty', label: 'Invoiced', align: 'right', render: (l) => String(l.invoicedQty ?? 0) },
            { key: 'pendingQty', label: 'Pending', align: 'right', render: (l) => (l.pendingQty > 0 ? <b>{l.pendingQty}</b> : '0') },
          ]} />
        </Card>
        <Card title="Summary">
          <KeyValue items={[
            ['Order date', date(o.date)],
            ['Expected delivery', o.expectedDelivery ? date(o.expectedDelivery) : '—'],
            ['Order value', money(o.totals.grandTotal)],
            ['Invoiced', `${Math.round(o.invoicedPct ?? 0)} %`],
          ]} />
          {!pending && <div className="mt-3"><Banner tone="success">Everything on this order has been invoiced.</Banner></div>}
        </Card>
        <Card title="Invoices" className="lg:col-span-3">
          <Table rows={invoices} empty={<p className="text-sm text-muted">No invoices yet.</p>} onRow={(i) => nav(`/sales/invoices/${i.id}`)} columns={[
            { key: 'number', label: 'Number', render: (i) => i.number ?? 'Draft' },
            { key: 'type', label: 'Type', render: (i) => i.type.replace('_', ' ') },
            { key: 'status', label: 'Status', render: (i) => <Badge status={i.status} /> },
            { key: 'grandTotal', label: 'Total', align: 'right', render: (i) => money(i.grandTotal) },
            { key: 'balanceDue', label: 'Balance', align: 'right', render: (i) => money(i.balanceDue) },
          ]} />
        </Card>
      </div>
      <Dialog open={!!next} onClose={() => setNext(null)} title="Change order status" footer={<><Button variant="secondary" onClick={() => setNext(null)}>Cancel</Button><Button busy={setStatus.isPending} disabled={next === 'cancelled' && !reason.trim()} onClick={() => setStatus.mutate(undefined)}>Save status</Button></>}>
        <div className="flex flex-col gap-3">
          <SelectField label="New status" value={next ?? ''} onChange={(e) => setNext(e.target.value)} options={moves.map((m) => ({ value: m, label: LABEL[m] ?? m }))} />
          {next === 'cancelled' && <Field label="Reason" required>{(fid) => <Textarea id={fid} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>}
        </div>
      </Dialog>
    </>
  );
}
