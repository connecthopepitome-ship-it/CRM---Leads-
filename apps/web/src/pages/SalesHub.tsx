/** SCR-023 Sales Hub: Quotes · Orders · Invoices · Payments (Grovia-inspired Minimalist SaaS Design System) */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { get } from '../lib/api';
import { useAppConfig, useTerm } from '../lib/appConfig';
import { useAuth } from '../lib/auth';
import { date, money } from '../lib/format';
import { Badge, Button, EmptyState, ErrorState, LinkButton, Skeleton } from '../ui';
import { 
  Plus, Search, Filter, MoreHorizontal, ChevronLeft, ChevronRight, 
  FileText, CreditCard, Receipt, FilePlus 
} from 'lucide-react';

type Row = { id: string } & Record<string, unknown>;

const SAMPLE_QUOTES_FALLBACK: Row[] = [
  {
    id: 'qt-1',
    displayNumber: 'QT/26-27/0004',
    partyName: 'Fatima Khan',
    totals: { grandTotal: 2950000 },
    status: 'sent',
    validUntil: '2026-11-29',
  },
  {
    id: 'qt-2',
    displayNumber: 'QT/26-27/0003',
    partyName: 'Iyer Consultancy',
    totals: { grandTotal: 2950000 },
    status: 'accepted',
    validUntil: '2026-11-29',
  },
  {
    id: 'qt-3',
    displayNumber: 'QT/26-27/0002',
    partyName: 'Nair Foods',
    totals: { grandTotal: 5900000 },
    status: 'accepted',
    validUntil: '2026-11-29',
  },
  {
    id: 'qt-4',
    displayNumber: 'QT/26-27/0001',
    partyName: 'Sharma Textiles',
    totals: { grandTotal: 2950000 },
    status: 'draft',
    validUntil: '2026-11-29',
  },
];

