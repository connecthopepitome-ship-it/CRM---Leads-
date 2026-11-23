/** SCR-029 Google connection, Sheet sync, runs and error queue (FR-037 – FR-043). */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get, post } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { useAction } from '../../features/hooks';
import { Badge, Banner, Button, Card, Dialog, Select, Table, TextField, toast } from '../../ui';
import { errorToast } from '../../ui/toast';

const FIELDS = [['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['company', 'Company'], ['city', 'City'], ['notes', 'Notes / message'], ['enquiryAt', 'Enquiry time']];

export function Google() {
  const status = useQuery({ queryKey: ['google'], queryFn: () => get<{ status: string; email: string | null; features: Record<string, boolean>; lastError: string | null }>('/admin/google') });
  const sheets = useQuery({ queryKey: ['sheets'], queryFn: () => get<{ items: { id: string; spreadsheetId: string; tab: string; mode: string; status: string; lastRunAt: string | null; lastRunStatus: string | null }[] }>('/admin/sheets') });
  const errors = useQuery({ queryKey: ['import-errors'], queryFn: () => get<{ items: { id: string; rowNumber: number; reason: string; rowData: Record<string, string> }[] }>('/admin/import-errors') });
  const [wizard, setWizard] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const syncNow = useAction((id: string) => post<{ created?: number; merged?: number; failed?: number; status?: string }>(`/admin/sheets/${id}/sync`), [['sheets'], ['import-errors']], (r) => toast(r.status === 'mapping_attention' ? 'Mapping needs attention — the sheet header changed' : `Synced: ${r.created ?? 0} new, ${r.merged ?? 0} merged, ${r.failed ?? 0} need attention`, r.status === 'mapping_attention' ? 'danger' : 'success'));
  const dismiss = useAction((id: string) => post(`/admin/import-errors/${id}/dismiss`), [['import-errors']]);
  const retry = useAction((a: { id: string; phone: string }) => post(`/admin/import-errors/${a.id}/retry`, { fields: { phone: a.phone } }), [['import-errors']], () => toast('Lead created'));
  const connect = async () => {
    try {
      const r = await post<{ authUrl: string }>('/admin/google/connect');
      window.location.href = r.authUrl;
    } catch (e) {
      errorToast(e);
    }
  };
  const s = status.data;
  return (
    <div className="flex flex-col gap-4">
      {s?.status === 'lost' && <Banner tone="danger" action={<Button size="sm" onClick={() => void connect()}>Reconnect</Button>}>Google connection lost — reconnect to resume syncing, email and Drive.</Banner>}
      <Card title="Google account">
        {s?.status === 'connected' ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Connected as <b>{s.email}</b></span>
            {Object.entries(s.features).map(([k, v]) => <Badge key={k} tone={v ? 'success' : 'warning'}>{k}{v ? '' : ': not available — reconnect to enable'}</Badge>)}
            <Button size="sm" variant="ghost" onClick={() => void post('/admin/google/disconnect').then(() => status.refetch())}>Disconnect</Button>
          </div>
        ) : <Button onClick={() => void connect()}>Connect Google account</Button>}
      </Card>
      <Card title="Google Sheets" actions={s?.status === 'connected' && <Button size="sm" onClick={() => setWizard(true)}>Connect a sheet</Button>}>
        <Table rows={sheets.data?.items ?? []} columns={[
          { key: 'tab', label: 'Sheet / tab', render: (r) => `${r.spreadsheetId.slice(0, 10)}… / ${r.tab}` },
          { key: 'mode', label: 'Trigger', render: (r) => (r.mode === 'webhook' ? 'Instant (Apps Script)' : 'Polling') },
          { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'ok' ? 'success' : 'danger'}>{r.status.replace('_', ' ')}</Badge> },
          { key: 'last', label: 'Last sync', render: (r) => dateTime(r.lastRunAt) },
          { key: 'a', label: '', render: (r) => <span className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => syncNow.mutate(r.id)}>Sync now</Button>{r.mode === 'webhook' && <Button size="sm" variant="ghost" onClick={() => void get<{ script: string }>(`/admin/sheets/${r.id}/apps-script`).then((x) => setScript(x.script))}>Setup script</Button>}</span> },
        ]} />
      </Card>
      <Card title="Rows needing attention">
        <Table rows={errors.data?.items ?? []} empty={<p className="text-sm text-muted">No problems — every row was imported.</p>} columns={[
          { key: 'rowNumber', label: 'Row' },
          { key: 'name', label: 'Name', render: (r) => r.rowData.name ?? '' },
          { key: 'reason', label: 'Problem' },
          { key: 'a', label: '', render: (r) => <span className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => { const phone = prompt('Correct mobile number'); if (phone) retry.mutate({ id: r.id, phone }); }}>Fix & retry</Button><Button size="sm" variant="ghost" onClick={() => dismiss.mutate(r.id)}>Dismiss</Button></span> },
        ]} />
      </Card>
      {wizard && <SheetWizard onClose={() => { setWizard(false); void sheets.refetch(); }} />}
      <Dialog open={!!script} onClose={() => setScript(null)} title="Apps Script for instant sync">
        <p className="mb-2 text-sm">In your sheet: Extensions → Apps Script, paste this, save, then add an “On change” trigger for <code>onSheetChange</code>.</p>
        <textarea readOnly className="h-64 w-full rounded-md border border-border bg-surface-2 p-2 font-mono text-xs" value={script ?? ''} aria-label="Apps Script code" />
      </Dialog>
    </div>
  );
}

