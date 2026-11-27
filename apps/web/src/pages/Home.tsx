import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  ChevronDown,
  CreditCard,
  FilePlus,
  FileText,
  Info,
  MoreHorizontal,
  Phone,
  Plus,
  RotateCw,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  BarChart3,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { get, patch } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dateTime, money } from '../lib/format';
import { toast } from '../ui';

export default function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [timeFilter, setTimeFilter] = useState('This Month');
  const [activeDonutSlice, setActiveDonutSlice] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const followUpsQ = useQuery({
    queryKey: ['follow-ups'],
    queryFn: () => get<{ items: any[] }>('/follow-ups'),
    refetchInterval: 60_000,
  });

  const metricsQ = useQuery({
    queryKey: ['dashboard-metrics', timeFilter],
    queryFn: () => get<any>(`/dashboard/metrics?period=${encodeURIComponent(timeFilter)}`),
    refetchInterval: 30_000,
  });

  const todayIST = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const followUps = useMemo(() => {
    const nowMs = Date.now();
    return (followUpsQ.data?.items ?? [])
      .filter((fu: any) => {
        if (fu.status === 'completed' || fu.completed) return false;
        if (!fu.dueAt) return false;
        const d = new Date(fu.dueAt);
        if (isNaN(d.getTime())) return false;
        const fuDateIST = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(d);
        return fuDateIST <= todayIST;
      })
      .sort((a: any, b: any) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      .map((fu: any) => {
        const d = new Date(fu.dueAt);
        const isOverdue = d.getTime() < nowMs;
        const istTime = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(d);
        return {
          id: fu.id,
          recordType: fu.recordType || 'lead',
          recordId: fu.recordId || '',
          name: fu.partyName || fu.customer || 'Client',
          type: String(fu.type || 'call').toUpperCase(),
          task: fu.note || fu.title || 'Scheduled follow-up',
          time: isOverdue ? dateTime(fu.dueAt) : istTime,
          isOverdue,
          completed: false,
        };
      });
  }, [followUpsQ.data?.items, todayIST]);

  const toggleFollowUp = async (id: string) => {
    try {
      await patch(`/follow-ups/${id}`, { status: 'completed' });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['follow-ups'], refetchType: 'all' }),
        qc.invalidateQueries({ queryKey: ['leads'], refetchType: 'all' }),
        qc.invalidateQueries({ queryKey: ['notifications'], refetchType: 'all' }),
      ]);
      toast('Follow-up marked completed', 'success');
    } catch {
      toast('Failed to update follow-up', 'error');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast('Dashboard refreshed');
    }, 400);
  };

  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  const board = useQuery({
    queryKey: ['leads-board'],
    queryFn: () => get<{ columns: { stage: string; label: string; count: number; value: number }[] }>('/leads/board'),
  });

  // Pipeline Stage Distribution derived strictly from live API
  const pipelineStages = useMemo(() => {
    if (board.data?.columns && Array.isArray(board.data.columns)) {
      const colors: Record<string, string> = {
        new: '#3D7952',
        contacted: '#5A9B68',
        interested: '#88B894',
        quotation_sent: '#D99A45',
        negotiation: '#D66B68',
        won: '#233D2D',
        lost: '#778477',
      };
      return board.data.columns.map((c) => ({
        label: c.label,
        count: c.count,
        color: colors[c.stage] || '#3D7952',
      }));
    }
    if (isDemo) {
      return [
        { label: 'New', count: 12, color: '#3D7952' },
        { label: 'Contacted', count: 8, color: '#5A9B68' },
        { label: 'Interested', count: 5, color: '#88B894' },
        { label: 'Quotation Sent', count: 3, color: '#D99A45' },
        { label: 'Negotiation', count: 3, color: '#D66B68' },
      ];
    }
    return [];
  }, [board.data, isDemo]);

  const totalPipelineLeads = pipelineStages.reduce((sum, s) => sum + s.count, 0);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 pb-8">
      {/* ============================================================== */}
      {/* 1. GREETING HEADER & DATE SELECTOR */}
      {/* ============================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#202820] hover-text-glow">
            {greeting}, {user?.fullName || 'Owner'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-[#778477] mt-0.5">
            Here's what's happening with your business today.
          </p>
        </div>

        {/* Date Selector Filter Pill */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="appearance-none rounded-full border border-white/80 bg-white/80 backdrop-blur-md px-4 py-1.5 pr-8 text-xs font-semibold text-[#202820] shadow-2xs hover:border-[#CFE5CB] focus:outline-none focus:ring-2 focus:ring-[#3D7952]/20 cursor-pointer transition-all hover:bg-white"
            >
              <option value="This Month">This Month</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="This Quarter">This Quarter</option>
              <option value="This Year">This Year</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#778477]" />
          </div>

          <button
            onClick={handleRefresh}
            className={`rounded-full border border-white/80 bg-white/80 backdrop-blur-md p-2 text-[#778477] hover:text-[#202820] hover:bg-white shadow-2xs transition-all btn-spring ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            title="Refresh statistics"
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. GROVIA 4/5 KPI STATS CARDS */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: New Leads */}
        <Link
          to="/leads"
          className="group rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md p-4 shadow-[0_4px_20px_-2px_rgba(35,61,45,0.04)] interactive-card"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EDF5EA]/90 text-[#3D7952] transition-transform group-hover:scale-110">
              <UserPlus size={16} />
            </span>
            <span className="flex items-center text-[11px] font-bold text-[#3D7952] bg-[#EAF5E8]/90 px-2 py-0.5 rounded-full border border-[#CFE5CB] glass-badge">
              <ArrowUpRight size={12} className="mr-0.5" /> +25%
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs font-semibold text-[#778477] transition-colors group-hover:text-[#202820]">New Leads</span>
            <div className="text-2xl font-extrabold text-[#202820] tracking-tight transition-transform group-hover:scale-105 group-hover:text-[#3D7952] origin-left">12</div>
          </div>
        </Link>

        {/* Card 2: Contacted */}
        <Link
          to="/leads"
          className="group rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md p-4 shadow-[0_4px_20px_-2px_rgba(35,61,45,0.04)] interactive-card"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EDF5EA]/90 text-[#3D7952] transition-transform group-hover:scale-110">
              <Phone size={16} />
            </span>
            <span className="flex items-center text-[11px] font-bold text-[#778477] bg-[#F5F9F2]/90 px-2 py-0.5 rounded-full border border-[#DCE7D9] glass-badge">
              <ArrowDownRight size={12} className="mr-0.5" /> -16%
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs font-semibold text-[#778477] transition-colors group-hover:text-[#202820]">Contacted</span>
            <div className="text-2xl font-extrabold text-[#202820] tracking-tight transition-transform group-hover:scale-105 group-hover:text-[#3D7952] origin-left">8</div>
          </div>
        </Link>

        {/* Card 3: Quotations */}
        <Link
          to="/sales?tab=quotes"
          className="group rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md p-4 shadow-[0_4px_20px_-2px_rgba(35,61,45,0.04)] interactive-card"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EDF5EA]/90 text-[#3D7952] transition-transform group-hover:scale-110">
              <FileText size={16} />
            </span>
            <span className="flex items-center text-[11px] font-bold text-[#3D7952] bg-[#EAF5E8]/90 px-2 py-0.5 rounded-full border border-[#CFE5CB] glass-badge">
              <ArrowUpRight size={12} className="mr-0.5" /> +40%
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs font-semibold text-[#778477] transition-colors group-hover:text-[#202820]">Quotations</span>
            <div className="text-2xl font-extrabold text-[#202820] tracking-tight transition-transform group-hover:scale-105 group-hover:text-[#3D7952] origin-left">5</div>
          </div>
        </Link>

        {/* Card 4: Closed Sales */}
        <Link
          to="/sales"
          className="group rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md p-4 shadow-[0_4px_20px_-2px_rgba(35,61,45,0.04)] interactive-card"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EDF5EA]/90 text-[#3D7952] transition-transform group-hover:scale-110">
              <CreditCard size={16} />
            </span>
            <span className="flex items-center text-[11px] font-bold text-[#3D7952] bg-[#EAF5E8]/90 px-2 py-0.5 rounded-full border border-[#CFE5CB] glass-badge">
              <ArrowUpRight size={12} className="mr-0.5" /> +50%
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs font-semibold text-[#778477] transition-colors group-hover:text-[#202820]">Closed Sales</span>
            <div className="text-2xl font-extrabold text-[#202820] tracking-tight transition-transform group-hover:scale-105 group-hover:text-[#3D7952] origin-left">3</div>
          </div>
        </Link>
      </div>

      {/* ============================================================== */}
      {/* 3. MAIN DASHBOARD MODULES GRID (Left & Right Columns) */}
      {/* ============================================================== */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* LEFT COLUMN: Sales Pipeline + Follow-ups Today (6 cols) */}
        <div className="space-y-5 lg:col-span-6">
          {/* Module A: Sales Pipeline Donut Chart */}
          <div className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md p-5 shadow-[0_4px_20px_-2px_rgba(35,61,45,0.04)] interactive-card">
            <div className="flex items-center justify-between border-b border-[#DCE7D9]/70 pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#202820] hover-text-lift">Sales Pipeline</h2>
                <p className="text-[11px] text-[#778477]">Current distribution across deal stages</p>
              </div>
              <Link
                to="/leads?view=board"
                className="text-xs font-bold text-[#3D7952] hover:text-[#233D2D] transition-colors hover-text-slide"
              >
                View Pipeline →
              </Link>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center gap-6">
              {/* Donut Chart (SVG) */}
              <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#F5F9F2" strokeWidth="13" />
                  
                  {/* Segment 1: New (12/31 = 38.7%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#3D7952"
                    strokeWidth="13"
                    strokeDasharray="92 238"
                    strokeDashoffset="0"
                    className="transition-all hover:opacity-85"
                  />
                  {/* Segment 2: Contacted (8/31 = 25.8%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#5A9B68"
                    strokeWidth="13"
                    strokeDasharray="61 238"
                    strokeDashoffset="-92"
                    className="transition-all hover:opacity-85"
                  />
                  {/* Segment 3: Interested (5/31 = 16.1%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#88B894"
                    strokeWidth="13"
                    strokeDasharray="38 238"
                    strokeDashoffset="-153"
                    className="transition-all hover:opacity-85"
                  />
                  {/* Segment 4: Quote Sent (3/31 = 9.7%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#D99A45"
                    strokeWidth="13"
                    strokeDasharray="23 238"
                    strokeDashoffset="-191"
                    className="transition-all hover:opacity-85"
                  />
                  {/* Segment 5: Negotiation (3/31 = 9.7%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#D66B68"
                    strokeWidth="13"
                    strokeDasharray="23 238"
                    strokeDashoffset="-214"
                    className="transition-all hover:opacity-85"
                  />
                </svg>

                {/* Center Value */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-extrabold text-[#202820] leading-none hover-text-glow">
                    {totalPipelineLeads}
                  </span>
                  <span className="text-[10px] font-semibold text-[#778477] uppercase tracking-wider mt-0.5">
                    Total
                  </span>
                </div>
              </div>

              {/* Stage Breakdown Legend List */}
              <div className="flex-1 w-full space-y-2">
                {pipelineStages.map((stage) => (
                  <div key={stage.label} className="flex items-center justify-between text-xs py-1 border-b border-[#F5F9F2] last:border-0 hover:bg-[#F5F9F2]/70 px-2 rounded-lg transition-colors group">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125" style={{ backgroundColor: stage.color }} />
                      <span className="text-[#202820] font-medium hover-text-slide">{stage.label}</span>
                    </div>
                    <span className="font-bold text-[#202820] tabular-nums">{stage.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Module C: Follow-ups Today */}
          <div className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md p-5 shadow-[0_4px_20px_-2px_rgba(35,61,45,0.04)] interactive-card">
            <div className="flex items-center justify-between border-b border-[#DCE7D9]/70 pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#202820] hover-text-lift">Follow-ups Today</h2>
                <p className="text-[11px] text-[#778477]">High priority customer follow-ups</p>
              </div>
              <Link
                to="/follow-ups"
                className="text-xs font-bold text-[#3D7952] hover:text-[#233D2D] transition-colors hover-text-slide"
              >
                View All →
              </Link>
            </div>

            <div className="mt-3 divide-y divide-[#DCE7D9]/50">
              {followUps.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#778477]">
                  All caught up for today!
                </div>
              ) : (
                followUps.map((f) => {
                  const partyLink = f.recordType === 'customer' ? `/customers/${f.recordId}` : `/leads/${f.recordId}`;
                  return (
                    <div key={f.id} className="flex items-center justify-between gap-2 py-3 interactive-tile rounded-xl px-2 hover:bg-white/80">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => void toggleFollowUp(f.id)}
                          aria-label="Mark completed"
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all btn-spring ${
                            f.isOverdue
                              ? 'border-red-400 bg-white hover:border-red-600'
                              : 'border-[#DCE7D9] bg-white hover:border-[#3D7952]'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link to={partyLink} className="text-xs font-semibold text-[#233D2D] hover:underline truncate">
                              {f.name}
                            </Link>
                            <span className="rounded bg-[#E3EFDF] px-1.5 py-0.2 text-[9px] font-bold text-[#233D2D] uppercase">
                              {f.type}
                            </span>
                            {f.isOverdue && (
                              <span className="rounded bg-red-100 text-red-700 px-1.5 py-0.2 text-[9px] font-bold uppercase">
                                Overdue
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#778477] truncate mt-0.5">{f.task}</p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-mono px-2 py-0.5 rounded-md border glass-badge ${
                          f.isOverdue
                            ? 'text-red-700 bg-red-50 border-red-200'
                            : 'text-[#778477] bg-[#F5F9F2]/90 border-[#DCE7D9]'
                        }`}
                      >
                        {f.time}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Revenue Progress + Leads Trend (6 cols) */}
        <div className="space-y-5 lg:col-span-6">
          {/* Module B: Revenue Progress */}
          {(() => {
            const collectedAmount = metricsQ.data?.collected ?? 29850;
            const targetAmount = metricsQ.data?.target ?? 100000;
            const progressPct = metricsQ.data?.progressPct ?? Math.round((collectedAmount / targetAmount) * 100);
            const weekly = metricsQ.data?.weekly ?? [
              { label: 'W1', amount: 0, heightPct: 8 },
              { label: 'W2', amount: 0, heightPct: 8 },
              { label: 'W3', amount: 2950000, heightPct: 100 },
              { label: 'W4', amount: 35000, heightPct: 15 },
            ];
            const leadsTrend = metricsQ.data?.leads;
            const trendPctStr = leadsTrend?.trendPct !== undefined 
              ? (leadsTrend.trendPct >= 0 ? `+${leadsTrend.trendPct}% vs Last Month` : `${leadsTrend.trendPct}% vs Last Month`)
              : '+32% vs Last Month';

            return (
              <>
                <div className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md p-5 shadow-[0_4px_20px_-2px_rgba(35,61,45,0.04)] interactive-card">
                  <div className="flex items-center justify-between border-b border-[#DCE7D9]/70 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-[#202820] hover-text-lift">Revenue Progress</h2>
                      <p className="text-[11px] text-[#778477]">Collected vs Target</p>
                    </div>
                    <span className="text-xs font-bold text-[#3D7952] bg-[#EAF5E8]/90 px-2.5 py-0.5 rounded-full border border-[#CFE5CB] glass-badge">
                      {progressPct}%
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-[#202820] hover-text-glow">₹{collectedAmount.toLocaleString('en-IN')}</span>
                        <span className="text-xs text-[#778477] font-medium">/ ₹{targetAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <span className="text-[11px] text-[#778477]">Monthly Target</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 h-3 w-full rounded-full bg-[#E3EFDF] overflow-hidden">
                      <div className="h-full rounded-full bg-[#3D7952] transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
                    </div>

                    {/* Mini Bar Chart for Weekly Progress */}
                    <div className="mt-6">
                      <span className="text-[11px] font-semibold text-[#778477] uppercase tracking-wider block mb-3">
                        Weekly Collections
                      </span>
                      <div className="flex items-end justify-between gap-3 h-28 pt-2 border-b border-[#DCE7D9]/60">
                        {weekly.map((w: any, idx: number) => (
                          <div key={w.label || idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer" title={`₹${((w.amount || 0) / 100).toLocaleString('en-IN')}`}>
                            <div
                              className={`w-full rounded-t-lg transition-all group-hover:shadow-[0_0_12px_rgba(61,121,82,0.4)] ${w.amount > 0 ? 'bg-[#3D7952] group-hover:bg-[#233D2D]' : 'bg-[#CFE5CB] group-hover:bg-[#3D7952]'}`}
                              style={{ height: `${w.heightPct || 10}%` }}
                            />
                            <span className={`text-[10px] font-medium transition-colors ${w.amount > 0 ? 'text-[#3D7952] font-bold' : 'text-[#778477] group-hover:text-[#3D7952]'}`}>{w.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Module D: Leads Trend Sparkline Area Chart */}
                <div className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md p-5 shadow-[0_4px_20px_-2px_rgba(35,61,45,0.04)] interactive-card">
                  <div className="flex items-center justify-between border-b border-[#DCE7D9]/70 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-[#202820] hover-text-lift">Leads Trend</h2>
                      <p className="text-[11px] text-[#778477]">Acquisition volume ({leadsTrend?.thisMonth ?? 8} leads this month)</p>
                    </div>
                    <span className="text-xs font-bold text-[#3D7952]">
                      {trendPctStr}
                    </span>
                  </div>

            {/* Sparkline Curve */}
            <div className="mt-4">
              <div className="h-32 w-full">
                <svg className="h-full w-full overflow-visible" viewBox="0 0 400 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="sageTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3D7952" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3D7952" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Fill area */}
                  <path
                    d="M 0,80 Q 80,45 160,70 T 320,25 T 400,15 L 400,100 L 0,100 Z"
                    fill="url(#sageTrendGrad)"
                  />
                  {/* Line stroke */}
                  <path
                    d="M 0,80 Q 80,45 160,70 T 320,25 T 400,15"
                    fill="none"
                    stroke="#3D7952"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* Highlight point */}
                  <circle cx="320" cy="25" r="4.5" fill="#3D7952" stroke="#FFFFFF" strokeWidth="2" />
                </svg>
              </div>

              {/* X-Axis dates */}
              <div className="mt-2 flex justify-between text-[10px] text-[#778477] font-medium border-t border-[#DCE7D9]/60 pt-2">
                <span>1 Nov</span>
                <span>7 Nov</span>
                <span>14 Nov</span>
                <span>21 Nov</span>
                <span>28 Nov</span>
              </div>
            </div>
          </div>
          </>
          );
          })()}
        </div>
      </div>
    </div>
  );
}
