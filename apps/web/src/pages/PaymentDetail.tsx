/** SCR-018 Payment detail / receipt + reverse (FR-072, FR-073). */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, money } from '../lib/format';
import { DocPreview } from '../features/DocPreview';
import { useAction } from '../features/hooks';
import { Badge, Banner, Button, Card, Dialog, EmptyState, ErrorState, Field, KeyValue, LinkButton, PageHeader, Skeleton, Textarea, toast } from '../ui';
import { errorToast } from '../ui/toast';

interface Payment {
  id: string;
  receiptNo: string;
  customerId: string;
  customerName: string;
  date: string;
  amount: number;
  tdsAmount: number;
  mode: string;
  reference: string | null;
  status: string;
  allocations: { invoiceId: string; number: string; amount: number }[];
  advance: number;
  reversal: { reason: string; byName: string; at: string } | null;
  version: number;
}

export default function PaymentDetail() {
  const { id = '' } = useParams();
  const { perm } = useAuth();
  const q = useQuery({ queryKey: ['payment', id], queryFn: () => get<Payment>(`/payments/${id}`), enabled: Boolean(id && id !== 'undefined') });
  const [rev, setRev] = useState(false);
  const [reason, setReason] = useState('');
  const reverse = useAction(() => post(`/payments/${id}/reverse`, { reason }), [['payment', id], ['invoice'], ['upi'], ['sales'], ['customer'], ['customers']], () => {
    toast('Payment reversed');
    setRev(false);
  });
  const share = async () => {
    try {
      const r = await post<{ url: string }>('/share-links', { documentType: 'receipt', documentId: id });
      await navigator.clipboard.writeText(r.url);
      toast('Receipt link copied');
    } catch (e) {
      errorToast(e);
    }
  };
  if (q.isLoading) return <Skeleton rows={5} />;
  const is404 = !q.data || (q.error as any)?.status === 404 || (q.error as any)?.code === 'NOT_FOUND';
  if (is404) {
    return (
      <EmptyState
        title="Payment not found"
        description="The requested payment receipt does not exist or has been removed."
        action={<LinkButton to="/sales?tab=payments">Back to payments</LinkButton>}
      />
    );
  }
  if (q.error) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const p = q.data;
  return (
    <>
      <PageHeader back="/sales?tab=payments" title={`Receipt ${p.receiptNo ?? '—'}`} subtitle={<><Link to={`/customers/${p.customerId}`} className="text-primary hover:underline">{p.customerName ?? 'Customer'}</Link> · <Badge status={p.status ?? 'active'} /></>} actions={<>
        <Button variant="secondary" onClick={() => void share()}>Share receipt</Button>
        {p.status === 'active' && perm('payment:reverse') && <Button variant="danger" onClick={() => setRev(true)}>Reverse payment</Button>}
      </>} />
      {p.reversal && <div className="mb-3"><Banner tone="danger">Reversed by {p.reversal.byName}: {p.reversal.reason}</Banner></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <DocPreview type="receipt" id={id} version={p.version} />
        <Card title="Details">
          <KeyValue items={[['Amount', money(p.amount ?? 0)], ['TDS', p.tdsAmount ? money(p.tdsAmount) : '—'], ['Date', date(p.date)], ['Mode', (p.mode ?? 'NEFT').toUpperCase()], ['Reference', p.reference], ['Advance kept', p.advance ? money(p.advance) : '—']]} />
          <h3 className="mt-3 text-sm font-semibold">Applied to</h3>
          <ul className="text-sm">{(p.allocations ?? []).map((a) => <li key={a.invoiceId} className="flex justify-between py-1"><Link to={`/sales/invoices/${a.invoiceId}`} className="text-primary hover:underline">{a.number}</Link><span>{money(a.amount)}</span></li>)}</ul>
        </Card>
      </div>
      <Dialog open={rev} onClose={() => setRev(false)} title="Reverse this payment?" footer={<><Button variant="secondary" onClick={() => setRev(false)}>Cancel</Button><Button variant="danger" disabled={reason.trim().length < 3} busy={reverse.isPending} onClick={() => reverse.mutate(undefined)}>Reverse payment</Button></>}>
        <p className="mb-3 text-sm">Invoice balances and their UPI QR amounts are restored, and the receipt is marked cancelled.</p>
        <Field label="Reason" required>{(fid) => <Textarea id={fid} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Cheque bounced" />}</Field>
      </Dialog>
    </>
  );
}
