/** SCR-011 Quote detail: status, preview, send (WhatsApp/email/link), approval, revisions, create invoice (FR-053 – FR-059). */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, money, relative } from '../lib/format';
import { useAction } from '../features/hooks';
import { DocPreview } from '../features/DocPreview';
import { Badge, Banner, Button, Card, Dialog, EmptyState, ErrorState, Field, LinkButton, Skeleton, Table, Textarea, toast } from '../ui';
import { errorToast } from '../ui/toast';
import { 
  ArrowLeft, Copy, FileText, Send, Edit, Plus, Trash2, 
  Calendar, User, CheckCircle2, RotateCcw, AlertCircle 
} from 'lucide-react';

interface QuoteLine {
  id: string;
  kind?: string;
  description: string;
  qty: number;
  rate: number;
  taxRatePct?: number;
  amount: number;
  unit?: string;
}

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
  totals: {
    grandTotal: number;
    subTotal?: number;
    taxable?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    discountTotal?: number;
    maxDiscountPct?: number;
  };
  lines?: QuoteLine[];
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
  const is404 = !q.data || (q.error as any)?.status === 404 || (q.error as any)?.code === 'NOT_FOUND';
  if (is404) {
    return (
      <EmptyState
        title="Quotation not found"
        description="The requested quotation does not exist or has been removed."
        action={<LinkButton to="/sales?tab=quotes">Back to quotations</LinkButton>}
      />
    );
  }
  if (q.error) return <ErrorState error={q.error} retry={() => void q.refetch()} />;

  const d = q.data;
  const editable = ['draft', 'approved'].includes(d.status);
  const sent = ['sent', 'viewed', 'changes_requested', 'rejected', 'expired'].includes(d.status);

  const subTotal = d.totals?.subTotal ?? d.totals?.taxable ?? Math.round((d.totals?.grandTotal ?? 0) / 1.18);
  const discountTotal = d.totals?.discountTotal ?? 0;
  const cgst = d.totals?.cgst ?? 0;
  const sgst = d.totals?.sgst ?? 0;
  const igst = d.totals?.igst ?? 0;
  const grandTotal = d.totals?.grandTotal ?? 0;

  const lines = (d.lines ?? []).filter((l) => l.kind !== 'heading');

  return (
    <div className="space-y-5 pb-16">
      {/* Back Link */}
      <div>
        <Link
          to="/sales?tab=quotes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3D7952] hover:text-[#233D2D] transition-colors group"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Quotations</span>
        </Link>
      </div>

      {/* Header & Responsive Actions */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-[#DCE7D9]/60 pb-5">
        <div className="min-w-0 max-w-full">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#778477]">
              Commercial Quotation
            </span>
            <Badge status={d.status} />
          </div>

          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#202820] font-mono break-normal whitespace-normal max-w-full overflow-wrap-normal"
            style={{ wordBreak: 'normal', overflowWrap: 'normal', whiteSpace: 'normal' }}
          >
            {d.displayNumber ?? 'Draft Quotation'}
          </h1>

          <p className="text-xs sm:text-sm text-[#778477] mt-1 font-medium">
            Recipient: <span className="font-bold text-[#202820]">{d.partyName}</span>
          </p>
        </div>

        {/* Desktop Actions (Visible on >= sm) */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          {editable && <LinkButton to={`/sales/quotes/${id}/edit`} variant="secondary">Edit</LinkButton>}
          {editable && (
            <Button busy={send.isPending} onClick={() => send.mutate('whatsapp')} className="bg-[#25D366] hover:bg-[#20bd5a] text-white">
              Send via WhatsApp
            </Button>
          )}
          {editable && <Button variant="secondary" busy={send.isPending} onClick={() => send.mutate('link')}>Send & copy link</Button>}
          {d.status === 'pending_approval' && perm('quote:approve') && (d.ownerId !== user?.id || user?.role === 'admin') && (
            <>
              <Button onClick={() => setApproval('approve')}>Approve</Button>
              <Button variant="secondary" onClick={() => setApproval('reject')}>Reject</Button>
            </>
          )}
          {sent && d.isLatest && <Button variant="secondary" busy={revise.isPending} onClick={() => revise.mutate(undefined)}>Revise</Button>}
          {sent && <Button variant="ghost" onClick={() => void copyLink()}>Copy link</Button>}
          {(d.status === 'accepted' || (sent && d.isLatest)) && perm('invoice:create') && (
            <Button onClick={() => void createInvoice()} className="bg-[#3D7952] text-white">
              Create invoice
            </Button>
          )}
          {d.status === 'draft' && d.revision === 0 && (
            <Button variant="ghost" onClick={() => void remove()} className="text-rose-600 hover:bg-rose-50">
              Delete draft
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Actions (Visible on < sm) */}
      <div className="flex flex-col gap-2.5 sm:hidden">
        {editable && (
          <Button
            busy={send.isPending}
            onClick={() => send.mutate('whatsapp')}
            className="w-full justify-center bg-[#25D366] hover:bg-[#20bd5a] text-white py-2.5 font-bold shadow-xs text-xs"
          >
            <Send size={14} className="mr-1.5" />
            <span>Send via WhatsApp</span>
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2">
          {editable && (
            <LinkButton
              to={`/sales/quotes/${id}/edit`}
              variant="secondary"
              className="w-full justify-center text-xs py-2 font-semibold"
            >
              <Edit size={13} className="mr-1.5 text-[#3D7952]" />
              <span>Edit Quote</span>
            </LinkButton>
          )}
          <Button
            variant="secondary"
            onClick={() => void copyLink()}
            className="w-full justify-center text-xs py-2 font-semibold"
          >
            <Copy size={13} className="mr-1.5 text-[#3D7952]" />
            <span>Copy Link</span>
          </Button>
        </div>

        {(d.status === 'accepted' || (sent && d.isLatest)) && perm('invoice:create') && (
          <Button
            onClick={() => void createInvoice()}
            className="w-full justify-center bg-[#3D7952] text-white py-2.5 text-xs font-bold shadow-xs"
          >
            Create Invoice
          </Button>
        )}

        {sent && d.isLatest && (
          <Button
            variant="secondary"
            busy={revise.isPending}
            onClick={() => revise.mutate(undefined)}
            className="w-full justify-center py-2 text-xs font-semibold"
          >
            Create Revision
          </Button>
        )}

        {d.status === 'draft' && d.revision === 0 && (
          <Button
            variant="ghost"
            onClick={() => void remove()}
            className="w-full justify-center text-xs py-2 text-rose-600 border border-rose-200 bg-white hover:bg-rose-50"
          >
            <Trash2 size={13} className="mr-1.5" />
            <span>Delete Draft</span>
          </Button>
        )}
      </div>

      {d.status === 'pending_approval' && (
        <Banner tone="warning">Waiting for discount approval ({Math.round(d.maxDiscountPct)}% discount).</Banner>
      )}
      {d.approval?.decision === 'reject' && d.status === 'draft' && (
        <Banner tone="danger">Approval rejected{d.approval.comment ? `: ${d.approval.comment}` : ''}.</Banner>
      )}
      {d.response && (
        <Banner tone={d.response.type === 'accept' ? 'success' : 'warning'}>
          {d.response.onBehalf ? 'Accepted on customer’s behalf' : `Customer ${d.response.type === 'accept' ? `accepted (signed “${d.response.name}”)` : d.response.type === 'changes' ? 'requested changes' : 'rejected'}`}
          {d.response.comment ? `: “${d.response.comment}”` : ''} · {relative(d.response.at)}
        </Banner>
      )}
      {d.status === 'superseded' && (
        <Banner tone="info">A newer revision replaced this quotation.</Banner>
      )}

      {/* Customer / Recipient Information Card */}
      <Card title="Client Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#778477] block mb-1">
              Client / Party
            </span>
            <span className="font-bold text-sm text-[#202820] block">
              {d.partyName}
            </span>
            <span className="text-[11px] text-[#778477] font-medium capitalize mt-0.5 block">
              Type: {d.partyType}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#778477] block mb-1">
              Quotation Date
            </span>
            <div className="flex items-center gap-1.5 text-[#202820] font-semibold">
              <Calendar size={13} className="text-[#3D7952]" />
              <span>{date(d.date)}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#778477] block mb-1">
              Valid Until
            </span>
            <div className="flex items-center gap-1.5 text-[#202820] font-semibold">
              <Calendar size={13} className="text-[#3D7952]" />
              <span>{date(d.validUntil)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Content Grid: Line items + Summary */}
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5">
          <Card title="Line Items">
            {lines.length === 0 ? (
              <p className="text-xs text-[#778477]">No line items specified.</p>
            ) : (
              <>
                {/* Mobile Line Item Cards */}
                <div className="space-y-3 md:hidden">
                  {lines.map((l, idx) => {
                    const lRate = l.rate ?? (l.amount && l.qty ? l.amount / l.qty : (grandTotal ? Math.round(grandTotal / 1.18 / l.qty) : 0));
                    const lAmount = l.amount ?? (grandTotal ? Math.round(grandTotal / 1.18) : 0);

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

                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table
                    rows={lines}
                    columns={[
                      { key: 'description', label: 'Item / Description' },
                      { key: 'qty', label: 'Qty', align: 'right', render: (l) => `${l.qty} ${l.unit ?? ''}` },
                      { key: 'rate', label: 'Rate', align: 'right', render: (l) => money(l.rate ?? (l.amount ? l.amount / l.qty : (grandTotal ? Math.round(grandTotal / 1.18 / l.qty) : 0))) },
                      { key: 'taxRatePct', label: 'GST', align: 'right', render: (l) => `${l.taxRatePct ?? 18}%` },
                      { key: 'amount', label: 'Amount', align: 'right', render: (l) => money(l.amount ?? (grandTotal ? Math.round(grandTotal / 1.18) : 0)) },
                    ]}
                  />
                </div>
              </>
            )}
          </Card>

          {/* Desktop Preview */}
          <div className="hidden md:block">
            <DocPreview type="quote" id={id} version={d.version} />
          </div>
        </div>

        {/* Summary Card */}
        <div className="flex flex-col gap-5">
          <Card title="Quotation Summary">
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
                <span>Customer Views</span>
                <span className="font-medium text-[#202820]">
                  {d.viewCount ? `${d.viewCount} times` : 'Not viewed yet'}
                </span>
              </div>
            </div>
          </Card>

          {/* Revision History */}
          {d.revisions && d.revisions.length > 0 && (
            <Card title="Revision History">
              <ul className="text-xs space-y-2">
                {d.revisions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-1 border-b border-[#DCE7D9]/40 last:border-0">
                    <Link to={`/sales/quotes/${r.id}`} className="font-bold text-[#3D7952] hover:underline">
                      R{r.revision} {r.displayNumber ?? '(draft)'}
                    </Link>
                    <div className="flex items-center gap-2">
                      <Badge status={r.status} />
                      <span className="font-mono font-semibold text-[#202820]">{money(r.grandTotal ?? 0)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* Approval Dialog */}
      <Dialog
        open={!!approval}
        onClose={() => setApproval(null)}
        title={approval === 'approve' ? 'Approve quotation discount' : 'Return quotation to draft'}
        footer={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setApproval(null)}>Cancel</Button>
            <Button
              variant={approval === 'approve' ? 'primary' : 'danger'}
              busy={decide.isPending}
              onClick={() => decide.mutate(undefined)}
            >
              {approval === 'approve' ? 'Confirm Approval' : 'Return to Draft'}
            </Button>
          </div>
        }
      >
        <Field label="Comment">
          {(fid) => <Textarea id={fid} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional note for audit history" />}
        </Field>
      </Dialog>
    </div>
  );
}
