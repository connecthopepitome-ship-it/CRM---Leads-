/** FR-003, FR-004, FR-022: mode, modules, terminology, SLA, sales defaults, permissions, FY lock. */
import { useQuery } from '@tanstack/react-query';
import { get, put } from '../../lib/api';
import { useAction } from '../../features/hooks';
import { Button, Card, SelectField, Skeleton, TextField, toast } from '../../ui';
import { useEffect, useState } from 'react';

export function Preferences() {
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
  const saveMode = useAction((m: string) => put('/admin/mode', { mode: m }), [['settings']], () => toast('Mode changed — reload to update menus'));
  const saveSection = useAction((a: { section: string; data: object }) => put(`/admin/settings/${a.section}`, { data: a.data }), [['settings'], ['app-config']], () => toast('Saved'));
  if (mode.isLoading || sla.isLoading) return <Skeleton rows={5} />;
  const currentMode = (mode.data as any)?.data?.mode ?? (mode.data as any)?.mode ?? 'solo';
  const showOrders = !!((modules.data as any)?.data?.orders ?? (modules.data as any)?.orders ?? true);
  const execPayments = !!((perms.data as any)?.data?.execPaymentsEnabled ?? (perms.data as any)?.execPaymentsEnabled ?? true);
  return (
    <div className="flex flex-col gap-4">
      <Card title="Mode">
        <SelectField label="How do you work?" value={currentMode} onChange={(e) => saveMode.mutate(e.target.value)} options={[{ value: 'solo', label: 'Solo — just me' }, { value: 'team', label: 'Team — users, assignment, approvals' }]} />
      </Card>
      <Card title="Modules">
        <label className="flex min-h-touch items-center gap-2 text-sm"><input type="checkbox" checked={showOrders} onChange={(e) => saveSection.mutate({ section: 'modules', data: { orders: e.target.checked } })} /> Show Sales Orders (otherwise orders are created silently when invoicing)</label>
        <label className="flex min-h-touch items-center gap-2 text-sm"><input type="checkbox" checked={execPayments} onChange={(e) => saveSection.mutate({ section: 'permissions', data: { execPaymentsEnabled: e.target.checked } })} /> Sales executives can record payments</label>
      </Card>
      <Card title="Your words (FR-003)" actions={<Button size="sm" busy={saveSection.isPending} onClick={() => saveSection.mutate({ section: 'terminology', data: t })}>Save words</Button>}>
        <p className="mb-3 text-sm text-muted">Rename things to match how you work, for example “Enquiries” instead of “Leads”. Leave blank to keep the default.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {([['lead', 'Lead'], ['leads', 'Leads'], ['customer', 'Customer'], ['customers', 'Customers'], ['quotation', 'Quotation'], ['quotations', 'Quotations']] as const).map(([k, d]) => (
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
        <Button className="mt-4" onClick={() => {
          saveSection.mutate({ section: 'sla', data: { minutes: Number(s.minutes), calendar: { days: [1, 2, 3, 4, 5, 6], start: s.start, end: s.end } } });
          saveSection.mutate({ section: 'sales', data: { validDays: Number(s.validDays), discountLimits: { sales_exec: Number(s.execLimit), sales_manager: Number(s.mgrLimit) } } });
          saveSection.mutate({ section: 'finance', data: { lockDate: s.lockDate || null } });
        }}>Save changes</Button>
      </Card>
    </div>
  );
}
