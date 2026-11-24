/** SCR-004 Lead detail, SCR-009 convert (FR-033, FR-035, FR-036, FR-081 offline cache). */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { del, get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cachePut, cacheGet } from '../lib/outbox';
import { dateTime, formatSla, getStageLabel, label, money, relative } from '../lib/format';
import { ActionBar, Timeline } from '../features/engagement';
import { useAction, useOptions, type Lead } from '../features/hooks';
import { StageDialog } from '../features/StageDialog';
import { Badge, Banner, Button, Card, Dialog, EmptyState, ErrorState, KeyValue, LinkButton, PageHeader, Select, Skeleton, toast } from '../ui';
import { errorToast } from '../ui/toast';

const SOURCE_LABELS: Record<string, string> = {
  'src-1': 'Website Inbound',
  'src-2': 'Referral',
  'src-3': 'Google Ads',
  'src-4': 'Direct Call',
  'src-5': 'LinkedIn',
  website: 'Website Inbound',
  referral: 'Referral',
  google_ads: 'Google Ads',
  direct: 'Direct Call',
};

const PRODUCT_LABELS: Record<string, string> = {
  'prod-1': 'CRM Enterprise License (Annual)',
  'prod-2': 'Implementation & Data Migration',
  'prod-3': 'Custom Integration Pack',
  'prod-4': 'Dedicated Support Retainer (Monthly)',
};