function SheetWizard({ onClose }: { onClose(): void }) {
  const [step, setStep] = useState(1);
  const [sheetId, setSheetId] = useState('');
  const [tab, setTab] = useState('Sheet1');
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][]; canEdit: boolean } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mode, setMode] = useState('poll');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try {
      const id = sheetId.match(/\/d\/([\w-]+)/)?.[1] ?? sheetId;
      setSheetId(id);
      const p = await post<{ headers: string[]; rows: string[][]; canEdit: boolean }>('/admin/sheets/preview', { spreadsheetId: id, tab, headerRow: 1 });
      setPreview(p);
      const guess: Record<string, string> = {};
      for (const [f] of FIELDS) {
        const h = p.headers.find((x) => x.toLowerCase().includes(f === 'enquiryAt' ? 'time' : f === 'notes' ? 'message' : String(f)));
        if (h) guess[f!] = h;
      }
      setMapping(guess);
      setStep(2);
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      await post('/admin/sheets', { spreadsheetId: sheetId, tab, mapping: Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)), mode, pollMinutes: 4 });
      toast('Sheet connected');
      onClose();
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`Connect a sheet — step ${step} of 2`} footer={step === 1 ? <Button busy={busy} disabled={!sheetId} onClick={() => void load()}>Preview</Button> : <><Button variant="secondary" onClick={() => setStep(1)}>Back</Button><Button busy={busy} disabled={!mapping.phone && !mapping.email} onClick={() => void save()}>Save & start syncing</Button></>}>
      {step === 1 ? (
        <div className="flex flex-col gap-3">
          <TextField label="Sheet link or ID" value={sheetId} onChange={(e) => setSheetId(e.target.value)} hint="Pick a sheet you own; SaleSphere marks imported rows in a “CRM Lead ID” column." />
          <TextField label="Tab name" value={tab} onChange={(e) => setTab(e.target.value)} />
        </div>
      ) : preview && (
        <div className="flex flex-col gap-3 text-sm">
          {!preview.canEdit && <Banner tone="danger">SaleSphere needs edit access to mark imported rows.</Banner>}
          {!mapping.phone && !mapping.email && <Banner tone="warning">Map a Phone or Email column.</Banner>}
          {FIELDS.map(([f, l]) => (
            <label key={f} className="grid grid-cols-2 items-center gap-2">{l}
              <Select value={mapping[f!] ?? ''} onChange={(e) => setMapping({ ...mapping, [f!]: e.target.value })}><option value="">Not mapped</option>{preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}</Select>
            </label>
          ))}
          <label className="grid grid-cols-2 items-center gap-2">Trigger
            <Select value={mode} onChange={(e) => setMode(e.target.value)}><option value="poll">Check every 4 minutes</option><option value="webhook">Instant (Apps Script) + 15-minute safety check</option></Select>
          </label>
          <p className="text-muted">Preview: {preview.rows?.length ?? 0} rows, first “{preview.rows?.[0]?.join(' | ')}”</p>
        </div>
      )}
    </Dialog>
  );
}
