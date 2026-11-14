/** SCR-003 Leads list / Kanban (FR-034, FR-032, FR-033). Filters live in the URL. */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import { useTerm } from '../lib/appConfig';
import { useAuth } from '../lib/auth';
import { money, relative } from '../lib/format';
import { useAction, useOptions, useUsers, type Lead } from '../features/hooks';
import { StageDialog } from '../features/StageDialog';
import { Badge, Button, EmptyState, ErrorState, Input, LinkButton, PageHeader, Select, Skeleton, Table, toast } from '../ui';

export default function Leads() {
  const term = useTerm();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { perm } = useAuth();
  const view = params.get('view') ?? 'list';
  const stages = useOptions('pipelineStages');
  const sources = useOptions('leadSources');
  const users = useUsers(perm('lead:assign'));
  const qs = new URLSearchParams(params);
  qs.delete('view');
  const list = useInfiniteQuery({
    queryKey: ['leads', qs.toString()],
    queryFn: ({ pageParam }) => get<{ items: Lead[]; nextCursor: string | null }>(`/leads?${qs.toString()}${pageParam ? `&cursor=${pageParam}` : ''}&limit=50`),
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: view === 'list',
  });
  const board = useQuery({ queryKey: ['leads-board'], queryFn: () => get<{ columns: { stage: string; label: string; count: number; value: number; cards: Lead[] }[] }>('/leads/board'), enabled: view === 'board' });
  const [selected, setSelected] = useState<string[]>([]);
  const [assignTo, setAssignTo] = useState('');
  const [drop, setDrop] = useState<{ lead: Lead; to: string } | null>(null);
  const bulk = useAction((body: object) => post<{ ok: string[]; skipped: { id: string; reason: string }[] }>('/leads/bulk', body), [['leads'], ['leads-board']], (r) => {
    toast(`${r.ok.length} updated${r.skipped.length ? `, ${r.skipped.length} skipped` : ''}`);
    setSelected([]);
  });
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
  };
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const stageLabel = (k: string) => stages.data?.find((s) => s.key === k)?.label ?? k;

  return (
    <>
      <PageHeader title={term('leads', 'Leads')} actions={<>
        <div role="group" aria-label="View" className="flex rounded-md border border-border">
          <button className={`min-h-touch px-3 text-sm ${view === 'list' ? 'bg-primary-subtle text-primary' : ''}`} aria-pressed={view === 'list'} onClick={() => set('view', '')}>List</button>
          <button className={`min-h-touch px-3 text-sm ${view === 'board' ? 'bg-primary-subtle text-primary' : ''}`} aria-pressed={view === 'board'} onClick={() => set('view', 'board')}>Board</button>
        </div>
        {perm('lead:import') && <LinkButton to="/settings/import">Import</LinkButton>}
        <LinkButton to="/leads/new" variant="primary">New lead</LinkButton>
      </>} />
      {view === 'list' && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5" role="search">
            <Input aria-label="Search leads" placeholder="Search name or phone" defaultValue={params.get('q') ?? ''} onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value)} />
            <Select aria-label="Stage" value={params.get('stage') ?? ''} onChange={(e) => set('stage', e.target.value)}>
              <option value="">All stages</option>
              {stages.data?.map((s) => <option key={s.id} value={String(s.key)}>{s.label}</option>)}
            </Select>
            <Select aria-label="Source" value={params.get('sourceId') ?? ''} onChange={(e) => set('sourceId', e.target.value)}>
              <option value="">All sources</option>
              {sources.data?.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            <Select aria-label="SLA" value={params.get('sla') ?? ''} onChange={(e) => set('sla', e.target.value)}>
              <option value="">Any SLA</option>
              <option value="pending">SLA running</option>
              <option value="breached">SLA breached</option>
              <option value="met">Contacted in time</option>
            </Select>
            <Select aria-label="Follow-up" value={params.get('due') ?? ''} onChange={(e) => set('due', e.target.value)}>
              <option value="">Any follow-up</option>
              <option value="today">Due by tomorrow</option>
            </Select>
          </div>
          {selected.length > 0 && perm('lead:assign') && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-primary-subtle p-2 text-sm">
              <span>{selected.length} selected</span>
              <Select aria-label="Assign to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-48">
                <option value="">Assign to…</option>
                {users.data?.filter((u) => u.status === 'active').map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </Select>
              <Button size="sm" disabled={!assignTo} busy={bulk.isPending} onClick={() => bulk.mutate({ ids: selected, action: 'assign', ownerId: assignTo })}>Reassign</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
            </div>
          )}
          {list.isLoading ? <Skeleton rows={6} /> : list.error ? <ErrorState error={list.error} retry={() => void list.refetch()} /> : (
            <Table<Lead>
              rows={rows}
              onRow={(l) => nav(`/leads/${l.id}`)}
              empty={<EmptyState title="No leads match" body="Change the filters or add a lead." action={<LinkButton to="/leads/new" variant="primary">New lead</LinkButton>} />}
              columns={[
                { key: 'name', label: 'Name', render: (l) => l.name },
                ...(perm('lead:assign') ? [{ key: 'sel', label: 'Select', render: (l: Lead) => <input type="checkbox" aria-label={`Select ${l.name}`} className="h-5 w-5" checked={selected.includes(l.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id)))} /> }] : []),
                { key: 'phone', label: 'Phone', render: (l) => l.phone ?? l.phoneRaw ?? l.email ?? '—' },
                { key: 'stage', label: 'Stage', render: (l) => <Badge status={l.stage}>{stageLabel(l.stage)}</Badge> },
                { key: 'sla', label: 'SLA', render: (l) => <Badge status={l.slaStatus}>{l.slaStatus === 'pending' ? `due ${relative(l.slaDueAt)}` : l.slaStatus}</Badge> },
                { key: 'next', label: 'Next follow-up', render: (l) => (l.nextFollowUpAt ? relative(l.nextFollowUpAt) : '—') },
                { key: 'value', label: 'Value', align: 'right', render: (l) => (l.expectedValue ? money(l.expectedValue) : '—') },
              ]}
            />
          )}
          {list.hasNextPage && <div className="mt-3 text-center"><Button variant="secondary" busy={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>Load more</Button></div>}
        </>
      )}
      {view === 'board' && (board.isLoading ? <Skeleton rows={4} /> : board.error ? <ErrorState error={board.error} /> : (
        <div className="flex gap-3 overflow-x-auto pb-4" aria-label="Lead board">
          {board.data!.columns.map((c) => (
            <section key={c.stage} className="w-72 shrink-0 rounded-lg bg-surface-2 p-2" aria-label={`${c.label}: ${c.count} leads`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('text/plain');
                const lead = board.data!.columns.flatMap((x) => x.cards).find((x) => x.id === id);
                if (lead && lead.stage !== c.stage) setDrop({ lead, to: c.stage });
              }}>
              <h2 className="mb-2 flex justify-between px-1 text-sm font-semibold"><span>{c.label}</span><span className="text-muted">{c.count} · {money(c.value)}</span></h2>
              <ul className="flex flex-col gap-2">
                {c.cards.map((l) => (
                  <li key={l.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', l.id)} className="rounded-md border border-border bg-surface p-2 shadow-1">
                    <button className="w-full text-left" onClick={() => nav(`/leads/${l.id}`)}>
                      <span className="block font-medium">{l.name}</span>
                      <span className="text-xs text-muted">{l.phone ?? l.email}</span>
                    </button>
                    <label className="mt-1 block text-xs text-muted">
                      <span className="sr-only">Move {l.name} to stage</span>
                      <select className="mt-1 w-full rounded-sm border border-border-input bg-surface p-1 text-xs" value={l.stage} onChange={(e) => setDrop({ lead: l, to: e.target.value })}>
                        {board.data!.columns.map((x) => <option key={x.stage} value={x.stage}>{x.label}</option>)}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ))}
      {drop && <StageDialog lead={drop.lead} to={drop.to} onClose={() => setDrop(null)} />}
    </>
  );
}
