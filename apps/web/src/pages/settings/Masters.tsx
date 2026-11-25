/** SCR-028 Masters: single source of truth CRUD per type with search, validation, default & deactivate/delete. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, del, get, patch, post } from '../../lib/api';
import { money } from '../../lib/format';
import { useOptions } from '../../features/hooks';
import { Badge, Button, Card, Dialog, ErrorState, Field, Select, Skeleton, Table, Textarea, TextField, toast } from '../../ui';
import { errorToast } from '../../ui/toast';

type FieldKind = 'text' | 'number' | 'money' | 'bool' | 'textarea' | 'select';
interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[];
  optionsFrom?: string;
}

const TYPES: [string, string, FieldDef[]][] = [
  [
    'products',
    'Products & services',
    [
      { key: 'type', label: 'Type', kind: 'select', options: [{ value: 'goods', label: 'Goods' }, { value: 'service', label: 'Service' }] },
      { key: 'hsnSac', label: 'HSN/SAC (4-8 digits)', kind: 'text' },
      { key: 'unit', label: 'Unit', kind: 'select', optionsFrom: 'units' },
      { key: 'ratePaise', label: 'Rate (₹)', kind: 'money' },
      { key: 'taxRatePct', label: 'GST %', kind: 'select', options: [0, 5, 12, 18, 28].map((r) => ({ value: String(r), label: `${r}%` })) },
      { key: 'description', label: 'Description', kind: 'textarea' },
    ],
  ],
  [
    'upiIds',
    'UPI IDs',
    [
      { key: 'vpa', label: 'UPI ID (VPA)', kind: 'text' },
      { key: 'payeeName', label: 'Payee name', kind: 'text' },
      { key: 'trEnabled', label: 'Send reference (tr)', kind: 'bool' },
    ],
  ],
  [
    'bankAccounts',
    'Bank accounts',
    [
      { key: 'bankName', label: 'Bank', kind: 'text' },
      { key: 'accountNo', label: 'Account number', kind: 'text' },
      { key: 'ifsc', label: 'IFSC', kind: 'text' },
      { key: 'branch', label: 'Branch', kind: 'text' },
    ],
  ],
  [
    'paymentTerms',
    'Payment terms',
    [
      { key: 'days', label: 'Days', kind: 'number' },
      { key: 'advancePct', label: 'Advance %', kind: 'number' },
    ],
  ],
  ['leadSources', 'Lead sources', []],
  ['pipelineStages', 'Pipeline stages', [{ key: 'probabilityPct', label: 'Probability %', kind: 'number' }]],
  ['lostReasons', 'Lost reasons', []],
  ['junkReasons', 'Junk reasons', []],
  [
    'callOutcomes',
    'Call outcomes',
    [
      { key: 'code', label: 'Code', kind: 'text' },
      { key: 'autoStage', label: 'Move to stage', kind: 'text' },
      { key: 'autoFollowUpDays', label: 'Follow up after (days)', kind: 'number' },
    ],
  ],
  [
    'messageTemplates',
    'Message templates',
    [
      { key: 'channel', label: 'Channel', kind: 'select', options: [{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'email', label: 'Email' }] },
      { key: 'category', label: 'Context', kind: 'select', options: [{ value: 'general', label: 'General (Lead / Customer)' }, { value: 'document', label: 'Document (Quote / Invoice)' }] },
      { key: 'subject', label: 'Subject (Email)', kind: 'text' },
      { key: 'body', label: 'Body ({name}, {company}, {sender_company}, {doc_no}, {amount}, {link})', kind: 'textarea' },
    ],
  ],
  [
    'termsTemplates',
    'Terms templates',
    [
      { key: 'docType', label: 'Document', kind: 'select', options: [{ value: 'quote', label: 'Quotation' }, { value: 'order', label: 'Sales Order' }, { value: 'invoice', label: 'Invoice' }] },
      { key: 'text', label: 'Terms Text', kind: 'textarea' },
    ],
  ],
  [
    'territories',
    'Territories',
    [
      { key: 'pincodeFrom', label: 'Pincode from', kind: 'text' },
      { key: 'pincodeTo', label: 'Pincode to', kind: 'text' },
    ],
  ],
  ['units', 'Units', []],
  ['tags', 'Tags', []],
  ['customerGroups', 'Customer groups', []],
];

type Item = { id: string; name: string; key: string | null; status: string; isDefault: boolean; sortOrder?: number; data: Record<string, unknown>; version: number };

export function Masters() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const type = params.get('type') ?? 'products';
  const def = TYPES.find((t) => t[0] === type) ?? TYPES[0]!;
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<Partial<Item> | null>(null);
  const [deactivatePrompt, setDeactivatePrompt] = useState<Item | null>(null);

  const q = useQuery({
    queryKey: ['masters', type],
    queryFn: () => get<{ items: Item[] }>(`/admin/masters/${type}`),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['masters', type] });
    void qc.invalidateQueries({ queryKey: ['options', type] });
    void qc.invalidateQueries({ queryKey: ['options'] });
    void qc.invalidateQueries({ queryKey: ['leads'] });
  };

  const toggle = useMutation({
    mutationFn: (i: Item) => post(`/admin/masters/${type}/${i.id}/${i.status === 'active' ? 'deactivate' : 'activate'}`),
    onSuccess: (_res, i) => {
      invalidate();
      toast(i.status === 'active' ? `${i.name} deactivated` : `${i.name} activated`, 'success');
    },
    onError: errorToast,
  });

  const setDefault = useMutation({
    mutationFn: (i: Item) => post(`/admin/masters/${type}/${i.id}/set-default`),
    onSuccess: (_res, i) => {
      invalidate();
      toast(`${i.name} set as default`, 'success');
    },
    onError: errorToast,
  });

  const remove = useMutation({
    mutationFn: (i: Item) => del(`/admin/masters/${type}/${i.id}`),
    onSuccess: (_res, i) => {
      invalidate();
      toast(`${i.name} deleted`, 'success');
    },
    onError: (err, i) => {
      if (err instanceof ApiError && (err.status === 422 || err.code === 'MASTER_IN_USE')) {
        setDeactivatePrompt(i);
      } else {
        errorToast(err);
      }
    },
  });

  const rows = useMemo(() => {
    const items = q.data?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(term) ||
        (i.key && i.key.toLowerCase().includes(term)) ||
        JSON.stringify(i.data || {}).toLowerCase().includes(term),
    );
  }, [q.data?.items, search]);

  return (
    <Card
      title="Masters"
      actions={
        <Button size="sm" onClick={() => setEdit({ name: '', key: '', data: {} })}>
          Add
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[220px] flex-col gap-1 text-sm font-medium">
          Master Type
          <Select
            value={type}
            onChange={(e) => {
              setSearch('');
              setParams({ type: e.target.value });
            }}
          >
            {TYPES.map(([t, l]) => (
              <option key={t} value={t}>
                {l}
              </option>
            ))}
          </Select>
        </label>
        <div className="min-w-[220px] flex-1 max-w-sm">
          <TextField
            label="Search"
            placeholder={`Filter ${def[1].toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {q.isLoading ? (
        <Skeleton rows={6} />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <Table<Item>
          rows={rows}
          onRow={(i) => setEdit(i)}
          columns={[
            {
              key: 'name',
              label: 'Name',
              render: (i) => (
                <div>
                  <div className="font-medium text-text">{i.name}</div>
                  {i.key && <div className="text-xs text-muted font-mono">{i.key}</div>}
                </div>
              ),
            },
            ...def[2].slice(0, 3).map((fd) => ({
              key: fd.key,
              label: fd.label,
              render: (i: Item) => {
                const val = i.data?.[fd.key];
                if (fd.kind === 'money') return money(Number(val ?? 0));
                if (fd.kind === 'bool') return val !== false ? 'Yes' : 'No';
                if (fd.key === 'taxRatePct' && val !== undefined && val !== '') return `${val}%`;
                return String(val ?? '—');
              },
            })),
            {
              key: 'status',
              label: 'Status',
              render: (i) => (
                <span className="flex flex-wrap gap-1">
                  <Badge status={i.status} />
                  {i.isDefault && <Badge tone="info">Default</Badge>}
                </span>
              ),
            },
            {
              key: 'act',
              label: 'Actions',
              render: (i) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => setEdit(i)}>
                    Edit
                  </Button>
                  {!i.isDefault && i.status === 'active' && (
                    <Button size="sm" variant="ghost" onClick={() => setDefault.mutate(i)}>
                      Set default
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate(i)}>
                    {i.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      if (confirm(`Delete "${i.name}"?`)) remove.mutate(i);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      {edit && <EditDialog type={type} fields={def[2]} item={edit} onClose={() => setEdit(null)} onSaved={invalidate} />}

      {deactivatePrompt && (
        <Dialog
          open
          onClose={() => setDeactivatePrompt(null)}
          title="Cannot delete — item in use"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeactivatePrompt(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const target = deactivatePrompt;
                  setDeactivatePrompt(null);
                  if (target.status === 'active') toggle.mutate(target);
                }}
              >
                Deactivate instead
              </Button>
            </>
          }
        >
          <p className="text-sm">
            <b>{deactivatePrompt.name}</b> is referenced by existing records (leads, quotes, orders, invoices, or payments) and cannot be deleted.
            You can deactivate it so it no longer appears in dropdowns while keeping existing documents intact.
          </p>
        </Dialog>
      )}
    </Card>
  );
}

function EditDialog({
  type,
  fields,
  item,
  onClose,
  onSaved,
}: {
  type: string;
  fields: FieldDef[];
  item: Partial<Item>;
  onClose(): void;
  onSaved(): void;
}) {
  const unitsQ = useOptions('units');
  const [name, setName] = useState(item.name ?? '');
  const [key, setKey] = useState(item.key ?? '');
  const [isDefault, setIsDefault] = useState(!!item.isDefault);
  const [sortOrder, setSortOrder] = useState(item.sortOrder !== undefined ? String(item.sortOrder) : '');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [data, setData] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      fields.map((fd) => {
        const raw = item.data?.[fd.key];
        if (fd.kind === 'money') return [fd.key, raw !== undefined && raw !== null ? String(Number(raw) / 100) : ''];
        if (fd.kind === 'bool') return [fd.key, raw !== false];
        if (fd.key === 'type' && !raw && type === 'products') return [fd.key, 'service'];
        if (fd.key === 'taxRatePct' && (raw === undefined || raw === null) && type === 'products') return [fd.key, '18'];
        if (fd.key === 'unit' && !raw && type === 'products') return [fd.key, 'Nos'];
        return [fd.key, raw !== undefined && raw !== null ? String(raw) : ''];
      }),
    ),
  );

  const save = useMutation({
    mutationFn: async () => {
      setFieldError(null);
      if (!name.trim()) throw new Error('Name is required');

      if (type === 'products') {
        const rateStr = String(data.ratePaise ?? '').trim();
        const rateNum = Number(rateStr);
        if (!rateStr || !Number.isFinite(rateNum) || rateNum <= 0) {
          throw new Error('Rate must be greater than 0');
        }
        if (!/^\d+(\.\d{1,2})?$/.test(rateStr)) {
          throw new Error('Rate can have at most 2 decimal places');
        }
        const hsn = String(data.hsnSac ?? '').trim();
        if (hsn && !/^\d{4,8}$/.test(hsn)) {
          throw new Error('HSN/SAC must be 4 to 8 digits');
        }
      }

      const out: Record<string, unknown> = {};
      for (const fd of fields) {
        const v = data[fd.key];
        if (v === '' || v === undefined) continue;
        if (fd.kind === 'money') out[fd.key] = Math.round(Number(v) * 100);
        else if (fd.kind === 'number' || fd.key === 'taxRatePct') out[fd.key] = Number(v);
        else out[fd.key] = v;
      }

      const body = {
        name: name.trim(),
        key: key.trim() || undefined,
        data: out,
        isDefault,
        ...(sortOrder !== '' ? { sortOrder: Number(sortOrder) } : {}),
      };
      return item.id ? patch(`/admin/masters/${type}/${item.id}`, body) : post(`/admin/masters/${type}`, body);
    },
    onSuccess: () => {
      onSaved();
      toast('Saved', 'success');
      onClose();
    },
    onError: (e: unknown) => {
      if (e instanceof Error && !(e instanceof ApiError)) {
        setFieldError(e.message);
      } else {
        errorToast(e);
      }
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={item.id ? `Edit ${item.name}` : 'Add item'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={save.isPending} disabled={!name.trim()} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {fieldError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{fieldError}</div>}
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Code / Key (unique)" value={key} onChange={(e) => setKey(e.target.value)} />
        {fields.map((fd) => {
          if (fd.kind === 'bool') {
            return (
              <label key={fd.key} className="flex min-h-touch items-center gap-2 text-sm">
                <input type="checkbox" checked={!!data[fd.key]} onChange={(e) => setData({ ...data, [fd.key]: e.target.checked })} /> {fd.label}
              </label>
            );
          }
          if (fd.kind === 'select') {
            const opts =
              fd.optionsFrom === 'units'
                ? (unitsQ.data ?? []).map((u) => ({ value: u.name || u.label, label: u.label }))
                : fd.options ?? [];
            return (
              <label key={fd.key} className="flex flex-col gap-1 text-sm font-medium">
                {fd.label}
                <Select value={String(data[fd.key] ?? '')} onChange={(e) => setData({ ...data, [fd.key]: e.target.value })}>
                  <option value="">Select {fd.label}</option>
                  {opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </label>
            );
          }
          if (fd.kind === 'textarea') {
            return (
              <Field key={fd.key} label={fd.label}>
                {(id) => (
                  <Textarea
                    id={id}
                    rows={3}
                    value={String(data[fd.key] ?? '')}
                    onChange={(e) => setData({ ...data, [fd.key]: e.target.value })}
                  />
                )}
              </Field>
            );
          }
          return (
            <TextField
              key={fd.key}
              label={fd.label}
              inputMode={fd.kind === 'text' ? undefined : 'decimal'}
              value={String(data[fd.key] ?? '')}
              onChange={(e) => setData({ ...data, [fd.key]: e.target.value })}
            />
          );
        })}
        <TextField label="Sort order" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        <label className="flex min-h-touch items-center gap-2 text-sm">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Default
        </label>
      </div>
    </Dialog>
  );
}
