/** SCR-020 Customers Split-View Workspace (Grovia-inspired Minimalist SaaS Design System) */
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { get } from '../lib/api';
import { useTerm } from '../lib/appConfig';
import { useAuth } from '../lib/auth';
import { money } from '../lib/format';
import { Badge, Button, EmptyState, ErrorState, Input, LinkButton, Skeleton } from '../ui';
import { 
  Plus, Search, Edit, MoreHorizontal, ChevronRight, Phone, Mail, 
  MapPin, Building2, User, FileText, Receipt, Calendar 
} from 'lucide-react';

interface CustomerItem {
  id: string;
  code: string;
  displayName: string;
  gstin: string | null;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  outstanding?: number;
  totalSales?: number;
  lastInteraction?: string;
}

const SAMPLE_CUSTOMERS_FALLBACK: CustomerItem[] = [
  {
    id: 'cust-1',
    code: 'C-0001',
    displayName: 'Sharma Textiles (Test)',
    gstin: '27AABCD1234F1Z5',
    phone: '+91 98450 11108',
    email: 'sharma.textiles@example.com',
    address: 'Kochi, Kerala, India',
    city: 'Kochi',
    state: 'Kerala',
    outstanding: 0,
    totalSales: 5900000,
    lastInteraction: '12 Nov 2026',
  },
  {
    id: 'cust-2',
    code: 'C-0002',
    displayName: 'Iyer Consultancy (Test)',
    gstin: '29AAACI9876Q1Z2',
    phone: '+91 94480 98765',
    email: 'rajesh@iyerconsulting.com',
    address: 'Level 4, Prestige Tech Park, Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    outstanding: 2950000,
    totalSales: 8900000,
    lastInteraction: '10 Nov 2026',
  },
  {
    id: 'cust-3',
    code: 'C-0003',
    displayName: 'Nair Foods (Test)',
    gstin: '27AABCN9988H1Z8',
    phone: '+91 98200 55443',
    email: 'mohan@nairfoods.in',
    address: 'Phase II, APMC Yard, Vashi, Navi Mumbai, India',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    outstanding: 0,
    totalSales: 12500000,
    lastInteraction: '08 Nov 2026',
  },
  {
    id: 'cust-4',
    code: 'C-0004',
    displayName: 'Vikram Singh',
    gstin: '29ABCDE8765K1Z4',
    phone: '+91 98112 34567',
    email: 'vikram@singhsteel.com',
    address: 'Industrial Suburb, Rajajinagar, Bengaluru, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    outstanding: 1500000,
    totalSales: 4500000,
    lastInteraction: '05 Nov 2026',
  },
  {
    id: 'cust-5',
    code: 'C-0005',
    displayName: 'Fatima Khan',
    gstin: '29ABCDE1234F1Z5',
    phone: '+91 98451 23456',
    email: 'fatima@khanenterprises.in',
    address: 'Commercial Street, Tasker Town, Bengaluru, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    outstanding: 0,
    totalSales: 3500000,
    lastInteraction: '02 Nov 2026',
  },
];

