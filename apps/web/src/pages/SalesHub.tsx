/** SCR-023 Sales hub: Quotes · Orders · Invoices · Payments (FR-051, FR-059, FR-062, FR-070). */
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { get } from '../lib/api';
import { useAppConfig, useTerm } from '../lib/appConfig';
import { useAuth } from '../lib/auth';
import { date, money } from '../lib/format';
import { Badge, EmptyState, ErrorState, LinkButton, PageHeader, Skeleton, Table, Tabs } from '../ui';

type Row = { id: string } & Record<string, unknown>;

export default function SalesHub() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const cfg = useAppConfig().data;
  const term = useTerm();
  const tabs = [
    can('quote') && { id: 'quotes', label: term('quotations', 'Quotations') },
    can('order') && cfg?.modules.orders && { id: 'orders', label: 'Orders' }, // FR-004 AC4: hidden when the module is off
    can('invoice') && { id: 'invoices', label: 'Invoices' },
    can('payment') && { id: 'payments', label: 'Payments' },
  ].filter(Boolean) as { id: string; label: string }[];
  const wanted = params.get('tab');
  const tab = tabs.some((t) => t.id === wanted) ? wanted! : (tabs[0]?.id ?? 'quotes');
  const extra = new URLSearchParams(params);
  extra.delete('tab');
  const q = useQuery({ queryKey: ['sales', tab, extra.toString()], queryFn: () => get<{ items: Row[] }>(`/${tab}?limit=100&${extra.toString()}`) });
  const g = (r: Row) => (r.totals as { grandTotal: number } | undefined)?.grandTotal ?? 0;
  const columns = {
    quotes: [
      { key: 'displayNumber', label: 'Number', render: (r: Row) => String(r.displayNumber ?? 'Draft') },
      { key: 'partyName', label: 'For' },
      { key: 'status', label: 'Status', render: (r: Row) => <Badge status={String(r.status)} /> },
      { key: 'validUntil', label: 'Valid until', render: (r: Row) => date(String(r.validUntil)) },
      { key: 'total', label: 'Total', align: 'right' as const, render: (r: Row) => money(g(r)) },
    ],
    orders: [
      { key: 'number', label: 'Number' },
      { key: 'date', label: 'Date', render: (r: Row) => date(String(r.date)) },
      { key: 'status', label: 'Status', render: (r: Row) => <Badge status={String(r.status)} /> },
      { key: 'total', label: 'Total', align: 'right' as const, render: (r: Row) => money(g(r)) },
    ],
    invoices: [
      { key: 'number', label: 'Number', render: (r: Row) => String(r.number ?? 'Draft') },
      { key: 'customerName', label: 'Customer' },
      { key: 'dueDate', label: 'Due', render: (r: Row) => date(String(r.dueDate)) },
      { key: 'status', label: 'Status', render: (r: Row) => <Badge status={String(r.status)} /> },
      { key: 'balanceDue', label: 'Balance', align: 'right' as const, render: (r: Row) => money(Number(r.balanceDue)) },
    ],
    payments: [
      { key: 'receiptNo', label: 'Receipt' },
      { key: 'customerName', label: 'Customer' },
      { key: 'date', label: 'Date', render: (r: Row) => date(String(r.date)) },
      { key: 'status', label: 'Status', render: (r: Row) => <Badge status={String(r.status)} /> },
      { key: 'amount', label: 'Amount', align: 'right' as const, render: (r: Row) => money(Number(r.amount)) },
    ],
  }[tab] ?? [];
  return (
    <>
      <PageHeader title="Sales" actions={<>
        {can('quote', 'create') && <LinkButton to="/sales/quotes/new" variant="primary">New {term('quotation', 'quotation').toLowerCase()}</LinkButton>}
        {can('payment', 'create') && <LinkButton to="/sales/payments/new">Record payment</LinkButton>}
      </>} />
      <Tabs tabs={tabs} active={tab} onChange={(t) => setParams({ tab: t })} />
      {q.isLoading ? <Skeleton rows={6} /> : q.error ? <ErrorState error={q.error} /> : (
        <Table<Row> rows={q.data!.items} columns={columns} onRow={(r) => nav(`/sales/${tab}/${r.id}`)} empty={<EmptyState title={`No ${tab} yet`} />} />
      )}
    </>
  );
}
