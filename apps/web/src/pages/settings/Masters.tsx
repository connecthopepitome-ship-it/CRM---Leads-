/** SCR-028 Masters: generic list/edit per type (FR-018 – FR-022, FR-024). Type-specific data is edited as key fields. */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { get, patch, post } from '../../lib/api';
import { money } from '../../lib/format';
import { useAction } from '../../features/hooks';
import { Badge, Button, Card, Dialog, Select, Table, TextField, toast } from '../../ui';

const TYPES: [string, string, [string, string, 'text' | 'number' | 'money' | 'bool'][]][] = [
  ['products', 'Products & services', [['type', 'Type (goods/service)', 'text'], ['hsnSac', 'HSN/SAC', 'text'], ['unit', 'Unit', 'text'], ['ratePaise', 'Rate (₹)', 'money'], ['taxRatePct', 'GST %', 'number']]],
  ['upiIds', 'UPI IDs', [['vpa', 'UPI ID (VPA)', 'text'], ['payeeName', 'Payee name', 'text'], ['trEnabled', 'Send reference (tr)', 'bool']]],
  ['bankAccounts', 'Bank accounts', [['bankName', 'Bank', 'text'], ['accountNo', 'Account number', 'text'], ['ifsc', 'IFSC', 'text'], ['branch', 'Branch', 'text']]],
  ['paymentTerms', 'Payment terms', [['days', 'Days', 'number'], ['advancePct', 'Advance %', 'number']]],
  ['leadSources', 'Lead sources', []], ['pipelineStages', 'Pipeline stages', [['probabilityPct', 'Probability %', 'number']]],
  ['lostReasons', 'Lost reasons', []], ['junkReasons', 'Junk reasons', []],
  ['callOutcomes', 'Call outcomes', [['code', 'Code', 'text'], ['autoStage', 'Move to stage', 'text'], ['autoFollowUpDays', 'Follow up after (days)', 'number']]],
  ['messageTemplates', 'Message templates', [['channel', 'Channel (whatsapp/email)', 'text'], ['purpose', 'Purpose', 'text'], ['subject', 'Subject', 'text'], ['body', 'Body ({{name}}, {{link}}…)', 'text']]],
  ['termsTemplates', 'Terms templates', [['docType', 'Document (quote/invoice)', 'text'], ['text', 'Text', 'text']]],
  ['territories', 'Territories', [['pincodeFrom', 'Pincode from', 'text'], ['pincodeTo', 'Pincode to', 'text']]],
  ['units', 'Units', []], ['tags', 'Tags', []], ['customerGroups', 'Customer groups', []],
];

type Item = { id: string; name: string; key: string | null; status: string; isDefault: boolean; data: Record<string, unknown>; version: number };

export function Masters() {
  const [params, setParams] = useSearchParams();
  const type = params.get('type') ?? 'products';
  const def = TYPES.find((t) => t[0] === type)!;
  const q = useQuery({ queryKey: ['masters', type], queryFn: () => get<{ items: Item[] }>(`/admin/masters/${type}`) });
  const [edit, setEdit] = useState<Partial<Item> | null>(null);
  const toggle = useAction((i: Item) => post(`/admin/masters/${type}/${i.id}/${i.status === 'active' ? 'deactivate' : 'activate'}`), [['masters', type], ['options', type]]);
  return (
    <Card title="Masters" actions={<Button size="sm" onClick={() => setEdit({ name: '', key: '', data: {} })}>Add</Button>}>
      <label className="mb-3 flex max-w-xs flex-col gap-1 text-sm font-medium">Type
        <Select value={type} onChange={(e) => setParams({ type: e.target.value })}>{TYPES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}</Select>
      </label>
      <Table<Item>
        rows={q.data?.items ?? []}
        onRow={(i) => setEdit(i)}
        columns={[
          { key: 'name', label: 'Name' },
          ...def[2].slice(0, 3).map(([k, l, kind]) => ({ key: k, label: l, render: (i: Item) => (kind === 'money' ? money(Number(i.data[k] ?? 0)) : kind === 'bool' ? (i.data[k] !== false ? 'Yes' : 'No') : String(i.data[k] ?? '—')) })),
          { key: 'status', label: 'Status', render: (i) => <span className="flex gap-1"><Badge status={i.status} />{i.isDefault && <Badge tone="info">Default</Badge>}</span> },
          { key: 'act', label: '', render: (i) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); toggle.mutate(i); }}>{i.status === 'active' ? 'Deactivate' : 'Activate'}</Button> },
        ]}
      />
      {edit && <EditDialog type={type} fields={def[2]} item={edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function EditDialog({ type, fields, item, onClose }: { type: string; fields: [string, string, 'text' | 'number' | 'money' | 'bool'][]; item: Partial<Item>; onClose(): void }) {
  const [name, setName] = useState(item.name ?? '');
  const [key, setKey] = useState(item.key ?? '');
  const [isDefault, setIsDefault] = useState(!!item.isDefault);
  const [data, setData] = useState<Record<string, string | boolean>>(Object.fromEntries(fields.map(([k, , kind]) => [k, kind === 'money' ? String(Number(item.data?.[k] ?? 0) / 100) : kind === 'bool' ? item.data?.[k] !== false : String(item.data?.[k] ?? '')])));
  const save = useAction(() => {
    const out: Record<string, unknown> = {};
    for (const [k, , kind] of fields) {
      const v = data[k];
      if (v === '' || v === undefined) continue;
      out[k] = kind === 'money' ? Math.round(Number(v) * 100) : kind === 'number' ? Number(v) : v;
    }
    const body = { name, key: key || undefined, data: out, isDefault };
    return item.id ? patch(`/admin/masters/${type}/${item.id}`, body) : post(`/admin/masters/${type}`, body);
  }, [['masters', type], ['options', type]], () => {
    toast('Saved');
    onClose();
  });
  return (
    <Dialog open onClose={onClose} title={item.id ? `Edit ${item.name}` : 'Add item'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={save.isPending} disabled={!name} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="flex flex-col gap-3">
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        {!item.id && <TextField label="Code (optional, unique)" value={key} onChange={(e) => setKey(e.target.value)} />}
        {fields.map(([k, l, kind]) => (kind === 'bool'
          ? <label key={k} className="flex min-h-touch items-center gap-2 text-sm"><input type="checkbox" checked={!!data[k]} onChange={(e) => setData({ ...data, [k]: e.target.checked })} /> {l}</label>
          : <TextField key={k} label={l} inputMode={kind === 'text' ? undefined : 'decimal'} value={String(data[k] ?? '')} onChange={(e) => setData({ ...data, [k]: e.target.value })} />))}
        {['upiIds', 'bankAccounts'].includes(type) && <label className="flex min-h-touch items-center gap-2 text-sm"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Default (used on new invoices)</label>}
      </div>
    </Dialog>
  );
}
