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
import { Badge, Banner, Button, Card, Dialog, EmptyState, ErrorState, Field, KeyValue, LinkButton, PageHeader, SelectField, Skeleton, Table, Textarea, cx, toast } from '../ui';

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
  const q = useQuery({ queryKey: ['order', id], queryFn: () => get<Order>(`/orders/${id}`), enabled: Boolean(id && id !== 'undefined') });
  const [next, setNext] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const setStatus = useAction(() => post(`/orders/${id}/status`, { status: next, reason: reason || null }), [['order', id], ['sales']], () => {
    toast(`Order ${LABEL[next ?? ''] ?? 'updated'}`);
    setNext(null);
    setReason('');
  });
  const invoice = useAction(() => post<{ id: string }>('/invoices', { type: cfg?.gstRegistered === false ? 'bill_of_supply' : 'tax_invoice', orderId: id }), [['order', id], ['sales']], (r) => nav(`/sales/invoices/${r.id}`));

  if (q.isLoading) return <Skeleton rows={6} />;
  const is404 = !q.data || (q.error as any)?.status === 404 || (q.error as any)?.code === 'NOT_FOUND';
  if (is404) {
    return (
      <EmptyState
        title="Order not found"
        description="The requested order does not exist or has been removed."
        action={<LinkButton to="/sales?tab=orders">Back to orders</LinkButton>}
      />
    );
  }
  if (q.error || q.isError) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const o = q.data;
  const lines = Array.isArray(o.lines) ? o.lines : [];
  const invoices = Array.isArray(o.invoices) ? o.invoices : [];
  const pending = lines.some((l) => l.kind !== 'heading' && (l.pendingQty ?? 0) > 0);
  const moves = ORDER_TRANSITIONS[o.status] ?? [];
  return (
    <>
      <PageHeader back="/sales?tab=orders" title={o.number ? `Order ${o.number}` : 'Order'} subtitle={<><Link className="underline" to={`/customers/${o.customerId}`}>{o.customerName ?? 'Customer'}</Link> · <Badge status={o.status}>{LABEL[o.status] ?? o.status}</Badge></>} actions={<>
        {pending && perm('invoice:create') && !['cancelled', 'closed', 'on_hold'].includes(o.status) && <Button busy={invoice.isPending} onClick={() => invoice.mutate(undefined)}>Create invoice for pending items</Button>}
        {perm('order:status') && moves.length > 0 && <Button variant="secondary" onClick={() => setNext(moves[0]!)}>Change status</Button>}
      </>} />
      <div className="grid gap-4 lg:grid-cols-3 w-full min-w-0 max-w-full">
        <Card title="Items" className="lg:col-span-2 w-full min-w-0 max-w-full">
          {/* Mobile responsive item cards */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {lines.filter((l) => l.kind !== 'heading').map((l, i) => (
              <div key={l.id ?? i} className="rounded-xl border border-[#DCE7D9]/80 bg-white/90 p-3.5 shadow-2xs">
                <div className="text-sm font-semibold text-[#202820] break-words">{l.description}</div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 pt-2 border-t border-[#DCE7D9]/50 text-center">
                  <div className="rounded-lg bg-[#F5F9F2] p-1.5 min-w-0">
                    <span className="block text-[10px] uppercase font-bold text-[#778477]">Ordered</span>
                    <span className="text-xs font-semibold text-[#202820] truncate block">{l.qty} {l.unit ?? ''}</span>
                  </div>
                  <div className="rounded-lg bg-[#F5F9F2] p-1.5 min-w-0">
                    <span className="block text-[10px] uppercase font-bold text-[#778477]">Invoiced</span>
                    <span className="text-xs font-semibold text-[#202820] truncate block">{l.invoicedQty ?? 0}</span>
                  </div>
                  <div className={cx('rounded-lg p-1.5 min-w-0', (l.pendingQty ?? 0) > 0 ? 'bg-[#FDF5E8] text-[#D99A45]' : 'bg-[#EAF5E8] text-[#3D7952]')}>
                    <span className="block text-[10px] uppercase font-bold opacity-80">Pending</span>
                    <span className="text-xs font-bold truncate block">{l.pendingQty ?? 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop full data table */}
          <div className="hidden md:block">
            <Table rows={lines.filter((l) => l.kind !== 'heading')} columns={[
              { key: 'description', label: 'Item' },
              { key: 'qty', label: 'Ordered', align: 'right', render: (l) => `${l.qty} ${l.unit ?? ''}` },
              { key: 'invoicedQty', label: 'Invoiced', align: 'right', render: (l) => String(l.invoicedQty ?? 0) },
              { key: 'pendingQty', label: 'Pending', align: 'right', render: (l) => (l.pendingQty > 0 ? <b>{l.pendingQty}</b> : '0') },
            ]} />
          </div>
        </Card>

        <Card title="Summary" className="w-full min-w-0 max-w-full">
          <KeyValue items={[
            ['Order date', date(o.date)],
            ['Expected delivery', o.expectedDelivery ? date(o.expectedDelivery) : '—'],
            ['Order value', money(o.totals?.grandTotal ?? 0)],
            ['Invoiced', `${Math.round(o.invoicedPct ?? 0)} %`],
          ]} />
          {!pending && <div className="mt-3"><Banner tone="success">Everything on this order has been invoiced.</Banner></div>}
        </Card>

        <Card title="Invoices" className="lg:col-span-3 w-full min-w-0 max-w-full">
          {/* Mobile responsive invoice cards */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {invoices.length === 0 ? (
              <p className="text-sm text-[#778477] py-2">No invoices yet.</p>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => nav(`/sales/invoices/${inv.id}`)}
                  className="cursor-pointer rounded-xl border border-[#DCE7D9]/80 bg-white/90 p-3.5 shadow-2xs transition-all active:scale-[0.99] hover:border-[#3D7952]/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm text-[#3D7952] truncate">{inv.number ?? 'Draft'}</span>
                      <span className="text-[10px] text-[#778477] uppercase tracking-wider bg-[#F5F9F2] px-2 py-0.5 rounded-full font-medium shrink-0">
                        {inv.type.replace('_', ' ')}
                      </span>
                    </div>
                    <Badge status={inv.status} />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-[#DCE7D9]/50 text-xs">
                    <div className="text-[#778477]">
                      Total: <span className="font-bold text-[#202820]">{money(inv.grandTotal ?? 0)}</span>
                    </div>
                    <div className="text-[#778477]">
                      Balance: <span className={cx('font-bold', (inv.balanceDue ?? 0) > 0 ? 'text-[#D99A45]' : 'text-[#3D7952]')}>{money(inv.balanceDue ?? 0)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop full data table */}
          <div className="hidden md:block">
            <Table rows={invoices} empty={<p className="text-sm text-muted">No invoices yet.</p>} onRow={(i) => nav(`/sales/invoices/${i.id}`)} columns={[
              { key: 'number', label: 'Number', render: (i) => i.number ?? 'Draft' },
              { key: 'type', label: 'Type', render: (i) => i.type.replace('_', ' ') },
              { key: 'status', label: 'Status', render: (i) => <Badge status={i.status} /> },
              { key: 'grandTotal', label: 'Total', align: 'right', render: (i) => money(i?.grandTotal ?? 0) },
              { key: 'balanceDue', label: 'Balance', align: 'right', render: (i) => money(i?.balanceDue ?? 0) },
            ]} />
          </div>
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
