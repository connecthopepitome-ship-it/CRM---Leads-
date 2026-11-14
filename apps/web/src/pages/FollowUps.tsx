/** SCR-008 Follow-ups (FR-049). */
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { get, patch } from '../lib/api';
import { dateTime } from '../lib/format';
import { useAction } from '../features/hooks';
import { Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton, Tabs, toast } from '../ui';

interface FollowUp {
  id: string;
  recordType: string;
  recordId: string;
  recordName: string;
  dueAt: string;
  type: string;
  note: string | null;
  version: number;
}

export default function FollowUps() {
  const [params, setParams] = useSearchParams();
  const bucket = params.get('bucket') ?? 'today';
  const q = useQuery({ queryKey: ['followups', bucket], queryFn: () => get<{ items: FollowUp[] }>(`/follow-ups?bucket=${bucket}&limit=100`) });
  const act = useAction((a: { id: string; action: string; version: number; dueAt?: string }) => patch(`/follow-ups/${a.id}`, { action: a.action, dueAt: a.dueAt }, a.version), [['followups'], ['dashboard']], () => toast('Follow-up updated'));
  return (
    <>
      <PageHeader title="Follow-ups" />
      <Tabs tabs={[{ id: 'overdue', label: 'Overdue' }, { id: 'today', label: 'Today' }, { id: 'upcoming', label: 'Upcoming' }]} active={bucket} onChange={(b) => setParams({ bucket: b })} />
      {q.isLoading ? <Skeleton /> : q.error ? <ErrorState error={q.error} /> : !q.data!.items.length ? <EmptyState title={bucket === 'overdue' ? 'Nothing overdue' : 'No follow-ups'} body="Schedule follow-ups from a lead or customer." /> : (
        <ul className="flex flex-col gap-2">
          {q.data!.items.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
              <div className="min-w-0 flex-1">
                <Link to={`/${f.recordType === 'lead' ? 'leads' : 'customers'}/${f.recordId}`} className="font-medium text-primary hover:underline">{f.recordName}</Link>
                <p className="text-sm text-muted"><Badge tone={bucket === 'overdue' ? 'danger' : 'info'}>{f.type}</Badge> {dateTime(f.dueAt)}{f.note ? ` · ${f.note}` : ''}</p>
              </div>
              <Button size="sm" onClick={() => act.mutate({ id: f.id, action: 'complete', version: f.version })}>Done</Button>
              <Button size="sm" variant="secondary" onClick={() => act.mutate({ id: f.id, action: 'reschedule', version: f.version, dueAt: new Date(Date.now() + 86_400_000).toISOString() })}>Tomorrow</Button>
              <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: f.id, action: 'cancel', version: f.version })}>Cancel</Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
