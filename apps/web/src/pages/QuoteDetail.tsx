/** SCR-011 Quote detail: status, preview, send (WhatsApp/email/link), approval, revisions, create invoice (FR-053 – FR-059). */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, money, relative } from '../lib/format';
import { useAction } from '../features/hooks';
import { DocPreview } from '../features/DocPreview';
import { Badge, Banner, Button, Card, Dialog, EmptyState, ErrorState, Field, KeyValue, LinkButton, PageHeader, Skeleton, Textarea, toast } from '../ui';
import { errorToast } from '../ui/toast';

interface Quote {
  id: string;
  displayNumber: string | null;
  status: string;
  revision: number;
  partyType: string;
  partyId: string;
  partyName: string;
  customerId: string | null;
  ownerId: string;
  date: string;
  validUntil: string;
  totals: { grandTotal: number; maxDiscountPct: number };
  maxDiscountPct: number;
  viewCount: number;
  lastViewedAt: string | null;
  isLatest: boolean;
  orderId: string | null;
  approval: { decision: string | null; comment: string | null; byName?: string } | null;
  response: { type: string; name: string | null; comment: string | null; at: string; onBehalf?: boolean } | null;
  revisions: { id: string; revision: number; status: string; displayNumber: string | null; grandTotal: number }[];
  pdf: { status: string };
  version: number;
}

