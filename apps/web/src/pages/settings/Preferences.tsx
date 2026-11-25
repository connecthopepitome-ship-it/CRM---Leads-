/** FR-003, FR-004, FR-022: mode, modules, terminology, SLA, sales defaults, permissions, FY lock. */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, put } from '../../lib/api';
import { useAction } from '../../features/hooks';
import { Badge, Button, Card, SelectField, Skeleton, Table, TextField, toast } from '../../ui';
import { useEffect, useState } from 'react';

const PERMISSION_MATRIX_DISPLAY = [
  {
    role: 'Admin',
    leads: 'All (CRUD + Export)',
    customers: 'All (CRUD + Export)',
    quotes: 'All (CRUD + Approve)',
    orders: 'All (CRUD)',
    invoices: 'All (CRUD)',
    payments: 'All (CRUD)',
    reports: 'All (View + Export)',
    settings: 'Full Access',
  },
  {
    role: 'Sales Manager',
    leads: 'Team (CRUD + Reopen)',
    customers: 'Team (CRUD)',
    quotes: 'Team (CRUD + Approve)',
    orders: 'Team (CRUD)',
    invoices: 'Team (View only)',
    payments: 'Team (View only)',
    reports: 'Team (View + Export)',
    settings: 'None',
  },
  {
    role: 'Sales Executive',
    leads: 'Own records (CRU, No Delete)',
    customers: 'Own records (CRU, No Delete)',
    quotes: 'Own records (CRU, No Delete)',
    orders: 'Own records (CRU)',
    invoices: 'Own (View only)',
    payments: 'Optional recording',
    reports: 'Own records',
    settings: 'None',
  },
  {
    role: 'Accounts',
    leads: 'All (View only)',
    customers: 'All (View + Edit)',
    quotes: 'All (View only)',
    orders: 'All (View only)',
    invoices: 'All (CRUD + Issue/Credit)',
    payments: 'All (CRUD + Overrides)',
    reports: 'Financial Reports',
    settings: 'None',
  },
  {
    role: 'Project Manager',
    leads: 'All (View only)',
    customers: 'All (View only)',
    quotes: 'All (View only)',
    orders: 'All (Status Update)',
    invoices: 'All (View only)',
    payments: 'None',
    reports: 'Operations',
    settings: 'None',
  },
  {
    role: 'Viewer / Auditor',
    leads: 'All (Read-only)',
    customers: 'All (Read-only)',
    quotes: 'All (Read-only)',
    orders: 'All (Read-only)',
    invoices: 'All (Read-only)',
    payments: 'All (Read-only)',
    reports: 'All (Read-only)',
    settings: 'Audit Log only',
  },
];

