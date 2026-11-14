/** SCR-002 Home dashboard (FR-084). */
import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money } from '../lib/format';
import { Card, ErrorState, PageHeader, Skeleton, StatTile } from '../ui';

interface Tile {
  id: string;
  value?: number;
  amount?: number;
  link?: string;
  tone?: 'danger' | 'warning';
  stages?: { stage: string; count: number; value: number }[];
  target?: number;
  achieved?: number;
}

const LABELS: Record<string, string> = {
  followups_today: 'Follow-ups today', followups_overdue: 'Overdue follow-ups', new_leads: 'New leads', sla_breaches: 'SLA breaches', hot_leads: 'Hot leads',
  quotes_awaiting: 'Quotes awaiting reply', overdue_invoices: 'Overdue invoices', collections_month: 'Collected this month',
};

export default function Home() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => get<{ tiles: Tile[] }>('/dashboard'), refetchInterval: 60_000 });
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  if (q.isLoading) return <Skeleton rows={6} />;
  if (q.error) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const tiles = q.data!.tiles;
  const pipeline = tiles.find((t) => t.id === 'pipeline');
  const target = tiles.find((t) => t.id === 'target');
  const maxVal = Math.max(1, ...(pipeline?.stages ?? []).map((s) => s.value));
  return (
    <>
      <PageHeader title={`${greeting}, ${user?.fullName.split(' ')[0] ?? ''}`} subtitle="Here's your day at a glance." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.filter((t) => LABELS[t.id]).map((t) => (
          <StatTile key={t.id} label={LABELS[t.id]!} value={t.amount !== undefined && t.value === undefined ? money(t.amount) : t.amount !== undefined ? `${t.value} · ${money(t.amount)}` : (t.value ?? 0)} tone={t.value ? t.tone : undefined} to={t.link} />
        ))}
      </div>
      {pipeline && (
        <Card title="Pipeline by stage" className="mt-4">
          <ul className="flex flex-col gap-2" aria-label="Pipeline by stage">
            {pipeline.stages!.map((s) => (
              <li key={s.stage} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate">{s.stage}</span>
                <span className="h-3 rounded-full bg-surface-2"><span className="block h-3 rounded-full bg-primary" style={{ width: `${Math.max(2, (s.value / maxVal) * 100)}%` }} /></span>
                <span className="tabular-nums text-muted">{s.count} · {money(s.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {target && (
        <Card title="Target this month" className="mt-4">
          <p className="text-sm">{money(target.achieved)} of {money(target.target)} ({Math.round(((target.achieved ?? 0) / Math.max(1, target.target ?? 1)) * 100)}%)</p>
        </Card>
      )}
    </>
  );
}
