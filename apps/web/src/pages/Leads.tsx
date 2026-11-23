/** SCR-003 Leads Directory & Kanban (Grovia-inspired Minimalist SaaS Design System) */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import { useTerm } from '../lib/appConfig';
import { useAuth } from '../lib/auth';
import { formatSla, getStageLabel, money, relative } from '../lib/format';
import { useAction, useOptions, useUsers, type Lead } from '../features/hooks';
import { StageDialog } from '../features/StageDialog';
import { Badge, Button, EmptyState, ErrorState, Input, LinkButton, PageHeader, Select, Skeleton, Table, toast } from '../ui';
import { 
  Search, Plus, Upload, Filter, MoreHorizontal, ChevronLeft, ChevronRight, 
  User, CheckSquare, Phone, Calendar 
} from 'lucide-react';

const SAMPLE_LEADS_FALLBACK: Lead[] = [
  {
    id: 'lead-1',
    name: 'Fatima Khan',
    company: 'Khan Enterprises',
    phone: '+91 98450 11104',
    email: 'fatima@khanenterprises.in',
    stage: 'new',
    slaStatus: 'pending',
    slaDueAt: new Date(Date.now() + 172800000).toISOString(),
    nextFollowUpAt: new Date(Date.now() + 172800000).toISOString(),
    expectedValue: 2950000,
    sourceId: 'src-1',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lead-2',
    name: 'Mohan Das',
    company: 'Das Precision Tools',
    phone: '+91 98450 11109',
    email: 'mohan@dastools.com',
    stage: 'contacted',
    slaStatus: 'pending',
    slaDueAt: new Date(Date.now() + 172800000).toISOString(),
    nextFollowUpAt: new Date(Date.now() + 172800000).toISOString(),
    expectedValue: 4500000,
    sourceId: 'src-2',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lead-3',
    name: 'Deepa Reddy',
    company: 'Reddy Tech Solutions',
    phone: '+91 98450 11108',
    email: 'deepa@reddytech.io',
    stage: 'interested',
    slaStatus: 'met',
    slaDueAt: new Date().toISOString(),
    nextFollowUpAt: new Date(Date.now() + 259200000).toISOString(),
    expectedValue: 6000000,
    sourceId: 'src-1',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lead-4',
    name: 'Rahul Gupta',
    company: 'Gupta Steel Traders',
    phone: '+91 98450 11107',
    email: 'rahul@guptasteel.com',
    stage: 'negotiation',
    slaStatus: 'pending',
    slaDueAt: new Date().toISOString(),
    nextFollowUpAt: new Date(Date.now() + 86400000).toISOString(),
    expectedValue: 8500000,
    sourceId: 'src-3',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lead-5',
    name: 'Lakshmi Menon',
    company: 'Menon Logistics Hub',
    phone: '+91 98450 11106',
    email: 'lakshmi@menonlogistics.in',
    stage: 'quotation_sent',
    slaStatus: 'met',
    slaDueAt: new Date().toISOString(),
    nextFollowUpAt: new Date(Date.now() + 172800000).toISOString(),
    expectedValue: 3200000,
    sourceId: 'src-2',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const BOARD_STAGES = [
  { stage: 'new', label: 'New' },
  { stage: 'contacted', label: 'Contacted' },
  { stage: 'interested', label: 'Interested' },
  { stage: 'quotation_sent', label: 'Quotation Sent' },
  { stage: 'negotiation', label: 'Negotiation' },
  { stage: 'won', label: 'Won' },
  { stage: 'lost', label: 'Lost' },
];

export default function Leads() {
  const term = useTerm();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { perm } = useAuth();
  const view = params.get('view') ?? 'list';
  const stages = useOptions('pipelineStages');
  const sources = useOptions('leadSources');
  const users = useUsers(perm('lead:assign'));

  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  const qs = new URLSearchParams(params);
  qs.delete('view');

  const list = useInfiniteQuery({
    queryKey: ['leads', qs.toString()],
    queryFn: ({ pageParam }) =>
      get<{ items: Lead[]; nextCursor: string | null }>(
        `/leads?${qs.toString()}${pageParam ? `&cursor=${pageParam}` : ''}&limit=50`
      ).catch((err) => {
        if (isDemo) return { items: SAMPLE_LEADS_FALLBACK, nextCursor: null };
        throw err;
      }),
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: view === 'list',
  });

  const board = useQuery({
    queryKey: ['leads-board'],
    queryFn: () =>
      get<{ columns: { stage: string; label: string; count: number; value: number; cards: Lead[] }[] }>('/leads/board')
        .catch((err) => {
          if (isDemo) {
            return {
              columns: [
                { stage: 'new', label: 'New', count: 12, value: 35400000, cards: SAMPLE_LEADS_FALLBACK.filter((l) => l.stage === 'new') },
                { stage: 'contacted', label: 'Contacted', count: 8, value: 24000000, cards: SAMPLE_LEADS_FALLBACK.filter((l) => l.stage === 'contacted') },
                { stage: 'interested', label: 'Interested', count: 5, value: 18000000, cards: SAMPLE_LEADS_FALLBACK.filter((l) => l.stage === 'interested') },
                { stage: 'quotation_sent', label: 'Quotation Sent', count: 3, value: 8900000, cards: SAMPLE_LEADS_FALLBACK.filter((l) => l.stage === 'quotation_sent') },
                { stage: 'negotiation', label: 'Negotiation', count: 3, value: 12000000, cards: SAMPLE_LEADS_FALLBACK.filter((l) => l.stage === 'negotiation') },
                { stage: 'won', label: 'Won', count: 0, value: 0, cards: [] },
                { stage: 'lost', label: 'Lost', count: 0, value: 0, cards: [] },
              ],
            };
          }
          throw err;
        }),
    enabled: view === 'board',
  });

  const [selected, setSelected] = useState<string[]>([]);
  const [assignTo, setAssignTo] = useState('');
  const [drop, setDrop] = useState<{ lead: Lead; to: string } | null>(null);

  const bulk = useAction(
    (body: object) => post<{ ok: string[]; skipped: { id: string; reason: string }[] }>('/leads/bulk', body),
    [['leads'], ['leads-board']],
    (r) => {
      const okCount = r?.ok?.length ?? 0;
      const skipCount = r?.skipped?.length ?? 0;
      toast(`${okCount} updated${skipCount ? `, ${skipCount} skipped` : ''}`);
      setSelected([]);
    }
  );

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
  };

  const rawRows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const rows = rawRows.length > 0 ? rawRows : (isDemo ? SAMPLE_LEADS_FALLBACK : []);

  const stageLabel = (k: string) => {
    switch (k) {
      case 'new': return 'New';
      case 'contacted': return 'Contacted';
      case 'interested': return 'Interested';
      case 'quotation_sent': return 'Quotation Sent';
      case 'negotiation': return 'Negotiation';
      case 'won': return 'Won';
      case 'lost': return 'Lost';
      default: return stages.data?.find((s) => s.key === k)?.label ?? k;
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* ============================================================== */}
      {/* 1. HEADER & PRIMARY ACTIONS */}
      {/* ============================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#202820]">
            {term('leads', 'Leads')}
          </h1>
          <p className="text-xs sm:text-sm text-[#778477] mt-0.5">
            Manage and track all your leads.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* List / Board View Switcher Pills */}
          <div className="inline-flex rounded-full bg-[#E3EFDF]/70 p-1 border border-[#DCE7D9]">
            <button
              onClick={() => set('view', '')}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                view === 'list'
                  ? 'bg-[#233D2D] text-white shadow-xs'
                  : 'text-[#778477] hover:text-[#202820]'
              }`}
            >
              List
            </button>
            <button
              onClick={() => set('view', 'board')}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                view === 'board'
                  ? 'bg-[#233D2D] text-white shadow-xs'
                  : 'text-[#778477] hover:text-[#202820]'
              }`}
            >
              Board
            </button>
          </div>

          {perm('lead:import') && (
            <LinkButton to="/settings/import" variant="secondary" className="gap-1.5">
              <Upload size={14} />
              <span>Import</span>
            </LinkButton>
          )}

          <LinkButton to="/leads/new" variant="primary" className="gap-1.5 shadow-xs">
            <Plus size={15} strokeWidth={2.5} />
            <span>New Lead</span>
          </LinkButton>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. FILTER & SEARCH TOOLBAR (Grovia Screen 2 Style) */}
      {/* ============================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE7D9] bg-white p-3 shadow-2xs">
        {/* Left Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Stage Filter */}
          <select
            value={params.get('stage') ?? ''}
            onChange={(e) => set('stage', e.target.value)}
            className="rounded-full border border-[#DCE7D9] bg-[#F5F9F2] px-3.5 py-1.5 text-xs font-medium text-[#202820] hover:border-[#CFE5CB] focus:outline-none focus:ring-2 focus:ring-[#3D7952]/20 cursor-pointer"
          >
            <option value="">All Stages</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="quotation_sent">Quotation Sent</option>
            <option value="negotiation">Negotiation</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>

          {/* Source Filter */}
          <select
            value={params.get('sourceId') ?? ''}
            onChange={(e) => set('sourceId', e.target.value)}
            className="rounded-full border border-[#DCE7D9] bg-[#F5F9F2] px-3.5 py-1.5 text-xs font-medium text-[#202820] hover:border-[#CFE5CB] focus:outline-none focus:ring-2 focus:ring-[#3D7952]/20 cursor-pointer"
          >
            <option value="">All Sources</option>
            {sources.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          {/* SLA Filter */}
          <select
            value={params.get('sla') ?? ''}
            onChange={(e) => set('sla', e.target.value)}
            className="rounded-full border border-[#DCE7D9] bg-[#F5F9F2] px-3.5 py-1.5 text-xs font-medium text-[#202820] hover:border-[#CFE5CB] focus:outline-none focus:ring-2 focus:ring-[#3D7952]/20 cursor-pointer"
          >
            <option value="">Any SLA</option>
            <option value="pending">SLA running</option>
            <option value="breached">SLA breached</option>
            <option value="met">Contacted in time</option>
          </select>
        </div>

        {/* Right Search Bar */}
        <div className="relative min-w-[240px] flex-1 sm:flex-initial">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#778477]" />
          <input
            type="text"
            placeholder="Search leads..."
            defaultValue={params.get('q') ?? ''}
            onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value)}
            className="w-full rounded-full border border-[#DCE7D9] bg-[#F5F9F2] pl-9 pr-3.5 py-1.5 text-xs text-[#202820] placeholder-[#778477] focus:bg-white focus:border-[#3D7952] focus:outline-none focus:ring-2 focus:ring-[#3D7952]/10"
          />
        </div>
      </div>

      {/* Bulk action bar if items selected */}
      {selected.length > 0 && perm('lead:assign') && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-[#EAF5E8] border border-[#CFE5CB] p-3 text-xs font-medium text-[#202820] shadow-xs">
          <span>{selected.length} lead(s) selected</span>
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            className="rounded-xl border border-[#DCE7D9] bg-white px-3 py-1 text-xs"
          >
            <option value="">Assign to executive…</option>
            {users.data?.filter((u) => u.status === 'active').map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!assignTo}
            busy={bulk.isPending}
            onClick={() => bulk.mutate({ ids: selected, action: 'assign', ownerId: assignTo })}
          >
            Reassign
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. LEADS TABLE (LIST VIEW) */}
      {/* ============================================================== */}
      {view === 'list' && (
        list.isLoading ? (
          <Skeleton rows={6} />
        ) : list.isError ? (
          <ErrorState error={list.error} retry={() => void list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No leads yet"
            description="Create your first lead to start tracking conversions and pipeline."
            action={
              can('lead', 'create') ? (
                <LinkButton to="/leads/new" variant="primary">
                  New Lead
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
        <div className="rounded-2xl border border-[#DCE7D9] bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F5F9F2] text-left text-xs font-semibold text-[#778477] border-b border-[#DCE7D9]">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded-sm border-[#DCE7D9] text-[#3D7952] focus:ring-[#3D7952]"
                      checked={selected.length === rows.length && rows.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                    />
                  </th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">SLA</th>
                  <th className="px-4 py-3">Next Follow-up</th>
                  <th className="w-12 px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE7D9]/60">
                {rows.map((lead) => {
                  const isChecked = selected.includes(lead.id);

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => nav(`/leads/${lead.id}`)}
                      className="hover:bg-[#F5F9F2]/70 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded-sm border-[#DCE7D9] text-[#3D7952] focus:ring-[#3D7952]"
                          checked={isChecked}
                          onChange={(e) =>
                            setSelected((prev) =>
                              e.target.checked ? [...prev, lead.id] : prev.filter((id) => id !== lead.id)
                            )
                          }
                        />
                      </td>

                      {/* Name with initials avatar */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E3EFDF] text-xs font-bold text-[#233D2D]">
                            {lead.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-[#202820] hover:text-[#3D7952] block">
                              {lead.name}
                            </span>
                            {lead.company && (
                              <span className="text-[11px] text-[#778477] block">
                                {lead.company}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3.5 text-xs text-[#202820] font-mono">
                        {lead.phone ?? lead.phoneRaw ?? lead.email ?? '—'}
                      </td>

                      {/* Stage Pill */}
                      <td className="px-4 py-3.5">
                        <Badge status={lead.stage}>{stageLabel(lead.stage)}</Badge>
                      </td>

                      {/* SLA */}
                      <td className="px-4 py-3.5 text-xs text-[#778477]">
                        {(() => {
                          const sla = formatSla(lead.slaStatus, lead.slaDueAt);
                          const cls = sla.tone === 'danger' ? 'text-[#D66B68] font-medium' : sla.tone === 'warning' ? 'text-[#D99A45] font-medium' : 'text-[#3D7952] font-medium';
                          return <span className={cls}>{sla.text}</span>;
                        })()}
                      </td>

                      {/* Next Follow-up */}
                      <td className="px-4 py-3.5 text-xs text-[#778477]">
                        {lead.nextFollowUpAt ? '17 Nov' : '—'}
                      </td>

                      {/* Action Menu button */}
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => nav(`/leads/${lead.id}`)}
                          className="rounded-lg p-1 text-[#778477] hover:text-[#202820] hover:bg-[#E3EFDF] transition-colors"
                          title="View Lead details"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-[#DCE7D9] px-5 py-3 bg-[#F5F9F2] text-xs text-[#778477]">
            <span>Showing {rows.length > 0 ? `1-${rows.length}` : '0'} of {rows.length}</span>

            <div className="flex items-center gap-1.5">
              <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#233D2D] text-white font-bold">
                1
              </button>
            </div>
          </div>
        </div>
        )
      )}

      {/* ============================================================== */}
      {/* 4. KANBAN BOARD VIEW */}
      {/* ============================================================== */}
      {view === 'board' && (
        board.isLoading ? (
          <Skeleton rows={6} />
        ) : board.isError ? (
          <ErrorState error={board.error} retry={() => void board.refetch()} />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-6" aria-label="Lead board">
            {BOARD_STAGES.map((s) => {
              const col = (board.data?.columns ?? []).find((c) => c.stage === s.stage);
              const cards = col?.cards ?? [];
              const count = col?.count ?? cards.length;
              return (
                <section
                  key={s.stage}
                  className="w-72 shrink-0 rounded-2xl border border-[#DCE7D9] bg-white p-3 shadow-2xs"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData('text/plain');
                    const lead = (board.data?.columns ?? []).flatMap((x) => x.cards ?? []).find((x) => x.id === id);
                    if (lead && lead.stage !== s.stage) setDrop({ lead, to: s.stage });
                  }}
                >
                  <div className="mb-3 flex items-center justify-between px-1 border-b border-[#DCE7D9]/60 pb-2">
                    <span className="font-bold text-xs text-[#202820]">{s.label}</span>
                    <span className="rounded-full bg-[#E3EFDF] px-2 py-0.5 text-[10px] font-bold text-[#233D2D]">
                      {count}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {cards.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#778477]">No leads</div>
                    ) : (
                      cards.map((l) => (
                        <div
                          key={l.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', l.id)}
                          onClick={() => nav(`/leads/${l.id}`)}
                          className="rounded-xl border border-[#DCE7D9] bg-[#F5F9F2] p-3 text-xs hover:border-[#3D7952] hover:bg-white cursor-pointer transition-all shadow-2xs"
                        >
                          <div className="font-bold text-[#202820]">{l.name}</div>
                          <div className="text-[11px] text-[#778477] mt-0.5">{l.phone ?? l.email}</div>
                          {l.expectedValue && (
                            <div className="mt-2 font-mono text-[11px] font-bold text-[#3D7952]">
                              {money(l.expectedValue)}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )
      )}

      {drop && <StageDialog lead={drop.lead} to={drop.to} onClose={() => setDrop(null)} />}
    </div>
  );
}
