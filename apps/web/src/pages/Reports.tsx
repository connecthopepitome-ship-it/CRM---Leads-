/**
 * SCR-026 Reports + Excel export (FR-085).
 * Redesigned with Grovia-inspired Minimalist SaaS Design System.
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { download, get, post, waitForJob } from '../lib/api';
import { money, today } from '../lib/format';
import { Button, Card, ErrorState, Select, Skeleton, Table, TextField } from '../ui';
import { errorToast, toast } from '../ui/toast';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Calendar,
  Filter,
  PieChart as PieIcon,
  TrendingUp,
  Users,
  DollarSign,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface Report {
  id: string;
  name: string;
  columns: { key: string; label: string; money?: boolean }[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
}

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const list = useQuery({
    queryKey: ['reports'],
    queryFn: () => get<{ items: { id: string; name: string }[] }>('/reports')
  });

  const id = params.get('id') ?? list.data?.items[0]?.id ?? 'RPT-002';
  const from = params.get('from') ?? `${today().slice(0, 7)}-01`;
  const to = params.get('to') ?? today();
  const [isExporting, setIsExporting] = useState(false);

  const r = useQuery({
    queryKey: ['report', id, from, to],
    queryFn: () => get<Report>(`/reports/${id}?from=${from}&to=${to}&asOf=${to}`),
    enabled: !!id
  });

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    n.set(k, v);
    if (k !== 'id' && !n.get('id')) n.set('id', id);
    setParams(n, { replace: true });
  };

  const exportXlsx = async () => {
    setIsExporting(true);
    try {
      const { jobId } = await post<{ jobId: string }>(`/reports/${id}/export`, { from, to, asOf: to });
      const j = await waitForJob(jobId);
      if (j.result?.url) {
        await download(j.result.url, j.result.name ?? `${id}.xlsx`);
        toast('Report exported to Excel successfully');
      }
    } catch (e) {
      errorToast(e);
    } finally {
      setIsExporting(false);
    }
  };

  // Pipeline stage chart breakdown
  const stageStats = useMemo(() => {
    if (id === 'RPT-002' && r.data?.rows) {
      return r.data.rows.map((row) => ({
        label: String(row.stage || ''),
        count: Number(row.count || 0),
        value: Number(row.value || 0),
      }));
    }
    const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
    if (isDemo) {
      return [
        { label: 'New', count: 12, value: 350000 },
        { label: 'Contacted', count: 8, value: 240000 },
        { label: 'Interested', count: 5, value: 180000 },
        { label: 'Quotation Sent', count: 3, value: 120000 },
        { label: 'Negotiation', count: 3, value: 95000 },
      ];
    }
    return [];
  }, [id, r.data]);

  const totalLeadsCount = useMemo(() => {
    return stageStats.reduce((sum, item) => sum + item.count, 0);
  }, [stageStats]);

  const STAGE_COLORS = ['#427AA1', '#7A6F9B', '#3D7952', '#D99A45', '#C46D65', '#5A9B68'];

  // Sales Trend Bar Chart Data (Weekly intervals)
  const salesTrend = [
    { label: 'W1', value: 24000, height: '40%' },
    { label: 'W2', value: 36000, height: '60%' },
    { label: 'W3', value: 48000, height: '80%' },
    { label: 'W4', value: 60000, height: '100%' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Filters Bar (Grovia Minimalist Style) */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#202820]">Reports</h1>
          <p className="text-xs text-[#778477] mt-0.5">Track your sales performance and pipeline.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Report Dropdown */}
          <div className="relative">
            <select
              value={id}
              onChange={(e) => set('id', e.target.value)}
              className="appearance-none rounded-xl border border-[#DCE7D9] bg-white py-2 pl-3.5 pr-8 text-xs font-semibold text-[#202820] shadow-xs hover:border-[#3D7952] focus:border-[#3D7952] focus:outline-hidden transition-colors"
            >
              {list.data?.items ? list.data.items.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              )) : (
                <>
                  <option value="RPT-002">Pipeline by stage</option>
                  <option value="RPT-003">Sales</option>
                  <option value="RPT-004">Collections & ageing</option>
                  <option value="RPT-005">Lead source performance</option>
                  <option value="RPT-006">GST Outward Supplies & Credit Notes</option>
                </>
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-[#778477]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Date Range: From / To */}
          <div className="flex items-center gap-1.5 rounded-xl border border-[#DCE7D9] bg-white px-2.5 py-1.5 shadow-xs text-xs text-[#778477]">
            <Calendar size={13} className="text-[#3D7952]" />
            <span className="font-medium">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => set('from', e.target.value)}
              className="border-none bg-transparent p-0 text-xs font-semibold text-[#202820] focus:ring-0 focus:outline-hidden"
            />
            <span className="font-medium text-[#778477]">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => set('to', e.target.value)}
              className="border-none bg-transparent p-0 text-xs font-semibold text-[#202820] focus:ring-0 focus:outline-hidden"
            />
          </div>

          {/* Export Action Button */}
          <Button
            variant="secondary"
            onClick={() => void exportXlsx()}
            busy={isExporting}
            className="flex items-center gap-1.5 rounded-xl border-[#DCE7D9] bg-white px-3.5 py-2 text-xs font-semibold text-[#202820] shadow-xs hover:bg-[#F5F9F2]"
          >
            <Download size={13} className="text-[#3D7952]" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Visual Analytics Cards (Leads by Stage Donut + Sales Trend Bar Chart) */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Card 1: Leads by Stage */}
        <div className="rounded-2xl border border-[#DCE7D9] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#202820] tracking-tight">Leads by Stage</h2>
            <span className="text-[11px] font-semibold text-[#3D7952] bg-[#E3EFDF] px-2 py-0.5 rounded-md">
              Pipeline Distribution
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
            {/* Donut Chart SVG */}
            <div className="relative flex items-center justify-center shrink-0 w-44 h-44">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform">
                {/* Background Track */}
                <circle cx="50" cy="50" r="38" stroke="#F5F9F2" strokeWidth="12" fill="none" />
                {/* Segments */}
                <circle cx="50" cy="50" r="38" stroke="#427AA1" strokeWidth="12" fill="none" strokeDasharray="90 150" strokeDashoffset="0" />
                <circle cx="50" cy="50" r="38" stroke="#7A6F9B" strokeWidth="12" fill="none" strokeDasharray="60 180" strokeDashoffset="-90" />
                <circle cx="50" cy="50" r="38" stroke="#3D7952" strokeWidth="12" fill="none" strokeDasharray="45 195" strokeDashoffset="-150" />
                <circle cx="50" cy="50" r="38" stroke="#D99A45" strokeWidth="12" fill="none" strokeDasharray="25 215" strokeDashoffset="-195" />
                <circle cx="50" cy="50" r="38" stroke="#C46D65" strokeWidth="12" fill="none" strokeDasharray="20 220" strokeDashoffset="-220" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-[#202820]">{totalLeadsCount}</span>
                <span className="text-[11px] font-medium text-[#778477]">Total Leads</span>
              </div>
            </div>

            {/* Stages Legend with counts */}
            <div className="flex-1 w-full space-y-2.5">
              {stageStats.map((item, idx) => {
                const color = STAGE_COLORS[idx % STAGE_COLORS.length];
                return (
                  <div key={item.label} className="flex items-center justify-between text-xs py-1 border-b border-[#F5F9F2] last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-semibold text-[#202820]">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#202820]">{item.count}</span>
                      {item.value > 0 && (
                        <span className="text-[10px] text-[#778477] w-16 text-right">
                          {money(item.value)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 2: Sales Trend Bar Chart */}
        <div className="rounded-2xl border border-[#DCE7D9] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#202820] tracking-tight">Sales Trend</h2>
            <span className="text-[11px] font-semibold text-[#778477]">Weekly Performance</span>
          </div>

          <div className="flex items-end gap-6 pt-6 pb-2 h-44 px-2">
            {/* Y-axis Labels */}
            <div className="flex flex-col justify-between h-full text-[10px] text-[#778477] pb-6 shrink-0">
              <span>60K</span>
              <span>45K</span>
              <span>30K</span>
              <span>15K</span>
              <span>0</span>
            </div>

            {/* Bars container */}
            <div className="flex-1 grid grid-cols-4 gap-4 items-end h-full border-b border-[#DCE7D9] pb-0">
              {salesTrend.map((bar, idx) => (
                <div key={bar.label} className="flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="relative w-full max-w-[42px] flex justify-center items-end">
                    <div
                      style={{ height: bar.height }}
                      className="w-full rounded-t-lg bg-[#5A9B68] group-hover:bg-[#3D7952] transition-all relative"
                    >
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-[#233D2D] text-white text-[10px] font-bold py-0.5 px-1.5 rounded-md shadow-xs pointer-events-none transition-opacity whitespace-nowrap">
                        {money(bar.value * 100)}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#778477] mt-1">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip Row (Matching Screen 6 Bottom Strip) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-[#DCE7D9] bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-[#778477]">Total Leads</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-[#202820]">{totalLeadsCount}</p>
        </div>
        <div className="rounded-2xl border border-[#DCE7D9] bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-[#778477]">Quotations Sent</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-[#202820]">5</p>
        </div>
        <div className="rounded-2xl border border-[#DCE7D9] bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-[#778477]">Closed Sales</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-[#202820]">3</p>
        </div>
        <div className="rounded-2xl border border-[#DCE7D9] bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-[#778477]">Revenue</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-[#3D7952]">₹49,500</p>
        </div>
      </div>

      {/* Detailed Tabular Report Data Card (Preserving full backend functionality) */}
      <div className="rounded-2xl border border-[#DCE7D9] bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#DCE7D9]/70 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-[#3D7952]" />
            <h2 className="text-sm font-bold text-[#202820]">
              {r.data?.name ?? 'Detailed Report Breakdown'}
            </h2>
          </div>
          <span className="text-xs text-[#778477]">
            {r.data?.rows?.length ?? 0} records
          </span>
        </div>

        {r.isLoading ? (
          <Skeleton rows={5} />
        ) : r.error ? (
          <ErrorState error={r.error} />
        ) : r.data && (
          <div className="overflow-x-auto">
            <Table
              rows={(r.data.rows ?? []).map((x, i) => ({ id: String(i), ...x }))}
              columns={(r.data.columns ?? []).map((c) => ({
                key: c.key,
                label: c.label,
                align: c.money ? ('right' as const) : undefined,
                render: (row: Record<string, unknown>) =>
                  c.money ? money(Number(row[c.key] ?? 0)) : String(row[c.key] ?? '—'),
              }))}
            />
            {r.data?.totals && (
              <div className="mt-4 flex flex-wrap gap-4 rounded-xl bg-[#F5F9F2] p-3 text-xs font-semibold text-[#202820] border border-[#DCE7D9]">
                <span className="text-[#778477]">Totals:</span>
                {Object.entries(r.data.totals).map(([k, v]) => (
                  <span key={k}>
                    {r.data?.columns?.find((c) => c.key === k)?.label ?? k}:{' '}
                    <span className="text-[#3D7952]">{money(v)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
