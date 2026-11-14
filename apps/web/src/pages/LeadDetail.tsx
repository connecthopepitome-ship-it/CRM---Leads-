/** SCR-004 Lead detail, SCR-009 convert (FR-033, FR-035, FR-036, FR-081 offline cache). */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cachePut, cacheGet } from '../lib/outbox';
import { dateTime, label, money, relative } from '../lib/format';
import { ActionBar, Timeline } from '../features/engagement';
import { useAction, useOptions, type Lead } from '../features/hooks';
import { StageDialog } from '../features/StageDialog';
import { Badge, Banner, Button, Card, Dialog, ErrorState, KeyValue, LinkButton, PageHeader, Select, Skeleton, toast } from '../ui';

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
  });
  const [stageTo, setStageTo] = useState<string | null>(null);
  const [convert, setConvert] = useState(params.get('convert') === '1');
  useEffect(() => setConvert(params.get('convert') === '1'), [params]);
  const reopen = useAction(() => post(`/leads/${id}/reopen`), [['lead', id], ['timeline', id]], () => toast('Lead reopened'));

  if (q.isLoading) return <Skeleton rows={6} />;
  if (q.error) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const l = q.data!;
  if (l.mergedIntoId) return <Navigate to={`/leads/${l.mergedIntoId}`} replace />;
  const closed = ['won', 'lost', 'junk'].includes(l.stage);
  return (
    <>
      <PageHeader back="/leads" title={l.name} subtitle={[l.company, l.city].filter(Boolean).join(' · ')} actions={<>
        {can('quote', 'create') && !closed && <LinkButton to={`/sales/quotes/new?partyType=lead&partyId=${l.id}`}>New quote</LinkButton>}
        {!closed && <Button variant="primary" onClick={() => setConvert(true)}>Convert to customer</Button>}
        {closed && perm('lead:reopen') && <Button variant="secondary" busy={reopen.isPending} onClick={() => reopen.mutate(undefined)}>Reopen</Button>}
        <LinkButton to={`/leads/${l.id}/edit`} variant="ghost">Edit</LinkButton>
      </>} />
      {offline && <div className="mb-3"><Banner tone="warning">Offline — showing this lead as last synced.</Banner></div>}
      {l.customerId && <div className="mb-3"><Banner tone="success" action={<LinkButton to={`/customers/${l.customerId}`} variant="ghost">Open customer</LinkButton>}>{l.stage === 'won' ? 'Converted to a customer.' : 'This person is an existing customer.'}</Banner></div>}
      <div className="mb-4"><ActionBar rec={{ recordType: 'lead', recordId: l.id, name: l.name, phone: l.phoneValid ? l.phone : null, email: l.email, address: l.city }} /></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Timeline recordType="lead" recordId={l.id} />
        <div className="flex flex-col gap-4">
          <Card title="Details">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="text-sm" htmlFor="stage">Stage</label>
              <Select id="stage" value={l.stage} disabled={closed} onChange={(e) => setStageTo(e.target.value)} className="flex-1">
                {stages.data?.map((s) => <option key={s.id} value={String(s.key)}>{s.label}</option>)}
              </Select>
            </div>
            <KeyValue items={[
              ['Phone', l.phone ?? (l.phoneRaw ? <span>{l.phoneRaw} <Badge tone="warning">Check number</Badge></span> : null)],
              ['Email', l.email],
              ['First-contact SLA', <Badge key="s" status={l.slaStatus}>{l.slaStatus === 'pending' ? `due ${relative(l.slaDueAt)}` : label(l.slaStatus)}</Badge>],
              ['Next follow-up', l.nextFollowUpAt ? dateTime(l.nextFollowUpAt) : null],
              ['Expected value', l.expectedValue ? money(l.expectedValue) : null],
              ['Consent', label(l.consentBasis)],
              ['Created', dateTime(l.createdAt)],
            ]} />
            {!!l.tags.length && <div className="mt-3 flex flex-wrap gap-1">{l.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>}
            {l.notes && <p className="mt-3 whitespace-pre-wrap text-sm">{l.notes}</p>}
          </Card>
          <Link to={`/settings/audit?recordType=lead&recordId=${l.id}`} className="text-sm text-primary hover:underline">View change history</Link>
        </div>
      </div>
      {stageTo && <StageDialog lead={l} to={stageTo} onClose={() => setStageTo(null)} />}
      {convert && <ConvertDialog lead={l} onClose={() => { setConvert(false); nav(`/leads/${l.id}`, { replace: true }); }} />}
    </>
  );
}

function ConvertDialog({ lead, onClose }: { lead: Lead; onClose(): void }) {
  const nav = useNavigate();
  const dup = useQuery({ queryKey: ['dup', lead.id], queryFn: () => post<{ matches: { type: string; id: string | null; name: string }[] }>('/leads/check-duplicate', { phone: lead.phone, email: lead.email }) });
  const customerMatch = dup.data?.matches.find((m) => m.type === 'customer');
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
