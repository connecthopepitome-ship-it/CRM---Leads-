/** SCR-034 Import wizard (FR-026): CSV parsed in the browser, rows sent to API-082. */
import { useState } from 'react';
import { post } from '../../lib/api';
import { Banner, Button, Card, Select, Table } from '../../ui';
import { errorToast } from '../../ui/toast';

const FIELDS = ['name', 'phone', 'email', 'company', 'city', 'pincode', 'notes'];

/** Minimal RFC 4180 CSV parser (quotes, commas, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export function ImportLeads() {
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<string, number>>({});
  const [report, setReport] = useState<{ created: number; merged: number; failed: { row: number; reason: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async (f: File) => {
    const parsed = parseCsv(await f.text());
    if (parsed.length > 5001) return errorToast({ title: 'Upload up to 5,000 rows — split the file.' });
    setRows(parsed);
    const headers = parsed[0] ?? [];
    setMap(Object.fromEntries(FIELDS.map((k) => [k, headers.findIndex((h) => h.toLowerCase().includes(k))]).filter(([, i]) => (i as number) >= 0)));
    setReport(null);
  };
  const run = async () => {
    setBusy(true);
    try {
      const data = rows.slice(1).map((r) => Object.fromEntries(Object.entries(map).map(([k, i]) => [k, r[i] ?? ''])));
      setReport(await post('/leads/import', { rows: data }));
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(false);
    }
  };
  const headers = rows[0] ?? [];
  return (
    <Card title="Import leads from CSV">
      <input type="file" accept=".csv,text/csv" aria-label="Choose CSV file" onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} className="mb-3 text-sm" />
      <p className="mb-3 text-xs text-muted">Save Excel files as CSV first. Duplicates (same phone or email) are merged as re-enquiries.</p>
      {headers.length > 0 && (
        <>
          <div className="mb-3 grid gap-2 md:grid-cols-4">
            {FIELDS.map((k) => (
              <label key={k} className="flex flex-col gap-1 text-sm">{k}
                <Select value={map[k] ?? -1} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}><option value={-1}>Not mapped</option>{headers.map((h, i) => <option key={i} value={i}>{h}</option>)}</Select>
              </label>
            ))}
          </div>
          <Table rows={rows.slice(1, 6).map((r, i) => ({ id: String(i), ...Object.fromEntries(FIELDS.map((k) => [k, r[map[k] ?? -1] ?? ''])) }))} columns={FIELDS.map((k) => ({ key: k, label: k }))} />
          <Button className="mt-3" busy={busy} disabled={map.name === undefined || (map.phone === undefined && map.email === undefined)} onClick={() => void run()}>Import {rows.length - 1} rows</Button>
        </>
      )}
      {report && (
        <div className="mt-3">
          <Banner tone={report.failed?.length ? 'warning' : 'success'}>{report.created} created, {report.merged} merged, {report.failed?.length ?? 0} failed.</Banner>
          {!!report.failed?.length && <ul className="mt-2 text-sm">{(report.failed ?? []).slice(0, 50).map((f) => <li key={f.row}>Row {f.row}: {f.reason.replace(/_/g, ' ').toLowerCase()}</li>)}</ul>}
        </div>
      )}
    </Card>
  );
}