export default function QuoteDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { user, perm } = useAuth();
  const q = useQuery({ queryKey: ['quote', id], queryFn: () => get<Quote>(`/quotes/${id}`), enabled: Boolean(id && id !== 'undefined') });
  const [approval, setApproval] = useState<null | 'approve' | 'reject'>(null);
  const [comment, setComment] = useState('');
  const [onBehalf, setOnBehalf] = useState(false);
  const inv = ['quote', id];
  const send = useAction((channel: string) => post<{ status: string; number?: string; shareUrl?: string; waUrl?: string }>(`/quotes/${id}/send`, { channel }), [inv, ['sales']], (r) => {
    if (r.status === 'pending_approval') return toast('Sent for discount approval', 'info');
    if (r.waUrl) window.open(r.waUrl, '_blank', 'noopener');
    else if (r.shareUrl) void navigator.clipboard?.writeText(r.shareUrl).then(() => toast(`Sent as ${r.number} — link copied`));
    else toast(`Sent as ${r.number}`);
  });
  const decide = useAction(() => post(`/quotes/${id}/approval`, { decision: approval, comment }), [inv], () => {
    toast(approval === 'approve' ? 'Approved' : 'Returned to draft');
    setApproval(null);
  });
  const revise = useAction(() => post<{ id: string }>(`/quotes/${id}/revise`), [inv], (r) => nav(`/sales/quotes/${r.id}/edit`));
  const createInvoice = async (note?: string) => {
    try {
      const r = await post<{ id: string }>(`/quotes/${id}/create-invoice`, note ? { onBehalfNote: note } : {});
      nav(`/sales/invoices/${r.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ACCEPT_ON_BEHALF_NOTE_REQUIRED') setOnBehalf(true);
      else errorToast(e);
    }
  };
  const copyLink = async () => {
    try {
      const r = await post<{ url: string }>('/share-links', { documentType: 'quote', documentId: id });
      await navigator.clipboard.writeText(r.url);
      toast('Customer link copied');
    } catch (e) {
      errorToast(e);
    }
  };
  const remove = async () => {
    if (!confirm('Delete this draft?')) return;
    await api(`/quotes/${id}`, { method: 'DELETE' }).then(() => nav('/sales')).catch(errorToast);
  };

  if (q.isLoading) return <Skeleton rows={6} />;
  if (q.error) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  if (!q.data) {
    return (
      <EmptyState
        title="Quotation not found"
        description="The requested quotation does not exist."
        action={<LinkButton to="/sales?tab=quotes">Back to quotations</LinkButton>}
      />
    );
  }
  const d = q.data;
  const editable = ['draft', 'approved'].includes(d.status);
  const sent = ['sent', 'viewed', 'changes_requested', 'rejected', 'expired'].includes(d.status);
  return (
    <>
      <PageHeader back="/sales?tab=quotes" title={d.displayNumber ?? 'Draft quotation'} subtitle={<>{d.partyName} · <Badge status={d.status} /></>} actions={<>
        {editable && <LinkButton to={`/sales/quotes/${id}/edit`}>Edit</LinkButton>}
        {editable && <Button busy={send.isPending} onClick={() => send.mutate('whatsapp')}>Send via WhatsApp</Button>}
        {editable && <Button variant="secondary" busy={send.isPending} onClick={() => send.mutate('link')}>Send & copy link</Button>}
        {d.status === 'pending_approval' && perm('quote:approve') && (d.ownerId !== user?.id || user?.role === 'admin') && <><Button onClick={() => setApproval('approve')}>Approve</Button><Button variant="secondary" onClick={() => setApproval('reject')}>Reject</Button></>}
        {sent && d.isLatest && <Button variant="secondary" busy={revise.isPending} onClick={() => revise.mutate(undefined)}>Revise</Button>}
        {sent && <Button variant="ghost" onClick={() => void copyLink()}>Copy customer link</Button>}
        {(d.status === 'accepted' || (sent && d.isLatest)) && perm('invoice:create') && <Button onClick={() => void createInvoice()}>{d.orderId ? 'Create invoice' : 'Create invoice'}</Button>}
        {d.status === 'draft' && d.revision === 0 && <Button variant="ghost" onClick={() => void remove()}>Delete draft</Button>}
      </>} />
      {d.status === 'pending_approval' && <div className="mb-3"><Banner tone="warning">Waiting for discount approval ({Math.round(d.maxDiscountPct)}% discount).</Banner></div>}
      {d.approval?.decision === 'reject' && d.status === 'draft' && <div className="mb-3"><Banner tone="danger">Approval rejected{d.approval.comment ? `: ${d.approval.comment}` : ''}.</Banner></div>}
      {d.response && <div className="mb-3"><Banner tone={d.response.type === 'accept' ? 'success' : 'warning'}>{d.response.onBehalf ? 'Accepted on the customer’s behalf' : `Customer ${d.response.type === 'accept' ? `accepted (signed “${d.response.name}”)` : d.response.type === 'changes' ? 'requested changes' : 'rejected'}`}{d.response.comment ? `: “${d.response.comment}”` : ''} · {relative(d.response.at)}</Banner></div>}
      {d.status === 'superseded' && <div className="mb-3"><Banner tone="info">A newer revision replaced this quotation.</Banner></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <DocPreview type="quote" id={id} version={d.version} />
        <div className="flex flex-col gap-4">
          <Card title="Summary">
            <KeyValue items={[['Total', money(d.totals?.grandTotal ?? 0)], ['Date', date(d.date)], ['Valid until', date(d.validUntil)], ['Viewed', d.viewCount ? `${d.viewCount} times, last ${relative(d.lastViewedAt)}` : 'Not yet'], ['PDF', d.pdf?.status === 'failed' ? 'Failed — regenerate' : (d.pdf?.status ?? 'ready')]]} />
            {d.customerId && <Link to={`/customers/${d.customerId}`} className="mt-3 block text-sm text-primary hover:underline">Open customer</Link>}
            {d.partyType === 'lead' && !d.customerId && <Link to={`/leads/${d.partyId}`} className="mt-3 block text-sm text-primary hover:underline">Open lead</Link>}
          </Card>
          {!!d.revisions?.length && d.revisions.length > 1 && (
            <Card title="Revisions">
              <ul className="text-sm">
                {(d.revisions ?? []).map((r) => <li key={r.id} className="flex justify-between py-1"><Link className="text-primary hover:underline" to={`/sales/quotes/${r.id}`}>R{r.revision} {r.displayNumber ?? '(draft)'}</Link><span><Badge status={r.status} /> {money(r.grandTotal ?? 0)}</span></li>)}
              </ul>
            </Card>
          )}
        </div>
      </div>
      <Dialog open={!!approval} onClose={() => setApproval(null)} title={approval === 'approve' ? 'Approve discount' : 'Reject discount'} footer={<><Button variant="secondary" onClick={() => setApproval(null)}>Cancel</Button><Button busy={decide.isPending} onClick={() => decide.mutate(undefined)}>{approval === 'approve' ? 'Approve' : 'Reject'}</Button></>}>
        <Field label="Comment">{(fid) => <Textarea id={fid} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
      </Dialog>
      <OnBehalf open={onBehalf} onClose={() => setOnBehalf(false)} onConfirm={(n) => void createInvoice(n)} />
    </>
  );
}

function OnBehalf({ open, onClose, onConfirm }: { open: boolean; onClose(): void; onConfirm(note: string): void }) {
  const [note, setNote] = useState('');
  return (
    <Dialog open={open} onClose={onClose} title="Mark as accepted on the customer’s behalf" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={note.trim().length < 3} onClick={() => { onClose(); onConfirm(note); }}>Confirm and create invoice</Button></>}>
      <p className="mb-3 text-sm">The customer hasn’t accepted online. Add how they confirmed — this is recorded in the audit log.</p>
      <Field label="Note" required>{(fid) => <Textarea id={fid} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Confirmed by phone on 13-11-2026" />}</Field>
    </Dialog>
  );
}
