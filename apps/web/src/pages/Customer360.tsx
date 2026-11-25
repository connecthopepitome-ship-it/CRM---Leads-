/** SCR-021 Customer 360 + SCR-022 statement (FR-074 – FR-076). */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { del, get, post, patch, waitForJob, download } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, dateTime, label, money, today } from '../lib/format';
import { ActionBar, Timeline } from '../features/engagement';
import { useAction } from '../features/hooks';
import { Files } from '../features/Files';
import { Badge, Banner, Button, Card, Dialog, EmptyState, ErrorState, KeyValue, LinkButton, PageHeader, Skeleton, StatTile, Table, Tabs, TextField, cx, toast } from '../ui';
import { errorToast } from '../ui/toast';

interface C360 {
  customer: { id: string; code: string; displayName: string; legalName: string | null; gstin: string | null; tags: string[]; ownerId: string; createdAt: string; contacts?: Contact[] };
  kpis: Record<string, number>;
  ageing: Record<string, number> | null;
  tabs: string[];
}
interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
}

const TAB_LABEL: Record<string, string> = { overview: 'Overview', orders: 'Orders', quotes: 'Quotations', invoices: 'Invoices', payments: 'Payments', ledger: 'Statement', activities: 'Activities', contacts: 'Contacts', documents: 'Documents' };

