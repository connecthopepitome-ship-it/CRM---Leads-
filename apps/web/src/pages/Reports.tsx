/** SCR-026 Reports + Excel export (FR-085). */
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { download, get, post, waitForJob } from '../lib/api';
import { money, today } from '../lib/format';
import { Button, Card, ErrorState, PageHeader, Select, Skeleton, Table, TextField } from '../ui';
import { errorToast } from '../ui/toast';

interface Report {
  id: string;
  name: string;
  columns: { key: string; label: string; money?: boolean }[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
}

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const list = useQuery({ queryKey: ['reports'], queryFn: () => get<{ items: { id: string; name: string }[] }>('/reports') });
  const id = params.get('id') ?? list.data?.items[0]?.id ?? '';
  const from = params.get('from') ?? `${today().slice(0, 7)}-01`;
  const to = params.get('to') ?? today();
  const r = useQuery({ queryKey: ['report', id, from, to], queryFn: () => get<Report>(`/reports/${id}?from=${from}&to=${to}&asOf=${to}`), enabled: !!id });
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    n.set(k, v);
    if (k !== 'id' && !n.get('id')) n.set('id', id);
    setParams(n, { replace: true });
  };
  const exportXlsx = async () => {
    try {
      const { jobId } = await post<{ jobId: string }>(`/reports/${id}/export`, { from, to, asOf: to });
      const j = await waitForJob(jobId);
      if (j.result?.url) await download(j.result.url, j.result.name ?? `${id}.xlsx`);
    } catch (e) {
      errorToast(e);
    }
  };
  return (
    <>
      <PageHeader title="Reports" actions={id && <Button variant="secondary" onClick={() => void exportXlsx()}>Export to Excel</Button>} />
      <Card>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium">Report
            <Select value={id} onChange={(e) => set('id', e.target.value)}>{list.data?.items.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
          </label>
          <TextField label="From" type="date" value={from} onChange={(e) => set('from', e.target.value)} />
          <TextField label="To / as of" type="date" value={to} onChange={(e) => set('to', e.target.value)} />
        </div>
        {r.isLoading ? <Skeleton rows={5} /> : r.error ? <ErrorState error={r.error} /> : r.data && (
          <>
            <Table rows={r.data.rows.map((x, i) => ({ id: String(i), ...x }))} columns={r.data.columns.map((c) => ({ key: c.key, label: c.label, align: c.money ? ('right' as const) : undefined, render: (row: Record<string, unknown>) => (c.money ? money(Number(row[c.key] ?? 0)) : String(row[c.key] ?? '—')) }))} />
            {r.data.totals && <p className="mt-3 text-sm">Totals: {Object.entries(r.data.totals).map(([k, v]) => `${r.data!.columns.find((c) => c.key === k)?.label ?? k} ${money(v)}`).join(' · ')}</p>}
          </>
        )}
      </Card>
    </>
  );
}
