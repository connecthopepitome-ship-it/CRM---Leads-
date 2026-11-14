/** SCR-012 customer quote page + SCR-016 customer invoice page (public, no app shell; FR-057, FR-068, FR-069, FR-079). */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { date, money } from '../lib/format';
import { Banner, Button, Dialog, Field, Skeleton, Textarea, TextField } from '../ui';

interface PublicView {
  type: 'quote' | 'invoice' | 'receipt' | 'statement';
  companyName: string;
  companyPhone: string | null;
  poweredBy: boolean;
  html: string;
  state?: string;
  latestUrl?: string | null;
  number?: string;
  validUntil?: string;
  totals?: { grandTotal: number };
  actions?: string[];
  balanceDue?: number;
  paid?: boolean;
  upi?: { uri: string | null; amount: number; qrSvg: string | null; vpa: string | null };
}

export default function PublicDoc() {
  const { token = '' } = useParams();
  const q = useQuery({ queryKey: ['public', token], queryFn: () => api<PublicView>(`/public/s/${token}`), retry: false });
  const [respond, setRespond] = useState<null | 'accept' | 'changes' | 'reject'>(null);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/public/s/${token}/respond`, { method: 'POST', body: { type: respond, name: name || null, comment: comment || null } });
      setDone(respond === 'accept' ? 'Thank you — your acceptance has been recorded.' : respond === 'changes' ? 'Thanks — we’ll send you an updated quotation.' : 'Thanks for letting us know.');
      setRespond(null);
      void q.refetch();
    } catch (e) {
      setErr((e as ApiError).title);
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <div className="mx-auto max-w-3xl p-4"><Skeleton rows={8} /></div>;
  if (q.error) {
    const e = q.error as ApiError;
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center p-4">
        <Banner tone="warning">{e.status === 404 ? 'This link is not valid.' : e.title}</Banner>
      </main>
    );
  }
  const d = q.data!;
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{d.companyName}</h1>
          {d.number && <p className="text-sm text-muted">{d.type === 'quote' ? 'Quotation' : d.type === 'invoice' ? 'Invoice' : 'Receipt'} {d.number}</p>}
        </div>
        {d.type !== 'statement' && <a className="inline-flex min-h-touch items-center rounded-md border border-border-input bg-surface px-4 text-sm font-medium hover:bg-surface-2" href={`/api/v1/public/s/${token}/pdf`} target="_blank" rel="noreferrer">Download PDF</a>}
      </header>
      {done && <div className="mb-4"><Banner tone="success">{done}</Banner></div>}
      {d.type === 'quote' && d.state === 'superseded' && <div className="mb-4"><Banner tone="info" action={d.latestUrl ? <a className="font-medium underline" href={d.latestUrl}>View the latest version</a> : undefined}>This quotation has been updated.</Banner></div>}
      {d.type === 'quote' && d.state === 'expired' && <div className="mb-4"><Banner tone="warning">This quotation expired on {date(d.validUntil)} — contact {d.companyName}{d.companyPhone ? ` on ${d.companyPhone}` : ''}.</Banner></div>}
      {d.type === 'quote' && d.state === 'accepted' && !done && <div className="mb-4"><Banner tone="success">You accepted this quotation. Thank you!</Banner></div>}
      {d.type === 'quote' && !!d.actions?.length && (
        <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-border bg-surface p-3">
          <span className="mr-auto self-center text-sm">Total <b>{money(d.totals?.grandTotal)}</b> · valid until {date(d.validUntil)}</span>
          <Button onClick={() => setRespond('accept')}>Accept</Button>
          <Button variant="secondary" onClick={() => setRespond('changes')}>Request changes</Button>
          <Button variant="ghost" onClick={() => setRespond('reject')}>Reject</Button>
        </div>
      )}
      {d.type === 'invoice' && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-4">
          {d.paid ? <p className="text-lg font-semibold text-success">PAID — thank you!</p> : (
            <div className="flex flex-wrap items-center gap-4">
              {d.upi?.qrSvg && <div className="w-40" role="img" aria-label="UPI QR code" dangerouslySetInnerHTML={{ __html: d.upi.qrSvg }} />}
              <div className="flex flex-col gap-2">
                <p className="text-sm">Balance due</p>
                <p className="text-2xl font-semibold">{money(d.balanceDue)}</p>
                {d.upi?.uri && (isMobile
                  ? <a href={d.upi.uri} className="inline-flex min-h-touch items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg">Pay via UPI</a>
                  : <p className="text-xs text-muted">Scan with any UPI app · UPI ID {d.upi.vpa}</p>)}
              </div>
            </div>
          )}
        </div>
      )}
      <iframe title="Document" className="doc-frame" sandbox="" srcDoc={d.html} />
      {d.poweredBy && <p className="mt-4 text-center text-xs text-muted">Powered by SaleSphere</p>}
      <Dialog open={!!respond} onClose={() => setRespond(null)} title={respond === 'accept' ? 'Accept quotation' : respond === 'changes' ? 'Request changes' : 'Reject quotation'} footer={<><Button variant="secondary" onClick={() => setRespond(null)}>Cancel</Button><Button busy={busy} disabled={(respond === 'accept' && name.trim().length < 2) || (respond === 'changes' && !comment.trim())} onClick={() => void submit()}>{respond === 'accept' ? 'Accept quotation' : 'Send'}</Button></>}>
        {err && <div className="mb-3"><Banner tone="danger">{err}</Banner></div>}
        {respond === 'accept' && <div className="mb-3"><TextField label="Type your full name to accept" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>}
        <Field label={respond === 'changes' ? 'What should we change?' : 'Comment (optional)'} required={respond === 'changes'}>{(fid) => <Textarea id={fid} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
      </Dialog>
    </main>
  );
}