export default function Customer360() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const { can, perm, mode } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: () => get<any>('/admin/users').then((r) => (Array.isArray(r) ? r : r?.items || [])),
    enabled: mode === 'team',
  });
  const reassign = useAction(
    (userId: string) => {
      const u = (usersQ.data || []).find((x: any) => x.id === userId);
      return patch(`/customers/${id}`, { assignedUserId: userId || null, assignedTo: u?.fullName || u?.name || null });
    },
    [['customer', id], ['c360', id], ['customers'], ['notifications']],
    () => toast('Customer reassigned successfully')
  );
  const q = useQuery({ queryKey: ['c360', id], queryFn: () => get<C360>(`/customers/${id}/360`), enabled: Boolean(id && id !== 'undefined') });
  const detail = useQuery({ queryKey: ['customer', id], queryFn: () => get<C360['customer'] & { contacts: Contact[]; addresses: { line1: string; city: string }[] }>(`/customers/${id}`), enabled: Boolean(id && id !== 'undefined') });
  const followUpsQ = useQuery({ queryKey: ['follow-ups'], queryFn: () => get<{ items: any[] }>('/follow-ups'), enabled: Boolean(id && id !== 'undefined') });
  if (q.isLoading) return <Skeleton rows={6} />;
  const is404 = !q.data || !q.data.customer || (q.error as any)?.status === 404 || (q.error as any)?.code === 'NOT_FOUND';
  if (is404) {
    return (
      <EmptyState
        title="Customer not found"
        description="The requested customer does not exist or has been removed."
        action={<LinkButton to="/customers">Back to customers</LinkButton>}
      />
    );
  }
  if (q.error) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const { customer, kpis = {}, ageing, tabs = [] } = q.data;
  const contacts = detail.data?.contacts ?? [];
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
  const primaryPhone = primary?.phone ?? (detail.data as any)?.phone ?? (customer as any)?.phone ?? null;
  const primaryEmail = primary?.email ?? (detail.data as any)?.email ?? (customer as any)?.email ?? null;
  const nextFu = (followUpsQ.data?.items ?? [])
    .filter((f: any) => f.recordType === 'customer' && f.recordId === customer.id && f.status !== 'completed' && !f.completed && f.dueAt)
    .sort((a: any, b: any) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];
  const nextFuOverdue = nextFu && new Date(nextFu.dueAt).getTime() < Date.now();
  return (
    <>
      <PageHeader back="/customers" title={customer.displayName} subtitle={`${customer.code}${customer.gstin ? ` · GSTIN ${customer.gstin}` : ''}`} actions={<>
        {can('quote', 'create') && <LinkButton to={`/sales/quotes/new?partyType=customer&partyId=${customer.id}`} variant="primary">New quote</LinkButton>}
        {can('payment', 'create') && <LinkButton to={`/sales/payments/new?customerId=${customer.id}`}>Record payment</LinkButton>}
        <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>Delete</Button>
      </>} />
      {nextFu && (
        <div className="mb-3">
          <Banner tone={nextFuOverdue ? 'danger' : 'info'}>
            <div className="flex flex-wrap items-center gap-2">
              <span>
                <b>Next follow-up:</b> {String(nextFu.type).toUpperCase()} on {dateTime(nextFu.dueAt)} {nextFu.note && `— ${nextFu.note}`}
              </span>
              {nextFuOverdue && (
                <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                  Overdue
                </span>
              )}
            </div>
          </Banner>
        </div>
      )}
      <div className="mb-4"><ActionBar rec={{ recordType: 'customer', recordId: customer.id, name: primary?.name ?? customer.displayName, company: customer.legalName || customer.displayName || null, phone: primaryPhone, email: primaryEmail, address: detail.data?.addresses?.[0] ? `${detail.data.addresses[0].line1}, ${detail.data.addresses[0].city}` : null }} /></div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {ageing ? <>
          <StatTile label="Outstanding" value={money(kpis.outstanding)} />
          <StatTile label="Overdue" value={money(kpis.overdue)} tone={kpis.overdue ? 'danger' : undefined} />
          <StatTile label="Total received" value={money(kpis.received)} tone="success" />
          <StatTile label="Lifetime value" value={money(kpis.lifetimeValue)} />
          {!!kpis.advance && <StatTile label="Advance (on account)" value={money(kpis.advance)} />}
          <StatTile label="Avg days to pay" value={kpis.avgDaysToPay || '—'} />
        </> : null}
        <StatTile label="Active orders" value={kpis.activeOrders ?? 0} />
        <StatTile label="Open quotations" value={kpis.openQuotes ?? 0} />
      </div>
      <Tabs tabs={tabs.map((t) => ({ id: t, label: TAB_LABEL[t] ?? t }))} active={tab} onChange={(t) => setParams({ tab: t })} />
      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Timeline recordType="customer" recordId={customer.id} />
          <div className="flex flex-col gap-4">
            <Card title="Details">
              <KeyValue columns={1} items={([
                mode === 'team'
                  ? [
                      'Assigned to',
                      perm('customer:assign') ? (
                        <select
                          value={(detail.data as any)?.assignedUserId || (customer as any)?.assignedUserId || ''}
                          onChange={(e) => reassign.mutate(e.target.value)}
                          className="text-xs p-1 rounded border border-[#DCE7D9] bg-white font-medium max-w-[150px] truncate"
                        >
                          <option value="">Unassigned</option>
                          {(usersQ.data || [])
                            .filter((u: any) => u.status === 'active')
                            .map((u: any) => (
                              <option key={u.id} value={u.id}>
                                {u.fullName || u.name}
                              </option>
                            ))}
                        </select>
                      ) : (
                        (detail.data as any)?.assignedTo || (customer as any)?.assignedTo || 'Unassigned'
                      ),
                    ]
                  : null,
                ['Code', customer.code],
                ['Phone', primaryPhone],
                ['Email', primaryEmail],
                ['GSTIN', customer.gstin || null],
                ['Created', dateTime(customer.createdAt)],
              ] as any[]).filter(Boolean)} />
            </Card>
            {ageing && (
              <Card title="Ageing">
                <ul className="text-sm">
                  {Object.entries({ not_due: 'Not yet due', d1_30: '1–30 days', d31_60: '31–60 days', d61_90: '61–90 days', d90_plus: '90+ days' }).map(([k, l]) => (
                    <li key={k} className="flex justify-between border-b border-border py-1"><span>{l}</span><span className="tabular-nums">{money(ageing[k])}</span></li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
      {tab === 'activities' && <Timeline recordType="customer" recordId={customer.id} />}
      {['orders', 'quotes', 'invoices', 'payments'].includes(tab) && <DocList customerId={customer.id} tab={tab} />}
      {tab === 'ledger' && <Statement customerId={customer.id} />}
      {tab === 'contacts' && (
        <>
          <div className="flex flex-col gap-2.5 md:hidden">
            {contacts.length === 0 ? (
              <EmptyState title="No contacts yet" />
            ) : (
              contacts.map((c, i) => (
                <div key={c.id ?? i} className="rounded-xl border border-[#DCE7D9]/80 bg-white/90 p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[#202820]">{c.name}</span>
                    {c.isPrimary && <Badge tone="info">Primary</Badge>}
                  </div>
                  <div className="text-xs text-[#778477] mt-1">{label(c.role)}</div>
                  <div className="mt-2 flex flex-col gap-1 text-xs text-[#202820]">
                    {c.phone && <span>📞 {c.phone}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block">
            <Table<Contact> rows={contacts} columns={[{ key: 'name', label: 'Name' }, { key: 'role', label: 'Role', render: (c) => label(c.role) }, { key: 'phone', label: 'Phone', render: (c) => c.phone ?? '—' }, { key: 'email', label: 'Email', render: (c) => c.email ?? '—' }, { key: 'p', label: '', render: (c) => (c.isPrimary ? <Badge tone="info">Primary</Badge> : null) }]} />
          </div>
        </>
      )}
      {tab === 'documents' && <Files recordType="customer" recordId={customer.id} />}
      {confirmDelete && (
        <Dialog
          open
          onClose={() => setConfirmDelete(false)}
          title="Delete Customer"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button
                variant="danger"
                busy={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await del(`/customers/${customer.id}`);
                    void qc.invalidateQueries({ queryKey: ['follow-ups'] });
                    void qc.invalidateQueries({ queryKey: ['customers'] });
                    toast('Customer deleted successfully');
                    nav('/customers', { replace: true });
                  } catch (e) {
                    errorToast(e);
                    setDeleting(false);
                  }
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm">Are you sure you want to delete customer <b>{customer.displayName}</b>? This action will remove the customer and record an audit log.</p>
        </Dialog>
      )}
    </>
  );
}

function DocList({ customerId, tab }: { customerId: string; tab: string }) {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['c360tab', customerId, tab], queryFn: () => get<{ items: Record<string, unknown>[] }>(`/customers/${customerId}/${tab}?limit=100`) });
  if (q.isLoading) return <Skeleton />;
  if (q.error) return <ErrorState error={q.error} />;
  const items = (q.data?.items ?? []) as ({ id: string } & Record<string, unknown>)[];
  const cols: Record<string, { key: string; label: string; render?: (r: Record<string, unknown>) => React.ReactNode; align?: 'right' }[]> = {
    quotes: [{ key: 'displayNumber', label: 'Number', render: (r) => String(r.displayNumber ?? 'Draft') }, { key: 'date', label: 'Date', render: (r) => date(String(r.date)) }, { key: 'status', label: 'Status', render: (r) => <Badge status={String(r.status)} /> }, { key: 'total', label: 'Total', align: 'right', render: (r) => money(((r.totals as any)?.grandTotal ?? Number(r.grandTotal ?? 0))) }],
    orders: [{ key: 'number', label: 'Number' }, { key: 'date', label: 'Date', render: (r) => date(String(r.date)) }, { key: 'status', label: 'Status', render: (r) => <Badge status={String(r.status)} /> }, { key: 'total', label: 'Total', align: 'right', render: (r) => money(((r.totals as any)?.grandTotal ?? Number(r.grandTotal ?? 0))) }],
    invoices: [{ key: 'number', label: 'Number', render: (r) => String(r.number ?? 'Draft') }, { key: 'dueDate', label: 'Due', render: (r) => date(String(r.dueDate)) }, { key: 'status', label: 'Status', render: (r) => <Badge status={String(r.status)} /> }, { key: 'ageing', label: 'Ageing', render: (r) => (r.status === 'paid' || !r.ageing ? '—' : label(String(r.ageing).replace('d', '').replace('_plus', '+').replace('_', '–'))) }, { key: 'bal', label: 'Balance', align: 'right', render: (r) => money(Number(r.balanceDue ?? 0)) }],
    payments: [{ key: 'receiptNo', label: 'Receipt' }, { key: 'date', label: 'Date', render: (r) => date(String(r.date)) }, { key: 'mode', label: 'Mode', render: (r) => String(r.mode ?? 'NEFT').toUpperCase() }, { key: 'status', label: 'Status', render: (r) => <Badge status={String(r.status)} /> }, { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(Number(r.amount ?? 0)) }],
  };
  const path = { quotes: 'quotes', orders: 'orders', invoices: 'invoices', payments: 'payments' }[tab]!;
  return (
    <>
      <div className="flex flex-col gap-2.5 md:hidden">
        {items.length === 0 ? (
          <EmptyState title={`No ${TAB_LABEL[tab] ?? tab} yet`} />
        ) : (
          items.map((r) => (
            <div
              key={r.id}
              onClick={() => (path === 'orders' ? nav(`/sales/orders/${r.id}`) : nav(`/sales/${path}/${r.id}`))}
              className="cursor-pointer rounded-xl border border-[#DCE7D9]/80 bg-white/90 p-3.5 shadow-2xs hover:border-[#3D7952]/40 transition-all active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-[#3D7952]">
                  {String(r.displayNumber ?? r.number ?? r.receiptNo ?? 'Draft')}
                </span>
                <Badge status={String(r.status)} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[#778477]">
                <span>{r.date ? date(String(r.date)) : (r.dueDate ? `Due ${date(String(r.dueDate))}` : '—')}</span>
                <span className="font-bold text-[#202820]">
                  {money(((r.totals as any)?.grandTotal ?? Number(r.grandTotal ?? r.amount ?? r.balanceDue ?? 0)))}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="hidden md:block">
        <Table rows={items} columns={cols[tab] ?? []} onRow={(r) => (path === 'orders' ? nav(`/sales/orders/${r.id}`) : nav(`/sales/${path}/${r.id}`))} />
      </div>
    </>
  );
}

function Statement({ customerId }: { customerId: string }) {
  const [from, setFrom] = useState(`${today().slice(0, 4)}-04-01` > today() ? `${Number(today().slice(0, 4)) - 1}-04-01` : `${today().slice(0, 4)}-04-01`);
  const [to, setTo] = useState(today());
  const q = useQuery({ queryKey: ['statement', customerId, from, to], queryFn: () => get<{ opening: number; closing: number; rows: { date: string; kind: string; docNumber: string; debit: number; credit: number; balance: number; seq: number }[] }>(`/customers/${customerId}/statement?from=${from}&to=${to}`) });
  const exportAs = async (format: 'pdf' | 'xlsx') => {
    try {
      const { jobId } = await get<{ jobId: string }>(`/customers/${customerId}/statement?from=${from}&to=${to}&format=${format}`);
      const j = await waitForJob(jobId);
      if (j.result?.url) await download(j.result.url, j.result.name ?? `statement.${format}`);
    } catch (e) {
      errorToast(e);
    }
  };
  const share = async () => {
    try {
      const r = await post<{ url: string }>('/share-links', { documentType: 'statement', documentId: customerId, from, to });
      await navigator.clipboard.writeText(r.url);
      toast('Statement link copied');
    } catch (e) {
      errorToast(e);
    }
  };
  return (
    <Card title="Statement of account" actions={<div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => void exportAs('pdf')}>PDF</Button><Button size="sm" variant="secondary" onClick={() => void exportAs('xlsx')}>Excel</Button><Button size="sm" variant="ghost" onClick={() => void share()}>Copy share link</Button></div>}>
      <div className="mb-3 grid grid-cols-2 gap-2 md:w-96">
        <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {q.isLoading ? <Skeleton /> : q.data && (
        <Table
          rows={[{ id: 'open', date: from, kind: 'Opening balance', docNumber: '', debit: 0, credit: 0, balance: q.data.opening }, ...(q.data.rows ?? []).map((r) => ({ ...r, id: `${r.seq}` })), { id: 'close', date: to, kind: 'Closing balance', docNumber: '', debit: 0, credit: 0, balance: q.data.closing }]}
          columns={[{ key: 'date', label: 'Date', render: (r) => date(r.date) }, { key: 'kind', label: 'Particulars', render: (r) => label(r.kind) }, { key: 'docNumber', label: 'Document' }, { key: 'debit', label: 'Debit', align: 'right', render: (r) => (r.debit ? money(r.debit) : '') }, { key: 'credit', label: 'Credit', align: 'right', render: (r) => (r.credit ? money(r.credit) : '') }, { key: 'balance', label: 'Balance', align: 'right', render: (r) => money(r.balance) }]}
        />
      )}
      <p className="mt-2 text-xs text-muted"><Link to="/reports">Collections & ageing report</Link></p>
    </Card>
  );
}
