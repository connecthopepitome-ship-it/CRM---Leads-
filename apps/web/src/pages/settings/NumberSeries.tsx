/** FR-005 number series. */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fyOf } from '@ss/domain';
import { get, put } from '../../lib/api';
import { label, today } from '../../lib/format';
import { useAction } from '../../features/hooks';
import { Button, Card, Dialog, Table, TextField, toast } from '../../ui';

type Series = { id: string; docType: string; prefix: string; pad: number; fyReset: boolean; lastNumber?: string; nextNumber?: string };

function formatDocPreview(s: Series, seq = 2): string {
  if (s.nextNumber && seq === 2) return s.nextNumber;
  const fy = fyOf(today());
  const clean = (s.prefix || '').replace(/\/+$/, '');
  const hasFy = clean.includes(fy) || /\d{2}-\d{2}/.test(clean);
  const n = String(seq).padStart(s.pad || 4, '0');
  if (hasFy) {
    return `${clean}/${n}`;
  }
  return s.fyReset ? `${clean}/${fy}/${n}` : `${clean}/${n}`;
}

export function NumberSeries() {
  const q = useQuery({ queryKey: ['series'], queryFn: () => get<{ items: Series[] }>('/admin/number-series') });
  const [edit, setEdit] = useState<Series | null>(null);
  const save = useAction((s: Series) => put(`/admin/number-series/${s.docType}`, { prefix: s.prefix, pad: Number(s.pad), fyReset: s.fyReset }), [['series']], () => {
    toast('Series saved');
    setEdit(null);
  });
  return (
    <Card title="Document numbering">
      <Table<Series> rows={q.data?.items ?? []} onRow={(s) => setEdit({ ...s })} columns={[
        { key: 'docType', label: 'Document', render: (s) => label(s.docType) },
        { key: 'lastNumber', label: 'Last issued', render: (s) => s.lastNumber ? <span className="font-mono text-xs">{s.lastNumber}</span> : '—' },
        { key: 'example', label: 'Next number looks like', render: (s) => <span className="font-mono text-xs font-semibold text-[#3D7952]">{s.nextNumber || formatDocPreview(s, 2)}</span> },
      ]} />
      {edit && (
        <Dialog open onClose={() => setEdit(null)} title={`Numbering — ${label(edit.docType)}`} footer={<Button busy={save.isPending} onClick={() => save.mutate(edit)}>Save</Button>}>
          <div className="flex flex-col gap-3">
            <TextField label="Prefix" value={edit.prefix} onChange={(e) => setEdit({ ...edit, prefix: e.target.value.toUpperCase() })} hint="Letters, digits, / and - only; the full number must be 16 characters or fewer." />
            <TextField label="Digits" inputMode="numeric" value={String(edit.pad)} onChange={(e) => setEdit({ ...edit, pad: Number(e.target.value) || 1 })} />
            <label className="flex min-h-touch items-center gap-2 text-sm"><input type="checkbox" checked={edit.fyReset} onChange={(e) => setEdit({ ...edit, fyReset: e.target.checked })} /> Restart each financial year (1 April)</label>
            <p className="text-sm">Preview: <b className="font-mono text-[#3D7952]">{formatDocPreview(edit, edit.nextNumber ? 2 : 1)}</b></p>
          </div>
        </Dialog>
      )}
    </Card>
  );
}
