import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money } from '../lib/format';
import { toast } from '../ui';

interface FollowUpItem {
  id: string;
  name: string;
  task: string;
  dueText: string;
  dueTone: 'amber' | 'indigo' | 'slate';
  completed: boolean;
}

interface QuotationItem {
  id: string;
  number: string;
  partyName: string;
  amount: number;
  status: 'Sent' | 'Accepted' | 'Draft' | 'Expired';
  validUntil: string;
}

export default function Home() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [timeFilter, setTimeFilter] = useState('This Month');
  const [trendMetric, setTrendMetric] = useState<'revenue' | 'leads'>('revenue');
  const [activeDonutSlice, setActiveDonutSlice] = useState<number | null>(null);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(3); // Default hover on 10 Nov peak
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Follow-ups state with interactive checkboxes
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([
    {
      id: 'fu-1',
      name: 'Fatima Khan',
      task: 'Quote follow-up',
      dueText: 'Due in 2 days',
      dueTone: 'amber',
      completed: false,
    },
    {
      id: 'fu-2',
      name: 'Mohan Das',
      task: 'Requirement confirmation',
      dueText: 'Due in 2 days',
      dueTone: 'amber',
      completed: false,
    },
    {
      id: 'fu-3',
      name: 'Deepa Reddy',
      task: 'Proposal discussion',
      dueText: 'In 3 days',
      dueTone: 'indigo',
      completed: false,
    },
  ]);

  // Recent quotations data matching reference image
  const quotations: QuotationItem[] = [
    {
      id: 'qt-1',
      number: 'QT/26-27/0004',
      partyName: 'Fatima Khan',
      amount: 29500,
      status: 'Sent',
      validUntil: '28 Nov 2026',
    },
    {
      id: 'qt-2',
      number: 'QT/26-27/0003',
      partyName: 'Iyer Consultancy',
      amount: 29500,
      status: 'Accepted',
      validUntil: '20 Nov 2026',
    },
    {
      id: 'qt-3',
      number: 'QT/26-27/0002',
      partyName: 'Nair Foods',
      amount: 59000,
      status: 'Accepted',
      validUntil: '15 Nov 2026',
    },
  ];

  // Pipeline stages data
  const pipelineStages = [
    { name: 'New', count: 3, color: '#3b82f6', percent: 25 },
    { name: 'Contacted', count: 2, color: '#8b5cf6', percent: 17 },
    { name: 'Interested', count: 2, color: '#10b981', percent: 17 },
    { name: 'Quotation Sent', count: 1, color: '#f59e0b', percent: 8 },
    { name: 'Negotiation', count: 1, color: '#f43f5e', percent: 8 },
  ];
  const totalPipelineCount = 12;

  // Trend Chart Data
  const trendPoints =
    trendMetric === 'revenue'
      ? [
          { date: '01 Nov', value: 20000, label: '₹20,000' },
          { date: '04 Nov', value: 24000, label: '₹24,000' },
          { date: '07 Nov', value: 28000, label: '₹28,000' },
          { date: '10 Nov', value: 42500, label: '₹42,500' },
          { date: '14 Nov', value: 36000, label: '₹36,000' },
        ]
      : [
          { date: '01 Nov', value: 1, label: '1 Lead' },
          { date: '04 Nov', value: 2, label: '2 Leads' },
          { date: '07 Nov', value: 1, label: '1 Lead' },
          { date: '10 Nov', value: 3, label: '3 Leads' },
          { date: '14 Nov', value: 2, label: '2 Leads' },
        ];

  // API query (if backend is active)
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', timeFilter],
    queryFn: () => get<{ tiles: unknown[] }>('/dashboard').catch(() => null),
    refetchInterval: 60_000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await dashboardQuery.refetch().catch(() => undefined);
    setTimeout(() => {
      setIsRefreshing(false);
      toast('Dashboard updated');
    }, 400);
  };

  const toggleFollowUp = (id: string) => {
    setFollowUps((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = !item.completed;
          toast(next ? `Completed follow-up for ${item.name}` : `Reopened follow-up for ${item.name}`);
          return { ...item, completed: next };
        }
        return item;
      })
    );
  };

  // Determine dynamic greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.fullName?.split(' ')[0] || 'Owner';

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* ============================================================== */}
      {/* HEADER / GREETING BAR */}
      {/* ============================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>
              {greeting}, {firstName}
            </span>
            <span role="img" aria-label="waving hand">
              👏
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Here's what's happening with your business today.
          </p>
        </div>

        {/* Filters & Refresh */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="appearance-none bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="This Quarter">This Quarter</option>
              <option value="This Year">This Year</option>
            </select>
            <ChevronDown
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          <button
            onClick={handleRefresh}
            className={`flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 transition-colors ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            title="Refresh dashboard"
            aria-label="Refresh dashboard"
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. TOP 4 METRIC STAT CARDS WITH WAVE SPARKLINES */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: New Leads */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <User size={18} strokeWidth={2.2} />
            </div>
            <div className="flex-1 ml-3">
              <span className="text-xs font-medium text-slate-500">New Leads</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900">3</span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                  ▲ +50%
                </span>
              </div>
            </div>
          </div>
          {/* Subtle Blue Wavy Sparkline */}
          <div className="mt-3 -mx-4 -mb-4 h-11 overflow-hidden opacity-85">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="blueWave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,30 Q30,10 70,25 T140,15 T200,20 L200,40 L0,40 Z"
                fill="url(#blueWave)"
              />
              <path
                d="M0,30 Q30,10 70,25 T140,15 T200,20"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.2"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Follow-ups */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Phone size={18} strokeWidth={2.2} />
            </div>
            <div className="flex-1 ml-3">
              <span className="text-xs font-medium text-slate-500">Follow-ups</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900">0</span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-600">
                  On track
                </span>
              </div>
            </div>
          </div>
          {/* Subtle Purple Wavy Sparkline */}
          <div className="mt-3 -mx-4 -mb-4 h-11 overflow-hidden opacity-85">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="purpleWave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,25 Q40,35 90,15 T160,25 T200,10 L200,40 L0,40 Z"
                fill="url(#purpleWave)"
              />
              <path
                d="M0,25 Q40,35 90,15 T160,25 T200,10"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="2.2"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Quotes Sent */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileText size={18} strokeWidth={2.2} />
            </div>
            <div className="flex-1 ml-3">
              <span className="text-xs font-medium text-slate-500">Quotes Sent</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900">1</span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                  ▲ +100%
                </span>
              </div>
            </div>
          </div>
          {/* Subtle Emerald Wavy Sparkline */}
          <div className="mt-3 -mx-4 -mb-4 h-11 overflow-hidden opacity-85">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="greenWave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,28 Q50,12 100,24 T170,10 T200,15 L200,40 L0,40 Z"
                fill="url(#greenWave)"
              />
              <path
                d="M0,28 Q50,12 100,24 T170,10 T200,15"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.2"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Collected */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Wallet size={18} strokeWidth={2.2} />
            </div>
            <div className="flex-1 ml-3">
              <span className="text-xs font-medium text-slate-500">Collected</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900">₹49,500</span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                  ▲ +32%
                </span>
              </div>
            </div>
          </div>
          {/* Subtle Amber Wavy Sparkline */}
          <div className="mt-3 -mx-4 -mb-4 h-11 overflow-hidden opacity-85">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="amberWave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,32 Q40,18 90,26 T160,12 T200,18 L200,40 L0,40 Z"
                fill="url(#amberWave)"
              />
              <path
                d="M0,32 Q40,18 90,26 T160,12 T200,18"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.2"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SECOND ROW: SALES PIPELINE (DONUT) & REVENUE TREND (AREA) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Sales Pipeline Donut Chart (5 cols) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm lg:col-span-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Sales Pipeline</h2>
              <span title="Breakdown of leads by current active stage" className="text-slate-400 hover:text-slate-600 cursor-help">
                <Info size={13} />
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-auto py-2">
            {/* SVG Donut Chart with Center Total */}
            <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {/* SVG Segments calculated for 100 circumference: r=15.9155 */}
                {/* 1. New: 3 (25%) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#3b82f6"
                  strokeWidth="14"
                  strokeDasharray="25 75"
                  strokeDashoffset="0"
                  className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                  onMouseEnter={() => setActiveDonutSlice(0)}
                  onMouseLeave={() => setActiveDonutSlice(null)}
                />
                {/* 2. Contacted: 2 (16.6%) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#8b5cf6"
                  strokeWidth="14"
                  strokeDasharray="16.6 83.4"
                  strokeDashoffset="-25"
                  className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                  onMouseEnter={() => setActiveDonutSlice(1)}
                  onMouseLeave={() => setActiveDonutSlice(null)}
                />
                {/* 3. Interested: 2 (16.6%) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="14"
                  strokeDasharray="16.6 83.4"
                  strokeDashoffset="-41.6"
                  className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                  onMouseEnter={() => setActiveDonutSlice(2)}
                  onMouseLeave={() => setActiveDonutSlice(null)}
                />
                {/* 4. Quotation Sent: 1 (8.3%) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="14"
                  strokeDasharray="8.3 91.7"
                  strokeDashoffset="-58.2"
                  className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                  onMouseEnter={() => setActiveDonutSlice(3)}
                  onMouseLeave={() => setActiveDonutSlice(null)}
                />
                {/* 5. Negotiation: 1 (8.3%) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#f43f5e"
                  strokeWidth="14"
                  strokeDasharray="8.3 91.7"
                  strokeDashoffset="-66.5"
                  className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                  onMouseEnter={() => setActiveDonutSlice(4)}
                  onMouseLeave={() => setActiveDonutSlice(null)}
                />
              </svg>

              {/* Center Donut Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-bold tracking-tight text-slate-900 leading-none">
                  {totalPipelineCount}
                </span>
                <span className="text-[11px] font-medium text-slate-400 mt-0.5">Total</span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-2 w-full max-w-[160px]">
              {pipelineStages.map((stage, idx) => {
                const isHovered = activeDonutSlice === idx;
                return (
                  <div
                    key={stage.name}
                    onMouseEnter={() => setActiveDonutSlice(idx)}
                    onMouseLeave={() => setActiveDonutSlice(null)}
                    className={`flex items-center justify-between text-xs py-0.5 px-1.5 rounded-lg transition-colors cursor-pointer ${
                      isHovered ? 'bg-slate-50 font-semibold' : 'text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="text-slate-700 truncate">{stage.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900 ml-2">{stage.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Revenue Trend Interactive Area Chart (7 cols) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm lg:col-span-7 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Revenue Trend</h2>

            {/* Pill Toggle Switch: Revenue / Leads */}
            <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTrendMetric('revenue')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  trendMetric === 'revenue'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Revenue
              </button>
              <button
                type="button"
                onClick={() => setTrendMetric('leads')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  trendMetric === 'leads'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Leads
              </button>
            </div>
          </div>

          {/* Area Chart Container */}
          <div className="relative pt-6 pb-2">
            {/* Interactive Peak Tooltip */}
            {hoveredTrendIndex !== null && (
              <div
                className="absolute z-10 -top-1 pointer-events-none -translate-x-1/2 transition-all duration-150"
                style={{
                  left: `${15 + (hoveredTrendIndex * (70 / (trendPoints.length - 1)))}%`,
                }}
              >
                <div className="rounded-xl border border-slate-200 bg-white/95 px-2.5 py-1 text-center shadow-md backdrop-blur-sm">
                  <div className="text-[10px] font-semibold text-slate-400">
                    {trendPoints[hoveredTrendIndex]?.date}
                  </div>
                  <div className="text-xs font-bold text-indigo-600">
                    {trendPoints[hoveredTrendIndex]?.label}
                  </div>
                </div>
              </div>
            )}

            {/* SVG Chart */}
            <div className="h-44 w-full">
              <svg viewBox="0 0 500 160" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Horizontal Grid Lines */}
                <line x1="45" y1="20" x2="490" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="45" y1="55" x2="490" y2="55" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="45" y1="90" x2="490" y2="90" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="45" y1="125" x2="490" y2="125" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="45" y1="150" x2="490" y2="150" stroke="#e2e8f0" strokeWidth="1" />

                {/* Y-Axis Labels */}
                <text x="35" y="24" fill="#94a3b8" fontSize="10" textAnchor="end">
                  {trendMetric === 'revenue' ? '60K' : '4'}
                </text>
                <text x="35" y="59" fill="#94a3b8" fontSize="10" textAnchor="end">
                  {trendMetric === 'revenue' ? '45K' : '3'}
                </text>
                <text x="35" y="94" fill="#94a3b8" fontSize="10" textAnchor="end">
                  {trendMetric === 'revenue' ? '30K' : '2'}
                </text>
                <text x="35" y="129" fill="#94a3b8" fontSize="10" textAnchor="end">
                  {trendMetric === 'revenue' ? '15K' : '1'}
                </text>
                <text x="35" y="153" fill="#94a3b8" fontSize="10" textAnchor="end">
                  0
                </text>

                {/* Area Gradient Fill */}
                <path
                  d="M 60,110 Q 120,95 180,85 T 300,75 T 400,35 T 480,55 L 480,150 L 60,150 Z"
                  fill="url(#trendGradient)"
                />

                {/* Smooth Bezier Line */}
                <path
                  d="M 60,110 Q 120,95 180,85 T 300,75 T 400,35 T 480,55"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />

                {/* Interactive Points */}
                {[
                  { cx: 60, cy: 110, i: 0 },
                  { cx: 165, cy: 90, i: 1 },
                  { cx: 270, cy: 78, i: 2 },
                  { cx: 375, cy: 35, i: 3 }, // 10 Nov Peak
                  { cx: 480, cy: 55, i: 4 },
                ].map((pt) => {
                  const isHovered = hoveredTrendIndex === pt.i;
                  return (
                    <g key={pt.i}>
                      <circle
                        cx={pt.cx}
                        cy={pt.cy}
                        r={isHovered ? 6 : 4}
                        fill={isHovered ? '#8b5cf6' : '#ffffff'}
                        stroke="#8b5cf6"
                        strokeWidth={isHovered ? 3 : 2}
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() => setHoveredTrendIndex(pt.i)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* X-Axis Dates */}
            <div className="flex justify-between pl-12 pr-2 text-[10px] font-medium text-slate-400 mt-1">
              {trendPoints.map((p, idx) => (
                <span
                  key={p.date}
                  className={`cursor-pointer transition-colors ${
                    hoveredTrendIndex === idx ? 'text-indigo-600 font-bold' : ''
                  }`}
                  onMouseEnter={() => setHoveredTrendIndex(idx)}
                >
                  {p.date}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. THIRD ROW: RECENT QUOTATIONS TABLE & FOLLOW-UPS DUE */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Recent Quotations (7 cols) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm lg:col-span-7 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Recent Quotations</h2>
            <Link
              to="/sales?tab=quotes"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              View All
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-2.5 font-semibold">Number</th>
                  <th className="pb-2.5 font-semibold">For</th>
                  <th className="pb-2.5 font-semibold">Amount</th>
                  <th className="pb-2.5 font-semibold">Status</th>
                  <th className="pb-2.5 font-semibold">Valid Until</th>
                  <th className="pb-2.5 font-semibold text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {quotations.map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => nav(`/sales/quotes/${q.id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 font-semibold text-indigo-600 group-hover:underline">
                      {q.number}
                    </td>
                    <td className="py-3 font-medium text-slate-800">{q.partyName}</td>
                    <td className="py-3 font-bold text-slate-900">₹{q.amount.toLocaleString()}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          q.status === 'Sent'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500">{q.validUntil}</td>
                    <td className="py-3 text-right text-slate-400 group-hover:text-slate-600">
                      <MoreHorizontal size={14} className="ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Follow-ups Due (3) (5 cols) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm lg:col-span-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Follow-ups Due ({followUps.filter((f) => !f.completed).length})
            </h2>
            <Link
              to="/follow-ups"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              View All
            </Link>
          </div>

          <div className="space-y-2.5 my-auto">
            {followUps.map((fu) => (
              <div
                key={fu.id}
                onClick={() => toggleFollowUp(fu.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  fu.completed
                    ? 'bg-slate-50/70 border-slate-100 opacity-60'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFollowUp(fu.id);
                    }}
                    className={`h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                      fu.completed
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 bg-white hover:border-indigo-500'
                    }`}
                  >
                    {fu.completed && <Check size={12} strokeWidth={3} />}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold truncate ${
                        fu.completed ? 'line-through text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      {fu.name} <span className="font-normal text-slate-500">— {fu.task}</span>
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                    fu.completed
                      ? 'bg-slate-100 text-slate-400'
                      : fu.dueTone === 'amber'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  {fu.completed ? 'Done' : fu.dueText}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. FOURTH ROW: LEADS BY STAGE & QUICK ACTIONS */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Leads by Stage Progress Bars (6 cols) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm lg:col-span-6 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Leads by Stage</h2>
          </div>

          <div className="space-y-3 my-auto">
            {[
              { label: 'New', count: 3, width: '75%', color: 'from-cyan-400 to-blue-500' },
              { label: 'Contacted', count: 2, width: '50%', color: 'from-blue-500 to-indigo-600' },
              { label: 'Interested', count: 2, width: '50%', color: 'from-indigo-500 to-emerald-500' },
              { label: 'Quotation Sent', count: 1, width: '25%', color: 'from-amber-400 to-orange-500' },
              { label: 'Negotiation', count: 1, width: '25%', color: 'from-rose-400 to-pink-500' },
            ].map((st) => (
              <div key={st.label} className="flex items-center gap-4 text-xs">
                <span className="w-28 text-slate-600 font-medium truncate">{st.label}</span>
                <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${st.color} transition-all duration-500`}
                    style={{ width: st.width }}
                  />
                </div>
                <span className="w-4 font-bold text-slate-800 text-right">{st.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions (6 cols) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm lg:col-span-6 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Quick Actions</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 my-auto">
            {/* 1. New Lead */}
            <button
              onClick={() => nav('/leads/new')}
              className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-indigo-50/60 hover:border-indigo-200 hover:text-indigo-600 transition-all group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform mb-2">
                <UserPlus size={18} />
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 text-center">
                New Lead
              </span>
            </button>

            {/* 2. New Quotation */}
            <button
              onClick={() => nav('/sales/quotes/new')}
              className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-indigo-50/60 hover:border-indigo-200 hover:text-indigo-600 transition-all group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-2xs group-hover:scale-105 transition-transform mb-2">
                <FileText size={18} />
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 text-center">
                New Quotation
              </span>
            </button>

            {/* 3. Record Payment */}
            <button
              onClick={() => nav('/sales/payments/new')}
              className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-indigo-50/60 hover:border-indigo-200 hover:text-indigo-600 transition-all group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-600 shadow-2xs group-hover:scale-105 transition-transform mb-2">
                <CreditCard size={18} />
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 text-center">
                Record Payment
              </span>
            </button>

            {/* 4. New Customer */}
            <button
              onClick={() => nav('/customers/new')}
              className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-indigo-50/60 hover:border-indigo-200 hover:text-indigo-600 transition-all group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-2xs group-hover:scale-105 transition-transform mb-2">
                <Users size={18} />
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 text-center">
                New Customer
              </span>
            </button>

            {/* 5. View Reports */}
            <button
              onClick={() => nav('/reports')}
              className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-indigo-50/60 hover:border-indigo-200 hover:text-indigo-600 transition-all group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-purple-600 shadow-2xs group-hover:scale-105 transition-transform mb-2">
                <BarChart3 size={18} />
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 text-center">
                View Reports
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
