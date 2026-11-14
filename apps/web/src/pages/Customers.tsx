/** SCR-020 Customers list (FR-074). */
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { get } from '../lib/api';
import { useTerm } from '../lib/appConfig';
import { useAuth } from '../lib/auth';
import { money } from '../lib/format';
import { Button, EmptyState, ErrorState, Input, LinkButton, PageHeader, Skeleton, Table } from '../ui';

interface Customer {
  id: string;
  code: string;
  displayName: string;
  gstin: string | null;
  totals?: { outstanding: number; invoiced: number };
}

export default function Customers() {
  const term = useTerm();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const q = params.get('q') ?? '';
  const list = useInfiniteQuery({
    queryKey: ['customers', q],
    queryFn: ({ pageParam }) => get<{ items: Customer[]; nextCursor: string | null }>(`/customers?limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}${pageParam ? `&cursor=${pageParam}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const finance = can('finance');
  return (
    <>
      <PageHeader title={term('customers', 'Customers')} actions={can('customer', 'create') && <LinkButton to="/customers/new" variant="primary">New customer</LinkButton>} />
      <div className="mb-3 max-w-sm" role="search">
        <Input aria-label="Search customers" placeholder="Search name, phone, GSTIN or code" defaultValue={q} onKeyDown={(e) => e.key === 'Enter' && setParams((e.target as HTMLInputElement).value ? { q: (e.target as HTMLInputElement).value } : {})} />
      </div>
      {list.isLoading ? <Skeleton rows={6} /> : list.error ? <ErrorState error={list.error} /> : (
        <Table<Customer>
          rows={rows}
          onRow={(c) => nav(`/customers/${c.id}`)}
          empty={<EmptyState title="No customers yet" body="Convert a lead or add a customer." />}
          columns={[
            { key: 'displayName', label: 'Customer' },
            { key: 'code', label: 'Code' },
            { key: 'gstin', label: 'GSTIN', render: (c) => c.gstin ?? '—' },
            ...(finance ? [{ key: 'out', label: 'Outstanding', align: 'right' as const, render: (c: Customer) => money(c.totals?.outstanding ?? 0) }] : []),
          ]}
        />
      )}
      {list.hasNextPage && <div className="mt-3 text-center"><Button variant="secondary" onClick={() => void list.fetchNextPage()}>Load more</Button></div>}
    </>
  );
}
