/** SCR-025 Notification centre (FR-082). */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get, post } from '../lib/api';
import { relative } from '../lib/format';
import { useAction } from '../features/hooks';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../ui';

export default function Notifications() {
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => get<{ items: { id: string; title: string; link: string; createdAt: string; readAt: string | null }[] }>('/notifications?limit=50') });
  const read = useAction((body: object) => post('/notifications/read', body), [['notifications']]);
  return (
    <>
      <PageHeader title="Notifications" actions={<><Button variant="secondary" onClick={() => read.mutate({ all: true })}>Mark all read</Button><Link to="/me#notifications" className="self-center text-sm text-primary hover:underline">Preferences</Link></>} />
      {q.isLoading ? <Skeleton /> : q.error ? <ErrorState error={q.error} /> : !q.data!.items.length ? <EmptyState title="You're all caught up" /> : (
        <ul className="flex flex-col gap-2">
          {q.data!.items.map((n) => (
            <li key={n.id} className={`rounded-md border p-3 ${n.readAt ? 'border-border bg-surface' : 'border-primary bg-primary-subtle'}`}>
              <Link to={n.link} onClick={() => !n.readAt && read.mutate({ ids: [n.id] })} className="block">
                <span className="font-medium">{n.title}</span>
                <span className="block text-xs text-muted">{relative(n.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