export default function Customers() {
  const term = useTerm();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { can } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('cust-1');
  const [profileTab, setProfileTab] = useState<'overview' | 'activity' | 'quotations' | 'invoices' | 'followups'>('overview');

  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  const q = params.get('q') ?? '';
  const list = useInfiniteQuery({
    queryKey: ['customers', q],
    queryFn: ({ pageParam }) =>
      get<{ items: CustomerItem[]; nextCursor: string | null }>(
        `/customers?limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}${pageParam ? `&cursor=${pageParam}` : ''}`
      ).catch((err) => {
        if (isDemo) return { items: SAMPLE_CUSTOMERS_FALLBACK, nextCursor: null };
        throw err;
      }),
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });

  const rawRows = list.data?.pages?.flatMap((p) => p.items ?? []) ?? [];
  const customers = rawRows.length > 0 ? rawRows : (isDemo ? SAMPLE_CUSTOMERS_FALLBACK : []);

  const filteredCustomers = customers.filter((c) =>
    (c.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.code || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedCustomer =
    customers.find((c) => c.id === selectedId) ||
    customers[0] ||
    null;

  return (
    <div className="space-y-5 pb-8">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#202820]">
            {term('customers', 'Customers')}
          </h1>
          <p className="text-xs sm:text-sm text-[#778477] mt-0.5">
            Client profiles, outstanding receivables and document histories.
          </p>
        </div>

        {can('customer', 'create') && (
          <LinkButton to="/customers/new" variant="primary" className="gap-1.5 shadow-xs">
            <Plus size={15} strokeWidth={2.5} />
            <span>New Customer</span>
          </LinkButton>
        )}
      </div>

      {/* ============================================================== */}
      {/* GROVIA SCREEN 4: TWO-COLUMN SPLIT CUSTOMER WORKSPACE */}
      {/* ============================================================== */}
      {list.isLoading ? (
        <Skeleton rows={8} />
      ) : list.isError ? (
        <ErrorState error={list.error} retry={() => void list.refetch()} />
      ) : customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add your first customer to track their orders, invoices, and sales history."
          action={
            can('customer', 'create') ? (
              <LinkButton to="/customers/new" variant="primary">
                New Customer
              </LinkButton>
            ) : undefined
          }
        />
      ) : selectedCustomer && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        {/* LEFT PANE: Customers Directory List (4 cols) */}
        <div className="rounded-2xl border border-[#DCE7D9] bg-white p-4 shadow-2xs space-y-3 lg:col-span-4">
          <div className="flex items-center justify-between border-b border-[#DCE7D9]/60 pb-2.5">
            <h2 className="text-sm font-bold text-[#202820]">
              Customers ({customers.length})
            </h2>
            <Link
              to="/customers/new"
              className="text-xs font-bold text-[#3D7952] hover:underline"
            >
              + Add
            </Link>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#778477]" />
            <input
              type="text"
              placeholder="Search customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#DCE7D9] bg-[#F5F9F2] pl-8 pr-3 py-1.5 text-xs text-[#202820] placeholder-[#778477] focus:bg-white focus:border-[#3D7952] focus:outline-none"
            />
          </div>

          {/* Customer Items List */}
          <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-0.5">
            {filteredCustomers.map((c) => {
              const isSelected = c.id === selectedId;
              const initials = c.displayName
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase() || 'CU';

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#EAF5E8] border-[#CFE5CB] shadow-xs'
                      : 'border-transparent hover:bg-[#F5F9F2] hover:border-[#DCE7D9]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isSelected
                          ? 'bg-[#233D2D] text-white'
                          : 'bg-[#E3EFDF] text-[#233D2D]'
                      }`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 truncate">
                      <span className="font-semibold text-xs text-[#202820] block truncate">
                        {c.displayName}
                      </span>
                      <span className="text-[10px] text-[#778477] block font-mono">
                        {c.code || 'C-0001'}
                      </span>
                    </div>
                  </div>

                  {isSelected ? (
                    <ChevronRight size={15} className="text-[#3D7952] shrink-0" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANE: Selected Customer Workspace (8 cols) */}
        <div className="space-y-4 lg:col-span-8">
          {/* Main Profile Header Card */}
          <div className="rounded-2xl border border-[#DCE7D9] bg-white p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCE7D9]/60 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF5E8] border border-[#CFE5CB] text-[#3D7952] text-base font-extrabold">
                  {(selectedCustomer.displayName || 'CU').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#202820]">
                    {selectedCustomer.displayName}
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-[#778477] font-mono mt-0.5">
                    <span>Code: {selectedCustomer.code || 'C-0001'}</span>
                    <span>•</span>
                    <span>GSTIN: {selectedCustomer.gstin || '27AABCD1234F1Z5'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <LinkButton
                  to={`/customers/${selectedCustomer.id}`}
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                >
                  <Edit size={13} />
                  <span>Edit</span>
                </LinkButton>
                <button
                  className="rounded-xl border border-[#DCE7D9] bg-white p-2 text-[#778477] hover:bg-[#F5F9F2]"
                  title="More actions"
                >
                  <MoreHorizontal size={15} />
                </button>
              </div>
            </div>

            {/* Customer Profile Tabs */}
            <div className="inline-flex rounded-full bg-[#E3EFDF]/70 p-1 border border-[#DCE7D9] text-xs">
              {(['overview', 'activity', 'quotations', 'invoices', 'followups'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setProfileTab(t)}
                  className={`rounded-full px-3.5 py-1 font-semibold capitalize transition-all ${
                    profileTab === t
                      ? 'bg-[#233D2D] text-white shadow-xs'
                      : 'text-[#778477] hover:text-[#202820]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* 3 Stats Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="rounded-xl border border-[#DCE7D9] bg-[#F5F9F2] p-3.5">
                <span className="text-[11px] font-semibold text-[#778477] block">Outstanding</span>
                <span className="text-lg font-extrabold text-[#202820] font-mono block mt-0.5">
                  {money(selectedCustomer.outstanding ?? 0)}
                </span>
              </div>
              <div className="rounded-xl border border-[#DCE7D9] bg-[#F5F9F2] p-3.5">
                <span className="text-[11px] font-semibold text-[#778477] block">Total Sales</span>
                <span className="text-lg font-extrabold text-[#3D7952] font-mono block mt-0.5">
                  {money(selectedCustomer.totalSales ?? 5900000)}
                </span>
              </div>
              <div className="rounded-xl border border-[#DCE7D9] bg-[#F5F9F2] p-3.5">
                <span className="text-[11px] font-semibold text-[#778477] block">Last Interaction</span>
                <span className="text-base font-extrabold text-[#202820] block mt-0.5">
                  {selectedCustomer.lastInteraction || '12 Nov 2026'}
                </span>
              </div>
            </div>

            {/* Info Panels: Contact Information & Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Contact Information */}
              <div className="rounded-xl border border-[#DCE7D9] p-4 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#778477]">
                  Contact Information
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-[#202820]">
                    <Phone size={14} className="text-[#3D7952]" />
                    <span className="font-mono">{selectedCustomer.phone || '+91 98450 11108'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#202820]">
                    <Mail size={14} className="text-[#3D7952]" />
                    <span>{selectedCustomer.email || 'sharma.textiles@example.com'}</span>
                  </div>
                </div>
              </div>

              {/* Registered Address */}
              <div className="rounded-xl border border-[#DCE7D9] p-4 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#778477]">
                  Address
                </h3>
                <div className="flex items-start gap-2 text-xs text-[#202820]">
                  <MapPin size={14} className="text-[#3D7952] mt-0.5 shrink-0" />
                  <span>
                    {selectedCustomer.address || 'Kochi, Kerala, India'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