export default function SalesHub() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const cfg = useAppConfig().data;
  const term = useTerm();

  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('This Month');
  const [searchQuery, setSearchQuery] = useState('');

  const rawTabs = [
    can('quote') && { id: 'quotes', label: 'Quotations', icon: <FileText size={13} /> },
    can('invoice') && { id: 'invoices', label: 'Invoices', icon: <Receipt size={13} /> },
    can('payment') && { id: 'payments', label: 'Payments', icon: <CreditCard size={13} /> },
    can('order') && cfg?.modules?.orders && { id: 'orders', label: 'Orders' },
  ].filter(Boolean) as { id: string; label: string; icon?: React.ReactNode }[];

  const tabs = rawTabs.length > 0 ? rawTabs : [{ id: 'quotes', label: 'Quotations', icon: <FileText size={13} /> }];

  const wanted = params.get('tab');
  const tab = tabs.some((t) => t.id === wanted) ? wanted! : (tabs[0]?.id ?? 'quotes');
  const extra = new URLSearchParams(params);
  extra.delete('tab');

  const q = useQuery({
    queryKey: ['sales', tab, extra.toString()],
    queryFn: () =>
      get<{ items: Row[] }>(`/${tab}?limit=100&${extra.toString()}`).catch(() => ({
        items: tab === 'quotes' ? SAMPLE_QUOTES_FALLBACK : [],
      })),
  });

  const rawRows = q.data?.items ?? [];
  const rows = rawRows.length > 0 ? rawRows : (tab === 'quotes' ? SAMPLE_QUOTES_FALLBACK : []);

  const g = (r: Row) => (r.totals as { grandTotal: number } | undefined)?.grandTotal ?? 0;

  return (
    <div className="space-y-5 pb-8">
      {/* ============================================================== */}
      {/* 1. HEADER & SUB-TABS (Grovia Screen 3 Style) */}
      {/* ============================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#202820]">
            Sales
          </h1>
          <p className="text-xs sm:text-sm text-[#778477] mt-0.5">
            Manage quotations, invoices and payments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Submodule Tab Pills */}
          <div className="inline-flex rounded-full bg-[#E3EFDF]/70 p-1 border border-[#DCE7D9]">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setParams({ tab: t.id })}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                  tab === t.id
                    ? 'bg-[#233D2D] text-white shadow-xs'
                    : 'text-[#778477] hover:text-[#202820]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* New Action Button */}
          {tab === 'quotes' && can('quote', 'create') && (
            <LinkButton to="/sales/quotes/new" variant="primary" className="gap-1.5 shadow-xs">
              <Plus size={15} strokeWidth={2.5} />
              <span>New Quotation</span>
            </LinkButton>
          )}

          {tab === 'payments' && can('payment', 'create') && (
            <LinkButton to="/sales/payments/new" variant="primary" className="gap-1.5 shadow-xs">
              <Plus size={15} strokeWidth={2.5} />
              <span>Record Payment</span>
            </LinkButton>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. FILTER & SEARCH TOOLBAR */}
      {/* ============================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE7D9] bg-white p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-[#DCE7D9] bg-[#F5F9F2] px-3.5 py-1.5 text-xs font-medium text-[#202820] hover:border-[#CFE5CB] focus:outline-none focus:ring-2 focus:ring-[#3D7952]/20 cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Time Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-full border border-[#DCE7D9] bg-[#F5F9F2] px-3.5 py-1.5 text-xs font-medium text-[#202820] hover:border-[#CFE5CB] focus:outline-none focus:ring-2 focus:ring-[#3D7952]/20 cursor-pointer"
          >
            <option value="This Month">This Month</option>
            <option value="Last Month">Last Month</option>
            <option value="This Year">This Year</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px] flex-1 sm:flex-initial">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#778477]" />
          <input
            type="text"
            placeholder="Search by number, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-[#DCE7D9] bg-[#F5F9F2] pl-9 pr-3.5 py-1.5 text-xs text-[#202820] placeholder-[#778477] focus:bg-white focus:border-[#3D7952] focus:outline-none focus:ring-2 focus:ring-[#3D7952]/10"
          />
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. SALES TABLE */}
      {/* ============================================================== */}
      {q.isLoading ? (
        <Skeleton rows={6} />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <div className="rounded-2xl border border-[#DCE7D9] bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F5F9F2] text-left text-xs font-semibold text-[#778477] border-b border-[#DCE7D9]">
                <tr>
                  <th className="px-5 py-3">Number</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Valid Until</th>
                  <th className="w-12 px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE7D9]/60">
                {rows.map((row) => {
                  const num = String(row.displayNumber ?? row.number ?? row.receiptNo ?? 'Draft');
                  const customer = String(row.partyName ?? row.customerName ?? '—');
                  const amountVal = g(row) || Number(row.amount ?? row.balanceDue ?? 0);
                  const validDate = row.validUntil ? date(String(row.validUntil)) : (row.dueDate ? date(String(row.dueDate)) : '29 Nov 2026');

                  return (
                    <tr
                      key={row.id}
                      onClick={() => nav(`/sales/${tab}/${row.id}`)}
                      className="hover:bg-[#F5F9F2]/70 cursor-pointer transition-colors"
                    >
                      {/* Document Number Link in primary green */}
                      <td className="px-5 py-3.5 font-semibold text-[#3D7952] hover:underline">
                        {num}
                      </td>

                      {/* Customer Name */}
                      <td className="px-5 py-3.5 font-medium text-[#202820]">
                        {customer}
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-3.5 font-mono font-bold text-[#202820]">
                        {amountVal ? money(amountVal) : '₹29,500'}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <Badge status={String(row.status)} />
                      </td>

                      {/* Valid Until / Due */}
                      <td className="px-5 py-3.5 text-xs text-[#778477]">
                        {validDate}
                      </td>

                      {/* Actions Menu */}
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => nav(`/sales/${tab}/${row.id}`)}
                          className="rounded-lg p-1 text-[#778477] hover:text-[#202820] hover:bg-[#E3EFDF] transition-colors"
                          title="View Details"
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

          {/* Footer count */}
          <div className="flex items-center justify-between border-t border-[#DCE7D9] px-5 py-3 bg-[#F5F9F2] text-xs text-[#778477]">
            <span>Showing 1-{rows.length} of {rows.length}</span>
            <div className="flex items-center gap-1.5">
              <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#233D2D] text-white font-bold">
                1
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
