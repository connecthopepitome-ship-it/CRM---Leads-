/** SCR-034 Import wizard, masters and opening data (FR-023): CSV parsed in the browser → API-055 preview → API-056 commit. */
import { useState } from 'react';
import { post } from '../../lib/api';
import { Banner, Button, Card, Select, Table } from '../../ui';
import { errorToast } from '../../ui/toast';
import { parseCsv } from './ImportLeads';

type Kind = 'products' | 'customers';
const FIELDS: Record<Kind, [string, string][]> = {
  products: [['code', 'Code'], ['name', 'Name'], ['type', 'Type (goods/service)'], ['hsnSac', 'HSN/SAC'], ['unit', 'Unit'], ['rate', 'Rate (₹)'], ['taxRatePct', 'GST %'], ['description', 'Description']],
  customers: [['name', 'Name'], ['gstin', 'GSTIN'], ['address', 'Address'], ['city', 'City'], ['stateCode', 'State code (2 digits)'], ['pincode', 'Pincode'], ['contactName', 'Contact name'], ['phone', 'Phone'], ['email', 'Email']],
};
const REQUIRED: Record<Kind, string[]> = { products: ['code', 'name'], customers: ['name'] };

interface Preview { importId: string; rows: number; valid: number; failed: number; duplicatesExisting: number; failures: { row: number; field: string; message: string }[] }

export function ImportData() {
  const [kind, setKind] = useState<Kind>('products');
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; failed: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const fields = FIELDS[kind];

  const load = async (f: File) => {
    const parsed = parseCsv(await f.text());
    if (parsed.length > 5001) return errorToast({ title: 'Split into files of up to 5,000 rows.' });
    const headers = (parsed[0] ?? []).map((h) => h.toLowerCase());
    setRows(parsed);
    setMap(Object.fromEntries(fields.map(([k, l]) => [k, headers.findIndex((h) => h === k.toLowerCase() || h.includes(l.split(' ')[0]!.toLowerCase()))]).filter(([, i]) => (i as number) >= 0)));
    setPreview(null);
    setResult(null);
  };
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(false);
    }
  };
  const check = () => act(async () => {
    const data = rows.slice(1).map((r) => Object.fromEntries(Object.entries(map).map(([k, i]) => [k, r[i] ?? ''])));
    setPreview(await post<Preview>('/admin/imports', { kind, rows: data }));
  });
  const commit = () => act(async () => {
    setResult(await post(`/admin/imports/${preview!.importId}/commit`, { updateExisting }));
    setPreview(null);
  });
  const headers = rows[0] ?? [];
  return (
    <Card title="Import products & customers">
      <label className="mb-3 flex max-w-xs flex-col gap-1 text-sm font-medium">What are you importing?
        <Select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setRows([]); setPreview(null); setResult(null); }}>
          <option value="products">Products and services</option>
          <option value="customers">Customers</option>
        </Select>
      </label>
      <input type="file" accept=".csv,text/csv" aria-label="Choose CSV file" onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} className="mb-3 text-sm" />
      <p className="mb-3 text-xs text-muted">Save Excel files as CSV first (up to 5,000 rows). Nothing is saved until you confirm.</p>
      {headers.length > 0 && !preview && (
        <>
          <div className="mb-3 grid gap-2 md:grid-cols-3">
            {fields.map(([k, l]) => (
              <label key={k} className="flex flex-col gap-1 text-sm">{l}{REQUIRED[kind].includes(k) ? ' *' : ''}
                <Select value={map[k] ?? -1} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}><option value={-1}>Not mapped</option>{headers.map((h, i) => <option key={i} value={i}>{h}</option>)}</Select>
              </label>
            ))}
          </div>
          <Table rows={rows.slice(1, 6).map((r, i) => ({ id: String(i), ...Object.fromEntries(fields.map(([k]) => [k, r[map[k] ?? -1] ?? ''])) }))} columns={fields.map(([k, l]) => ({ key: k, label: l }))} />
          <Button className="mt-3" busy={busy} disabled={REQUIRED[kind].some((k) => map[k] === undefined || map[k] < 0)} onClick={() => void check()}>Check {rows.length - 1} rows</Button>
        </>
      )}
      {preview && (
        <div className="flex flex-col gap-3">
          <Banner tone={preview.failed ? 'warning' : 'success'}>{preview.valid} ready to import, {preview.failed} need fixing{preview.duplicatesExisting ? `, ${preview.duplicatesExisting} already exist` : ''}.</Banner>
          {!!preview.failures?.length && <ul className="text-sm">{(preview.failures ?? []).slice(0, 50).map((f) => <li key={`${f.row}-${f.field}`}>Row {f.row} · {f.field}: {f.message}</li>)}</ul>}
          {kind === 'products' && preview.duplicatesExisting > 0 && (
            <label className="flex min-h-touch items-center gap-2 text-sm"><input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} /> Update existing items with the same code (otherwise they are skipped)</label>
          )}
          <span className="flex gap-2">
            <Button busy={busy} disabled={!preview.valid} onClick={() => void commit()}>Import {preview.valid} rows</Button>
            <Button variant="secondary" onClick={() => setPreview(null)}>Back</Button>
          </span>
        </div>
      )}
      {result && <Banner tone={result.failed ? 'warning' : 'success'}>{result.created} created, {result.updated} updated, {result.skipped} skipped, {result.failed} failed.</Banner>}
    </Card>
  );
}