export function Preferences() {
  const qc = useQueryClient();
  const mode = useQuery({ queryKey: ['settings', 'mode'], queryFn: () => get<any>('/admin/settings/mode') });
  const modules = useQuery({ queryKey: ['settings', 'modules'], queryFn: () => get<any>('/admin/settings/modules') });
  const sla = useQuery({ queryKey: ['settings', 'sla'], queryFn: () => get<any>('/admin/settings/sla') });
  const sales = useQuery({ queryKey: ['settings', 'sales'], queryFn: () => get<any>('/admin/settings/sales') });
  const perms = useQuery({ queryKey: ['settings', 'permissions'], queryFn: () => get<any>('/admin/settings/permissions') });
  const terms = useQuery({ queryKey: ['settings', 'terminology'], queryFn: () => get<any>('/admin/settings/terminology') });
  const [t, setT] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = (terms.data as any)?.data ?? terms.data;
    if (raw && typeof raw === 'object') setT(raw);
  }, [terms.data]);

  const fin = useQuery({ queryKey: ['settings', 'finance'], queryFn: () => get<any>('/admin/settings/finance') });
  const [s, setS] = useState({ minutes: '15', start: '09:00', end: '19:00', validDays: '15', execLimit: '10', mgrLimit: '20', lockDate: '' });

  useEffect(() => {
    const slaRaw = (sla.data as any)?.data ?? sla.data;
    const salesRaw = (sales.data as any)?.data ?? sales.data;
    const finRaw = (fin.data as any)?.data ?? fin.data;
    if (slaRaw || salesRaw || finRaw) {
      setS((x) => ({
        ...x,
        minutes: String(slaRaw?.minutes ?? x.minutes ?? '15'),
        start: slaRaw?.calendar?.start ?? x.start ?? '09:00',
        end: slaRaw?.calendar?.end ?? x.end ?? '19:00',
        validDays: String(salesRaw?.validDays ?? x.validDays ?? '15'),
        execLimit: String(salesRaw?.discountLimits?.sales_exec ?? x.execLimit ?? '10'),
        mgrLimit: String(salesRaw?.discountLimits?.sales_manager ?? x.mgrLimit ?? '20'),
        lockDate: finRaw?.lockDate ?? x.lockDate ?? '',
      }));
    }
  }, [sla.data, sales.data, fin.data]);

  const saveMode = useAction(
    (m: string) => put('/admin/settings/mode', { mode: m }),
    [['settings'], ['app-config'], ['users']],
    () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void qc.invalidateQueries({ queryKey: ['app-config'] });
      toast('Mode updated successfully');
    }
  );

  const saveSection = useAction(
    (a: { section: string; data: object }) => put(`/admin/settings/${a.section}`, { data: a.data }),
    [['settings'], ['app-config']],
    () => toast('Saved')
  );

  if (mode.isLoading || sla.isLoading || modules.isLoading || perms.isLoading) return <Skeleton rows={5} />;

  const currentMode = (mode.data as any)?.data?.mode ?? (mode.data as any)?.mode ?? 'solo';
  const showOrders = !!((modules.data as any)?.data?.orders ?? (modules.data as any)?.orders ?? true);
  const execPayments = !!((perms.data as any)?.data?.execPaymentsEnabled ?? (perms.data as any)?.execPaymentsEnabled ?? true);

  return (
    <div className="flex flex-col gap-4">
      <Card title="Mode">
        <SelectField
          label="How do you work?"
          value={currentMode}
          onChange={(e) => saveMode.mutate(e.target.value)}
          options={[
            { value: 'solo', label: 'Solo — single user only' },
            { value: 'team', label: 'Team — multi-user, roles, teams & assignments' },
          ]}
        />
        <p className="mt-2 text-xs text-muted">
          In <b>Team mode</b>, you can add team members, assign leads/customers, and configure roles. Switching back to{' '}
          <b>Solo mode</b> requires having only one active user.
        </p>
      </Card>

      <Card title="Role & Permission Matrix (FR-011)">
        <p className="mb-3 text-sm text-muted">
          Module-level and record-level scoping per role (enforced server-side with 403 checks).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-[#778477]">
                <th className="p-2 font-semibold">Role</th>
                <th className="p-2 font-semibold">Leads</th>
                <th className="p-2 font-semibold">Customers</th>
                <th className="p-2 font-semibold">Quotes</th>
                <th className="p-2 font-semibold">Orders</th>
                <th className="p-2 font-semibold">Invoices</th>
                <th className="p-2 font-semibold">Payments</th>
                <th className="p-2 font-semibold">Reports</th>
                <th className="p-2 font-semibold">Settings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PERMISSION_MATRIX_DISPLAY.map((row) => (
                <tr key={row.role} className="hover:bg-surface-2/50">
                  <td className="p-2 font-bold text-[#202820] whitespace-nowrap">{row.role}</td>
                  <td className="p-2 whitespace-nowrap">{row.leads}</td>
                  <td className="p-2 whitespace-nowrap">{row.customers}</td>
                  <td className="p-2 whitespace-nowrap">{row.quotes}</td>
                  <td className="p-2 whitespace-nowrap">{row.orders}</td>
                  <td className="p-2 whitespace-nowrap">{row.invoices}</td>
                  <td className="p-2 whitespace-nowrap">{row.payments}</td>
                  <td className="p-2 whitespace-nowrap">{row.reports}</td>
                  <td className="p-2 whitespace-nowrap font-medium text-[#3D7952]">{row.settings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Modules & Special Access">
        <label className="flex min-h-touch items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showOrders}
            onChange={(e) => saveSection.mutate({ section: 'modules', data: { orders: e.target.checked } })}
          />{' '}
          Show Sales Orders (otherwise orders are created silently when invoicing)
        </label>
        <label className="flex min-h-touch items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={execPayments}
            onChange={(e) => saveSection.mutate({ section: 'permissions', data: { execPaymentsEnabled: e.target.checked } })}
          />{' '}
          Sales executives can record payments
        </label>
      </Card>

      <Card
        title="Your words (FR-003)"
        actions={
          <Button size="sm" busy={saveSection.isPending} onClick={() => saveSection.mutate({ section: 'terminology', data: t })}>
            Save words
          </Button>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Rename things to match how you work, for example “Enquiries” instead of “Leads”. Leave blank to keep the default.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {([
            ['lead', 'Lead'],
            ['leads', 'Leads'],
            ['customer', 'Customer'],
            ['customers', 'Customers'],
            ['quotation', 'Quotation'],
            ['quotations', 'Quotations'],
          ] as const).map(([k, d]) => (
            <TextField key={k} label={d} placeholder={d} value={t[k] ?? ''} onChange={(e) => setT({ ...t, [k]: e.target.value })} />
          ))}
        </div>
      </Card>

      <Card title="First-contact SLA & quotations">
        <div className="grid gap-3 md:grid-cols-3">
          <TextField label="SLA minutes" inputMode="numeric" value={s.minutes} onChange={(e) => setS({ ...s, minutes: e.target.value })} />
          <TextField label="Business hours start" type="time" value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} />
          <TextField label="Business hours end" type="time" value={s.end} onChange={(e) => setS({ ...s, end: e.target.value })} />
          <TextField label="Quote validity (days)" inputMode="numeric" value={s.validDays} onChange={(e) => setS({ ...s, validDays: e.target.value })} />
          <TextField label="Executive discount limit %" inputMode="decimal" value={s.execLimit} onChange={(e) => setS({ ...s, execLimit: e.target.value })} />
          <TextField label="Manager discount limit %" inputMode="decimal" value={s.mgrLimit} onChange={(e) => setS({ ...s, mgrLimit: e.target.value })} />
          <TextField label="Books locked up to" type="date" value={s.lockDate} onChange={(e) => setS({ ...s, lockDate: e.target.value })} />
        </div>
        <Button
          className="mt-4"
          onClick={() => {
            saveSection.mutate({ section: 'sla', data: { minutes: Number(s.minutes), calendar: { days: [1, 2, 3, 4, 5, 6], start: s.start, end: s.end } } });
            saveSection.mutate({ section: 'sales', data: { validDays: Number(s.validDays), discountLimits: { sales_exec: Number(s.execLimit), sales_manager: Number(s.mgrLimit) } } });
            saveSection.mutate({ section: 'finance', data: { lockDate: s.lockDate || null } });
          }}
        >
          Save changes
        </Button>
      </Card>
    </div>
  );
}
