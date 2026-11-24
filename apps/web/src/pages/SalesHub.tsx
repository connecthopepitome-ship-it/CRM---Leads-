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

const SAMPLE_INVOICES_FALLBACK: Row[] = [
  {
    id: 'inv-1',
    number: 'INV/26-27/0001',
    customerName: 'Sharma Textiles',
    totals: { grandTotal: 2950000 },
    balanceDue: 0,
    status: 'paid',
    dueDate: '2026-11-29',
  },
  {
    id: 'inv-2',
    number: 'INV/26-27/0002',
    customerName: 'Nair Foods',
    totals: { grandTotal: 5900000 },
    balanceDue: 1500000,
    status: 'overdue',
    dueDate: '2026-11-15',
  },
];

const SAMPLE_PAYMENTS_FALLBACK: Row[] = [
  {
    id: 'pay-1',
    receiptNo: 'RCT/26-27/0001',
    customerName: 'Sharma Textiles',
    amount: 2950000,
    status: 'active',
    date: '2026-11-14',
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

  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  const q = useQuery({
    queryKey: ['sales', tab, extra.toString()],
    queryFn: () => get<{ items: Row[] }>(`/${tab}?limit=100&${extra.toString()}`),
  });

  const fallback = isDemo
    ? tab === 'invoices'
      ? SAMPLE_INVOICES_FALLBACK
      : tab === 'payments'
      ? SAMPLE_PAYMENTS_FALLBACK
      : SAMPLE_QUOTES_FALLBACK
    : [];

  const rawRows = q.data?.items ?? [];
  const rows = rawRows.length > 0 ? rawRows : fallback;

  const g = (r: Row) => {
    if (!r) return 0;
    const t = (r.totals as { grandTotal?: number } | undefined)?.grandTotal;
    if (typeof t === 'number' && !isNaN(t)) return t;
    if (typeof r.grandTotal === 'number' && !isNaN(r.grandTotal)) return r.grandTotal;
    if (typeof r.amount === 'number' && !isNaN(r.amount)) return r.amount;
    if (typeof r.balanceDue === 'number' && !isNaN(r.balanceDue)) return r.balanceDue;
    return 0;
  };

  return (
    <div className="space-y-5 pb-8">
      {/* ============================================================== */}
      {/* 1. HEADER (Structured by logical rows) */}
      {/* ============================================================== */}
      <div className="space-y-3.5">
        {/* Row 1: Title and Description */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#202820]">
            Sales
          </h1>
          <p className="text-xs sm:text-sm text-[#778477] mt-0.5">
            Manage quotations, invoices, payments, and orders.
          </p>
        </div>

        {/* Row 2: Dedicated Segmented Navigation Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="overflow-x-auto -mx-1 sm:mx-0 px-1 sm:px-0 pb-1 sm:pb-0">
            <div className="inline-flex rounded-full bg-[#E3EFDF]/80 p-1 border border-[#DCE7D9] shrink-0 shadow-2xs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setParams({ tab: t.id })}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                    tab === t.id
                      ? 'bg-[#233D2D] text-white shadow-xs'
                      : 'text-[#778477] hover:text-[#202820]'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop-only New Action Button on the right of tabs */}
          <div className="hidden sm:block">
            {tab === 'quotes' && can('quote', 'create') && (
              <LinkButton to="/sales/quotes/new" variant="primary" className="gap-1.5 shadow-xs">
                <Plus size={15} strokeWidth={2.5} />
                <span>New Quotation</span>
              </LinkButton>
            )}

            {tab === 'orders' && (
              <LinkButton to="/sales/orders/new" variant="primary" className="gap-1.5 shadow-xs">
                <Plus size={15} strokeWidth={2.5} />
                <span>New Sales Order</span>
              </LinkButton>
            )}

            {tab === 'invoices' && can('invoice', 'create') && (
              <LinkButton to="/sales/invoices/new" variant="primary" className="gap-1.5 shadow-xs">
                <Plus size={15} strokeWidth={2.5} />
                <span>New Invoice</span>
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

        {/* Row 3: Full-width Primary Action on Mobile */}
        <div className="w-full sm:hidden">
          {tab === 'quotes' && can('quote', 'create') && (
            <LinkButton to="/sales/quotes/new" variant="primary" className="w-full justify-center py-2.5 font-bold shadow-xs text-xs">
              <Plus size={15} strokeWidth={2.5} />
              <span>+ New Quotation</span>
            </LinkButton>
          )}

          {tab === 'orders' && (
            <LinkButton to="/sales/orders/new" variant="primary" className="w-full justify-center py-2.5 font-bold shadow-xs text-xs">
              <Plus size={15} strokeWidth={2.5} />
              <span>+ New Sales Order</span>
            </LinkButton>
          )}

          {tab === 'invoices' && can('invoice', 'create') && (
            <LinkButton to="/sales/invoices/new" variant="primary" className="w-full justify-center py-2.5 font-bold shadow-xs text-xs">
              <Plus size={15} strokeWidth={2.5} />
              <span>+ New Invoice</span>
            </LinkButton>
          )}

          {tab === 'payments' && can('payment', 'create') && (
            <LinkButton to="/sales/payments/new" variant="primary" className="w-full justify-center py-2.5 font-bold shadow-xs text-xs">
              <Plus size={15} strokeWidth={2.5} />
              <span>+ Record Payment</span>
            </LinkButton>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. FILTER & SEARCH TOOLBAR (Full width on mobile 320-430px) */}
      {/* ============================================================== */}
      <div className="rounded-2xl border border-[#DCE7D9] bg-white p-3.5 shadow-2xs space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-[#DCE7D9] bg-[#F5F9F2] px-3.5 py-2 text-xs font-medium text-[#202820] hover:border-[#CFE5CB] focus:outline-none focus:ring-2 focus:ring-[#3D7952]/20 cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="paid">Paid</option>
            <option value="active">Active</option>
          </select>

          {/* Time Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full rounded-xl border border-[#DCE7D9] bg-[#F5F9F2] px-3.5 py-2 text-xs font-medium text-[#202820] hover:border-[#CFE5CB] focus:outline-none focus:ring-2 focus:ring-[#3D7952]/20 cursor-pointer"
          >
            <option value="This Month">This Month</option>
            <option value="Last Month">Last Month</option>
            <option value="This Year">This Year</option>
          </select>
        </div>

        {/* Search Input: 100% full width, never overflows */}
        <div className="relative w-full">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#778477]" />
          <input
            type="text"
            placeholder="Search by number or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-[#DCE7D9] bg-[#F5F9F2] pl-9 pr-3.5 py-2 text-xs text-[#202820] placeholder-[#778477] focus:bg-white focus:border-[#3D7952] focus:outline-none focus:ring-2 focus:ring-[#3D7952]/10"
          />
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. SALES LIST (Mobile Cards + Desktop Table) */}
      {/* ============================================================== */}
      {q.isLoading ? (
        <Skeleton rows={6} />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={`No ${tab} yet`} description={`No ${tab} have been created or recorded.`} />
      ) : (
        <div className="space-y-3">
          {/* Mobile Cards (Visible only on < md screens) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {rows.map((row) => {
              const num = String(row.displayNumber ?? row.number ?? row.receiptNo ?? 'Draft');
              const customer = String(row.partyName ?? row.customerName ?? '—');
              const amountVal = g(row) || Number(row.amount ?? row.balanceDue ?? 0);
              const dateLabel = row.validUntil
                ? `Valid: ${date(String(row.validUntil))}`
                : row.dueDate
                ? `Due: ${date(String(row.dueDate))}`
                : row.date
                ? `Date: ${date(String(row.date))}`
                : '29 Nov 2026';

              return (
                <div
                  key={row.id}
                  onClick={() => nav(`/sales/${tab}/${row.id}`)}
                  className="rounded-2xl border border-[#DCE7D9] bg-white p-4 shadow-2xs hover:border-[#CFE5CB] active:bg-[#F5F9F2] transition-colors cursor-pointer space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#3D7952]">
                      {num}
                    </span>
                    <Badge status={String(row.status)} />
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-[#202820] truncate">
                      {customer}
                    </h3>
                    <p className="text-xs text-[#778477] mt-0.5 font-medium">
                      {dateLabel}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#DCE7D9]/60">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#778477] block">
                        {tab === 'invoices' ? 'Total / Balance' : 'Amount'}
                      </span>
                      <span className="font-mono font-extrabold text-sm text-[#202820]">
                        {amountVal ? money(amountVal) : '₹0'}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#3D7952]">
                      <span>Details</span>
                      <span>→</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (Visible only on >= md screens) */}
          <div className="hidden md:block rounded-2xl border border-[#DCE7D9] bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F5F9F2] text-left text-xs font-semibold text-[#778477] border-b border-[#DCE7D9]">
                  <tr>
                    <th className="px-5 py-3">Number</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Valid Until / Due</th>
                    <th className="w-12 px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE7D9]/60">
                  {rows.map((row) => {
                    const num = String(row.displayNumber ?? row.number ?? row.receiptNo ?? 'Draft');
                    const customer = String(row.partyName ?? row.customerName ?? '—');
                    const amountVal = g(row) || Number(row.amount ?? row.balanceDue ?? 0);
                    const validDate = row.validUntil ? date(String(row.validUntil)) : (row.dueDate ? date(String(row.dueDate)) : (row.date ? date(String(row.date)) : '29 Nov 2026'));

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
        </div>
      )}
    </div>
  );
}