export default function LeadDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { perm, can } = useAuth();
  const stages = useOptions('pipelineStages');
  const [offline, setOffline] = useState(false);
  const q = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      try {
        const l = await get<Lead>(`/leads/${id}`);
        void cachePut(`lead:${id}`, l);
        setOffline(false);
        return l;
      } catch (e) {
        const cached = await cacheGet<Lead>(`lead:${id}`);
        if (cached && !navigator.onLine) {
          setOffline(true);
          return cached;
        }
        throw e;
      }
    },
    enabled: Boolean(id && id !== 'undefined'),
  });
  const [stageTo, setStageTo] = useState<string | null>(null);
  const [convert, setConvert] = useState(params.get('convert') === '1');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => setConvert(params.get('convert') === '1'), [params]);
  const reopen = useAction(() => post(`/leads/${id}/reopen`), [['lead', id], ['timeline', id]], () => toast('Lead reopened'));
  const fuQ = useQuery({ queryKey: ['follow-ups', 'lead', id], queryFn: () => get<{ items: any[] }>(`/follow-ups?recordType=lead&recordId=${id}&status=pending`), enabled: Boolean(id) });
  const pendingFus = (fuQ.data?.items ?? [])
    .filter((f: any) => f.status === 'pending')
    .sort((a: any, b: any) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const nextFu = pendingFus[0];

  if (q.isLoading) return <Skeleton rows={6} />;
  const is404 = !q.data || (q.error as any)?.status === 404 || (q.error as any)?.code === 'NOT_FOUND';
  if (is404) {
    return (
      <EmptyState
        title="Lead not found"
        description="The requested lead does not exist or has been removed."
        action={<LinkButton to="/leads">Back to leads</LinkButton>}
      />
    );
  }
  if (q.error) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const l = q.data;
  if (l.mergedIntoId) return <Navigate to={`/leads/${l.mergedIntoId}`} replace />;
  const closed = ['won', 'lost', 'junk'].includes(l.stage);
  const stageOptions = stages.data?.length ? stages.data : [
    { id: 'stg-1', key: 'new', label: 'New' },
    { id: 'stg-2', key: 'contacted', label: 'Contacted' },
    { id: 'stg-3', key: 'interested', label: 'Interested' },
    { id: 'stg-4', key: 'quotation_sent', label: 'Quotation Sent' },
    { id: 'stg-5', key: 'negotiation', label: 'Negotiation' },
    { id: 'stg-6', key: 'won', label: 'Won' },
    { id: 'stg-7', key: 'lost', label: 'Lost' },
  ];
  const sla = formatSla(l.slaStatus, l.slaDueAt);

  return (
    <>
      <PageHeader back="/leads" title={l.name} subtitle={[l.company, l.city].filter(Boolean).join(' · ')} actions={<>
        {can('quote', 'create') && !closed && <LinkButton to={`/sales/quotes/new?partyType=lead&partyId=${l.id}`}>New quote</LinkButton>}
        {!closed && <Button variant="primary" onClick={() => setConvert(true)}>Convert to customer</Button>}
        {closed && perm('lead:reopen') && <Button variant="secondary" busy={reopen.isPending} onClick={() => reopen.mutate(undefined)}>Reopen</Button>}
        <LinkButton to={`/leads/${l.id}/edit`} variant="ghost">Edit</LinkButton>
        <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>Delete</Button>
      </>} />
      {offline && <div className="mb-3"><Banner tone="warning">Offline — showing this lead as last synced.</Banner></div>}
      {nextFu && (
        <div className="mb-3">
          <Banner tone="info">
            <b>Next follow-up:</b> {String(nextFu.type).toUpperCase()} on {dateTime(nextFu.dueAt)} {nextFu.note && `— ${nextFu.note}`}
          </Banner>
        </div>
      )}
      {l.customerId && <div className="mb-3"><Banner tone="success" action={<LinkButton to={`/customers/${l.customerId}`} variant="ghost">Open customer</LinkButton>}>{l.stage === 'won' ? 'Converted to a customer.' : 'This person is an existing customer.'}</Banner></div>}
      <div className="mb-4"><ActionBar rec={{ recordType: 'lead', recordId: l.id, name: l.name, company: l.company || null, phone: l.phone || null, email: l.email, address: l.city }} /></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Timeline recordType="lead" recordId={l.id} />
        <div className="flex flex-col gap-4">
          <Card title="Details">
            <div className="mb-3 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="stage">Stage</label>
              <div className="flex items-center gap-2">
                <Badge status={l.stage}>{getStageLabel(l.stage)}</Badge>
                {!closed && (
                  <Select id="stage" value={l.stage} onChange={(e) => setStageTo(e.target.value)} className="text-xs py-1">
                    {stageOptions.map((s) => <option key={s.id} value={String(s.key)}>{s.label}</option>)}
                  </Select>
                )}
              </div>
            </div>
            <KeyValue items={[
              ['Phone', l.phone ?? (l.phoneRaw ? <span>{l.phoneRaw} <Badge tone="warning">Check number</Badge></span> : null)],
              ['Email', l.email],
              ['Location', [l.city, l.pincode].filter(Boolean).join(' - ') || null],
              ['Lead Source', (l as any).sourceLabel || SOURCE_LABELS[(l as any).sourceId] || (l as any).sourceId || null],
              ['Product Interest', (l as any).productLabel || PRODUCT_LABELS[(l as any).interestProductId] || (l as any).interestProductId || null],
              ['First-contact SLA', <Badge key="s" status={l.slaStatus}>{sla.text}</Badge>],
              ['Next follow-up', nextFu ? `${String(nextFu.type).toUpperCase()} on ${dateTime(nextFu.dueAt)}` : (l.nextFollowUpAt ? dateTime(l.nextFollowUpAt) : null)],
              ['Expected value', l.expectedValue ? money(l.expectedValue) : null],
              ['Consent', label(l.consentBasis)],
              ['Created', dateTime(l.createdAt)],
            ]} />
            {!!l.tags?.length && <div className="mt-3 flex flex-wrap gap-1">{l.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>}
            {l.notes && <p className="mt-3 whitespace-pre-wrap text-sm">{l.notes}</p>}
          </Card>
          <Link to={`/settings/audit?recordType=lead&recordId=${l.id}`} className="text-sm text-primary hover:underline">View change history</Link>
        </div>
      </div>
      {stageTo && <StageDialog lead={l} to={stageTo} onClose={() => setStageTo(null)} />}
      {convert && <ConvertDialog lead={l} onClose={() => { setConvert(false); nav(`/leads/${l.id}`, { replace: true }); }} />}
      {confirmDelete && (
        <Dialog
          open
          onClose={() => setConfirmDelete(false)}
          title="Delete Lead"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button
                variant="danger"
                busy={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await del(`/leads/${l.id}`);
                    void qc.invalidateQueries({ queryKey: ['follow-ups'] });
                    void qc.invalidateQueries({ queryKey: ['leads'] });
                    toast('Lead deleted successfully');
                    nav('/leads', { replace: true });
                  } catch (e) {
                    errorToast(e);
                    setDeleting(false);
                  }
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm">Are you sure you want to delete lead <b>{l.name}</b>? This action will remove the lead and preserve an audit log.</p>
        </Dialog>
      )}
    </>
  );
}

function ConvertDialog({ lead, onClose }: { lead: Lead; onClose(): void }) {
  const nav = useNavigate();
  const dup = useQuery({ queryKey: ['dup', lead.id], queryFn: () => post<{ matches: { type: string; id: string | null; name: string }[] }>('/leads/check-duplicate', { phone: lead.phone, email: lead.email }) });
  const customerMatch = dup.data?.matches?.find((m) => m.type === 'customer');
  const [mode, setMode] = useState<'new' | 'link'>('new');
  useEffect(() => {
    if (customerMatch || lead.customerId) setMode('link');
  }, [customerMatch, lead.customerId]);
  const m = useAction(() => post<{ customerId: string }>(`/leads/${lead.id}/convert`, { mode, customerId: lead.customerId ?? customerMatch?.id ?? undefined }), [['lead', lead.id], ['leads']], (r) => {
    toast('Converted to customer');
    nav(`/customers/${r.customerId}`);
  });
  return (
    <Dialog open onClose={onClose} title="Convert to customer" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={m.isPending} onClick={() => m.mutate(undefined)}>Convert</Button></>}>
      {(customerMatch || lead.customerId) ? (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">This phone or email belongs to an existing customer{customerMatch ? `: ${customerMatch.name}` : ''}.</legend>
          <label className="flex min-h-touch items-center gap-2"><input type="radio" checked={mode === 'link'} onChange={() => setMode('link')} /> Link to the existing customer</label>
          <label className="flex min-h-touch items-center gap-2"><input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} /> Create a new customer</label>
        </fieldset>
      ) : <p className="text-sm">A customer and contact will be created from this lead. History and open follow-ups move with it.</p>}
    </Dialog>
  );
}
