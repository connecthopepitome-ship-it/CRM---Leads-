/** SCR-030 Users, teams, sessions, support access (FR-010, FR-011, FR-014, FR-089). */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get, patch, post, put } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dateTime } from '../../lib/format';
import { useAction } from '../../features/hooks';
import { Badge, Banner, Button, Card, Dialog, SelectField, Table, TextField, toast } from '../../ui';

type U = { id: string; username: string; fullName: string; role: string; roleLabel: string; status: string; lastLoginAt: string | null; isSupport: boolean };
const ROLES = [['admin', 'Admin'], ['sales_manager', 'Sales Manager'], ['sales_exec', 'Sales Executive'], ['accounts', 'Accounts'], ['project_manager', 'Project Manager'], ['viewer', 'Viewer / Auditor']];

export function Users() {
  const { perm, mode } = useAuth();
  const users = useQuery({ queryKey: ['users'], queryFn: () => get<{ items: U[] }>('/admin/users').then((r) => r.items) });
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => get<{ items: { id: string; name: string; managerId: string; memberIds: string[] }[] }>('/admin/teams').then((r) => r.items), enabled: mode === 'team' });
  const [create, setCreate] = useState(false);
  const [temp, setTemp] = useState<{ username: string; password: string } | null>(null);
  const [nu, setNu] = useState({ username: '', fullName: '', role: 'sales_exec' });
  const [support, setSupport] = useState<{ password: string; expiresAt: string } | null>(null);
  const [team, setTeam] = useState({ name: '', managerId: '', memberIds: [] as string[] });
  const write = perm('users:write');
  const add = useAction(() => post<{ temporaryPassword: string }>('/admin/users', nu), [['users']], (r) => {
    setTemp({ username: nu.username, password: r.temporaryPassword });
    setCreate(false);
  });
  const act = useAction((a: { id: string; path: string; body?: object }) => post<{ temporaryPassword?: string }>(`/admin/users/${a.id}/${a.path}`, a.body ?? {}), [['users']], (r) => (r?.temporaryPassword ? setTemp({ username: '', password: r.temporaryPassword }) : toast('Done')));
  const role = useAction((a: { id: string; role: string }) => patch(`/admin/users/${a.id}`, { role: a.role }), [['users']], () => toast('Role updated'));
  const sup = useAction((days: number) => put<{ oneTimePassword: string | null; expiresAt: string | null }>('/admin/support-access', { enabled: days > 0, days }), [['users']], (r) => (r.oneTimePassword ? setSupport({ password: r.oneTimePassword, expiresAt: r.expiresAt ?? '' }) : toast('Support access disabled')));
  const addTeam = useAction(() => post('/admin/teams', team), [['teams']], () => toast('Team created'));
  const all = users.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      {temp && <Banner tone="success" action={<Button size="sm" variant="secondary" onClick={() => setTemp(null)}>Done</Button>}>Temporary password{temp.username ? ` for ${temp.username}` : ''}: <code className="font-semibold">{temp.password}</code> — share it securely; they must change it at first sign-in.</Banner>}
      {mode === 'solo' && <Banner tone="info">Solo mode allows one user. Switch to Team mode in “Mode, SLA & modules” to add people.</Banner>}
      <Card title="Users" actions={write && mode === 'team' && <Button size="sm" onClick={() => setCreate(true)}>Add user</Button>}>
        <Table<U> rows={all.filter((u) => !u.isSupport)} columns={[
          { key: 'fullName', label: 'Name' },
          { key: 'username', label: 'Username' },
          { key: 'role', label: 'Role', render: (u) => (write ? <select aria-label={`Role for ${u.fullName}`} className="rounded-sm border border-border-input bg-surface p-1 text-sm" value={u.role} onChange={(e) => role.mutate({ id: u.id, role: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> : u.roleLabel) },
          { key: 'status', label: 'Status', render: (u) => <Badge status={u.status} /> },
          { key: 'last', label: 'Last sign-in', render: (u) => dateTime(u.lastLoginAt) },
          { key: 'actions', label: '', render: (u) => write ? (
            <span className="flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: u.id, path: 'reset-password' })}>Reset password</Button>
              <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: u.id, path: 'force-logout' })}>Sign out everywhere</Button>
              {u.status === 'active' ? <Button size="sm" variant="ghost" onClick={() => {
                const to = all.find((x) => x.id !== u.id && x.status === 'active' && !x.isSupport)?.id;
                act.mutate({ id: u.id, path: 'deactivate', body: { reassignTo: to } });
              }}>Deactivate</Button> : <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: u.id, path: 'reactivate' })}>Reactivate</Button>}
            </span>
          ) : null },
        ]} />
      </Card>
      {mode === 'team' && (
        <Card title="Teams">
          <ul className="mb-3 text-sm">{teams.data?.map((t) => <li key={t.id} className="border-b border-border py-1">{t.name} — manager {all.find((u) => u.id === t.managerId)?.fullName ?? t.managerId}, {t.memberIds?.length ?? 0} members</li>)}</ul>
          {write && (
            <div className="grid gap-2 md:grid-cols-3">
              <TextField label="Team name" value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} />
              <SelectField label="Manager" value={team.managerId} onChange={(e) => setTeam({ ...team, managerId: e.target.value })} placeholder="Choose…" options={all.filter((u) => u.role === 'sales_manager').map((u) => ({ value: u.id, label: u.fullName }))} />
              <fieldset className="text-sm"><legend className="font-medium">Members</legend>{all.filter((u) => u.role === 'sales_exec').map((u) => <label key={u.id} className="flex min-h-touch items-center gap-2"><input type="checkbox" checked={team.memberIds.includes(u.id)} onChange={(e) => setTeam({ ...team, memberIds: e.target.checked ? [...team.memberIds, u.id] : team.memberIds.filter((x) => x !== u.id) })} />{u.fullName}</label>)}</fieldset>
              <Button disabled={!team.name || !team.managerId} onClick={() => addTeam.mutate(undefined)}>Create team</Button>
            </div>
          )}
        </Card>
      )}
      {perm('privacy:execute') && (
        <Card title="Support access">
          <p className="mb-3 text-sm text-muted">Let the SaleSphere product owner sign in to help you, for up to 7 days. Everything they do is audited as “Support”.</p>
          {support && <div className="mb-3"><Banner tone="warning">Support password (share once): <code className="font-semibold">{support.password}</code> · until {dateTime(support.expiresAt)}</Banner></div>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => sup.mutate(2)}>Enable for 2 days</Button>
            <Button variant="secondary" onClick={() => sup.mutate(7)}>Enable for 7 days</Button>
            <Button variant="ghost" onClick={() => sup.mutate(0)}>Disable</Button>
          </div>
        </Card>
      )}
      <Dialog open={create} onClose={() => setCreate(false)} title="Add user" footer={<Button busy={add.isPending} onClick={() => add.mutate(undefined)}>Create user</Button>}>
        <div className="flex flex-col gap-3">
          <TextField label="Full name" required value={nu.fullName} onChange={(e) => setNu({ ...nu, fullName: e.target.value })} />
          <TextField label="Username" required hint="3–32 characters: a–z 0–9 . _ -" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value.toLowerCase() })} />
          <SelectField label="Role" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })} options={ROLES.map(([v, l]) => ({ value: v!, label: l! }))} />
        </div>
      </Dialog>
    </div>
  );
}
