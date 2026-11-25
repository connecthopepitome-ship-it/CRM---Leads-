/** SCR-030 Users, teams, sessions, support access (FR-010, FR-011, FR-014, FR-089). */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { del, get, patch, post, put } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dateTime } from '../../lib/format';
import { useAction } from '../../features/hooks';
import { Badge, Banner, Button, Card, Dialog, EmptyState, ErrorState, SelectField, Skeleton, Table, TextField, toast } from '../../ui';
import { errorToast } from '../../ui/toast';

type U = {
  id: string;
  username: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  role: string;
  roleLabel: string;
  status: string;
  teamId?: string | null;
  lastLoginAt: string | null;
  isSupport: boolean;
};

const ROLES = [
  ['admin', 'Admin'],
  ['sales_manager', 'Sales Manager'],
  ['sales_exec', 'Sales Executive'],
  ['accounts', 'Accounts'],
  ['project_manager', 'Project Manager'],
  ['viewer', 'Viewer / Auditor'],
];

export function Users() {
  const { perm, mode, user: currentUser } = useAuth();
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () =>
      get<any>('/admin/users').then((r) => {
        if (Array.isArray(r)) return r as U[];
        if (Array.isArray(r?.items)) return r.items as U[];
        return [] as U[];
      }),
  });

  const teams = useQuery({
    queryKey: ['teams'],
    queryFn: () =>
      get<any>('/admin/teams').then((r) => {
        if (Array.isArray(r)) return r;
        if (Array.isArray(r?.items)) return r.items;
        return [];
      }),
    enabled: mode === 'team',
  });

  const [create, setCreate] = useState(false);
  const [temp, setTemp] = useState<{ username: string; password: string; inviteLink?: string } | null>(null);
  const [nu, setNu] = useState({ username: '', fullName: '', email: '', phone: '', role: 'sales_exec', teamId: '' });
  const [support, setSupport] = useState<{ password: string; expiresAt: string } | null>(null);
  const [team, setTeam] = useState({ name: '', managerId: '', memberIds: [] as string[] });
  const [editingTeam, setEditingTeam] = useState<{ id: string; name: string; managerId: string; memberIds: string[] } | null>(null);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<string | null>(null);

  // Role change confirmation
  const [roleConfirm, setRoleConfirm] = useState<{ user: U; newRole: string } | null>(null);
  // Deactivate confirmation
  const [deactivateConfirm, setDeactivateConfirm] = useState<{ user: U; reassignTo: string } | null>(null);

  const write = perm('users:write');

  const add = useAction(
    () => post<{ temporaryPassword: string; inviteLink?: string }>('/admin/users', nu),
    [['users']],
    (r) => {
      setTemp({ username: nu.username, password: r.temporaryPassword, inviteLink: r.inviteLink });
      setNu({ username: '', fullName: '', email: '', phone: '', role: 'sales_exec', teamId: '' });
      setCreate(false);
      toast('User created successfully');
    }
  );

  const act = useAction(
    (a: { id: string; path: string; body?: object }) =>
      post<{ temporaryPassword?: string }>(`/admin/users/${a.id}/${a.path}`, a.body ?? {}),
    [['users'], ['leads'], ['follow-ups']],
    (r) => {
      if (r?.temporaryPassword) {
        setTemp({ username: '', password: r.temporaryPassword });
        toast('Password reset successfully');
      } else {
        toast('Action completed successfully');
      }
    }
  );

  const roleMutation = useAction(
    (a: { id: string; role: string }) => patch(`/admin/users/${a.id}`, { role: a.role }),
    [['users']],
    () => {
      toast('Role updated successfully');
      setRoleConfirm(null);
    }
  );

  const sup = useAction(
    (days: number) =>
      put<{ oneTimePassword: string | null; expiresAt: string | null }>('/admin/support-access', { enabled: days > 0, days }),
    [['users']],
    (r) => (r.oneTimePassword ? setSupport({ password: r.oneTimePassword, expiresAt: r.expiresAt ?? '' }) : toast('Support access disabled'))
  );

  const addTeam = useAction(
    () => post('/admin/teams', team),
    [['teams'], ['users']],
    () => {
      setTeam({ name: '', managerId: '', memberIds: [] });
      toast('Team created successfully');
    }
  );

  const updateTeam = useAction(
    () => patch(`/admin/teams/${editingTeam?.id}`, editingTeam),
    [['teams'], ['users']],
    () => {
      setEditingTeam(null);
      toast('Team updated successfully');
    }
  );

  const removeTeam = useAction(
    (id: string) => del(`/admin/teams/${id}`),
    [['teams'], ['users']],
    () => {
      setConfirmDeleteTeam(null);
      toast('Team deleted successfully');
    }
  );

  if (users.isLoading) return <Skeleton rows={5} />;
  if (users.isError) return <ErrorState error={users.error} retry={() => void users.refetch()} />;

  const all = Array.isArray(users.data) ? users.data : [];
  const activeUsers = all.filter((u) => u.status === 'active' && !u.isSupport);

  return (
    <div className="flex flex-col gap-4">
      {temp && (
        <Banner tone="success" action={<Button size="sm" variant="secondary" onClick={() => setTemp(null)}>Done</Button>}>
          Temporary password{temp.username ? ` for ${temp.username}` : ''}:{' '}
          <code className="font-semibold text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded">{temp.password}</code>
          {temp.inviteLink && (
            <span className="block mt-1 text-xs text-emerald-800">
              Invite link: <code className="font-mono">{temp.inviteLink}</code>
            </span>
          )}
          <span className="block mt-0.5 text-xs text-emerald-700">
            Share this once securely; they must change it at first sign-in.
          </span>
        </Banner>
      )}

      {mode === 'solo' && (
        <Banner tone="info">
          Solo mode allows one user. Switch to Team mode in “Mode, SLA & modules” to add users, teams, and assignments.
        </Banner>
      )}

      <Card
        title="Users"
        actions={
          write && mode === 'team' && (
            <Button size="sm" onClick={() => setCreate(true)}>
              Add user
            </Button>
          )
        }
      >
        <Table<U>
          rows={all.filter((u) => !u.isSupport)}
          columns={[
            { key: 'fullName', label: 'Name' },
            { key: 'username', label: 'Username' },
            {
              key: 'role',
              label: 'Role',
              render: (u) =>
                write ? (
                  <select
                    aria-label={`Role for ${u.fullName}`}
                    className="rounded-sm border border-border-input bg-surface p-1 text-sm font-medium"
                    value={u.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      if (newRole !== u.role) {
                        setRoleConfirm({ user: u, newRole });
                      }
                    }}
                  >
                    {ROLES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                ) : (
                  u.roleLabel || u.role
                ),
            },
            { key: 'status', label: 'Status', render: (u) => <Badge status={u.status} /> },
            { key: 'last', label: 'Last sign-in', render: (u) => dateTime(u.lastLoginAt) },
            {
              key: 'actions',
              label: '',
              render: (u) =>
                write ? (
                  <span className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: u.id, path: 'reset-password' })}>
                      Reset password
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: u.id, path: 'force-logout' })}>
                      Sign out everywhere
                    </Button>
                    {u.status === 'active' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-amber-700 hover:text-amber-800"
                        onClick={() => {
                          const fallbackReassign = activeUsers.find((x) => x.id !== u.id)?.id || '';
                          setDeactivateConfirm({ user: u, reassignTo: fallbackReassign });
                        }}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-emerald-700 hover:text-emerald-800"
                        onClick={() => act.mutate({ id: u.id, path: 'reactivate' })}
                      >
                        Reactivate
                      </Button>
                    )}
                  </span>
                ) : null,
            },
          ]}
        />
      </Card>

      {/* Role Change Confirmation Dialog */}
      {roleConfirm && (
        <Dialog
          open
          onClose={() => setRoleConfirm(null)}
          title="Change User Role"
          footer={
            <>
              <Button variant="secondary" onClick={() => setRoleConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                busy={roleMutation.isPending}
                onClick={() => roleMutation.mutate({ id: roleConfirm.user.id, role: roleConfirm.newRole })}
              >
                Confirm Role Change
              </Button>
            </>
          }
        >
          <p className="text-sm">
            Are you sure you want to change the role of <b>{roleConfirm.user.fullName}</b> from{' '}
            <b>{ROLES.find(([k]) => k === roleConfirm.user.role)?.[1] || roleConfirm.user.role}</b> to{' '}
            <b>{ROLES.find(([k]) => k === roleConfirm.newRole)?.[1] || roleConfirm.newRole}</b>?
          </p>
          <p className="text-xs text-muted mt-2">
            This will update their system permissions, module access, and approval privileges immediately.
          </p>
        </Dialog>
      )}

      {/* Deactivate User Confirmation Dialog */}
      {deactivateConfirm && (
        <Dialog
          open
          onClose={() => setDeactivateConfirm(null)}
          title="Deactivate User"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeactivateConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                busy={act.isPending}
                onClick={() => {
                  act.mutate({
                    id: deactivateConfirm.user.id,
                    path: 'deactivate',
                    body: { reassignTo: deactivateConfirm.reassignTo || undefined },
                  });
                  setDeactivateConfirm(null);
                }}
              >
                Deactivate User
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Are you sure you want to deactivate <b>{deactivateConfirm.user.fullName}</b>? Their active sessions will be
              revoked immediately and they will not be able to sign in.
            </p>
            {activeUsers.filter((x) => x.id !== deactivateConfirm.user.id).length > 0 && (
              <SelectField
                label="Reassign open leads and follow-ups to:"
                value={deactivateConfirm.reassignTo}
                onChange={(e) => setDeactivateConfirm({ ...deactivateConfirm, reassignTo: e.target.value })}
                options={[
                  { value: '', label: 'Leave unassigned' },
                  ...activeUsers
                    .filter((x) => x.id !== deactivateConfirm.user.id)
                    .map((x) => ({ value: x.id, label: `${x.fullName} (${x.username})` })),
                ]}
              />
            )}
          </div>
        </Dialog>
      )}

      {/* Teams Management */}
      {mode === 'team' && (
        <Card title="Teams">
          <div className="space-y-3 mb-4">
            {teams.data && teams.data.length > 0 ? (
              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-surface">
                {teams.data.map((t: any) => {
                  const manager = all.find((u) => u.id === t.managerId);
                  const memberCount = t.memberIds?.length ?? 0;
                  const memberNames = (t.memberIds || [])
                    .map((mid: string) => all.find((u) => u.id === mid)?.fullName || mid)
                    .join(', ');

                  return (
                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#202820]">{t.name}</span>
                          <span className="text-xs text-muted">
                            · Manager: <b>{manager?.fullName ?? t.managerId}</b>
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-0.5">
                          {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          {memberNames ? `: ${memberNames}` : ''}
                        </p>
                      </div>
                      {write && (
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditingTeam({
                                id: t.id,
                                name: t.name,
                                managerId: t.managerId,
                                memberIds: t.memberIds || [],
                              })
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setConfirmDeleteTeam(t.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted">No teams created yet.</p>
            )}
          </div>

          {write && (
            <div className="grid gap-3 md:grid-cols-3 border-t border-border pt-4">
              <TextField
                label="Team name"
                placeholder="e.g. Enterprise Sales"
                value={team.name}
                onChange={(e) => setTeam({ ...team, name: e.target.value })}
              />
              <SelectField
                label="Manager"
                value={team.managerId}
                onChange={(e) => setTeam({ ...team, managerId: e.target.value })}
                placeholder="Choose manager…"
                options={all
                  .filter((u) => u.role === 'sales_manager' || u.role === 'admin')
                  .map((u) => ({ value: u.id, label: `${u.fullName} (${u.roleLabel})` }))}
              />
              <fieldset className="text-sm">
                <legend className="font-medium text-xs text-muted mb-1">Members</legend>
                <div className="max-h-28 overflow-y-auto space-y-1 p-1 border border-border-input rounded-md bg-surface">
                  {all
                    .filter((u) => u.role === 'sales_exec' || u.role === 'viewer')
                    .map((u) => (
                      <label key={u.id} className="flex min-h-touch items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={team.memberIds.includes(u.id)}
                          onChange={(e) =>
                            setTeam({
                              ...team,
                              memberIds: e.target.checked
                                ? [...team.memberIds, u.id]
                                : team.memberIds.filter((x) => x !== u.id),
                            })
                          }
                        />
                        {u.fullName} ({u.roleLabel})
                      </label>
                    ))}
                </div>
              </fieldset>
              <div className="md:col-span-3">
                <Button disabled={!team.name || !team.managerId} busy={addTeam.isPending} onClick={() => addTeam.mutate(undefined)}>
                  Create team
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Edit Team Dialog */}
      {editingTeam && (
        <Dialog
          open
          onClose={() => setEditingTeam(null)}
          title="Edit Team"
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditingTeam(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!editingTeam.name || !editingTeam.managerId}
                busy={updateTeam.isPending}
                onClick={() => updateTeam.mutate(undefined)}
              >
                Save Changes
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <TextField
              label="Team name"
              value={editingTeam.name}
              onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
            />
            <SelectField
              label="Manager"
              value={editingTeam.managerId}
              onChange={(e) => setEditingTeam({ ...editingTeam, managerId: e.target.value })}
              options={all
                .filter((u) => u.role === 'sales_manager' || u.role === 'admin')
                .map((u) => ({ value: u.id, label: `${u.fullName} (${u.roleLabel})` }))}
            />
            <fieldset className="text-sm">
              <legend className="font-medium text-xs text-muted mb-1">Members</legend>
              <div className="max-h-36 overflow-y-auto space-y-1 p-2 border border-border-input rounded-md bg-surface">
                {all
                  .filter((u) => u.role === 'sales_exec' || u.role === 'viewer')
                  .map((u) => (
                    <label key={u.id} className="flex min-h-touch items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={editingTeam.memberIds.includes(u.id)}
                        onChange={(e) =>
                          setEditingTeam({
                            ...editingTeam,
                            memberIds: e.target.checked
                              ? [...editingTeam.memberIds, u.id]
                              : editingTeam.memberIds.filter((x) => x !== u.id),
                          })
                        }
                      />
                      {u.fullName} ({u.roleLabel})
                    </label>
                  ))}
              </div>
            </fieldset>
          </div>
        </Dialog>
      )}

      {/* Confirm Delete Team */}
      {confirmDeleteTeam && (
        <Dialog
          open
          onClose={() => setConfirmDeleteTeam(null)}
          title="Delete Team"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmDeleteTeam(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                busy={removeTeam.isPending}
                onClick={() => removeTeam.mutate(confirmDeleteTeam)}
              >
                Delete Team
              </Button>
            </>
          }
        >
          <p className="text-sm">
            Are you sure you want to delete this team? Members will be unassigned from the team.
          </p>
        </Dialog>
      )}

      {/* Support Access */}
      {perm('privacy:execute') && (
        <Card title="Support access">
          <p className="mb-3 text-sm text-muted">
            Let the SaleSphere product owner sign in to help you, for up to 7 days. Everything they do is audited as “Support”.
          </p>
          {support && (
            <div className="mb-3">
              <Banner tone="warning">
                Support password (share once): <code className="font-semibold">{support.password}</code> · until{' '}
                {dateTime(support.expiresAt)}
              </Banner>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => sup.mutate(2)}>
              Enable for 2 days
            </Button>
            <Button variant="secondary" onClick={() => sup.mutate(7)}>
              Enable for 7 days
            </Button>
            <Button variant="ghost" onClick={() => sup.mutate(0)}>
              Disable
            </Button>
          </div>
        </Card>
      )}

      {/* Add User Dialog */}
      <Dialog
        open={create}
        onClose={() => setCreate(false)}
        title="Add User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreate(false)}>
              Cancel
            </Button>
            <Button
              busy={add.isPending}
              disabled={!nu.fullName || !nu.username || !nu.role}
              onClick={() => add.mutate(undefined)}
            >
              Create User
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField
            label="Full name"
            required
            placeholder="e.g. Ramesh Kumar"
            value={nu.fullName}
            onChange={(e) => setNu({ ...nu, fullName: e.target.value })}
          />
          <TextField
            label="Username"
            required
            hint="3–32 characters: a–z 0–9 . _ -"
            placeholder="e.g. ramesh.k"
            value={nu.username}
            onChange={(e) => setNu({ ...nu, username: e.target.value.toLowerCase() })}
          />
          <TextField
            label="Email address"
            type="email"
            placeholder="e.g. ramesh@company.in"
            value={nu.email}
            onChange={(e) => setNu({ ...nu, email: e.target.value })}
          />
          <TextField
            label="Mobile number"
            type="tel"
            placeholder="e.g. +91 98450 12345"
            value={nu.phone}
            onChange={(e) => setNu({ ...nu, phone: e.target.value })}
          />
          <SelectField
            label="Role"
            value={nu.role}
            onChange={(e) => setNu({ ...nu, role: e.target.value })}
            options={ROLES.map(([v, l]) => ({ value: v!, label: l! }))}
          />
          {teams.data && teams.data.length > 0 && (
            <SelectField
              label="Team"
              value={nu.teamId}
              onChange={(e) => setNu({ ...nu, teamId: e.target.value })}
              placeholder="Select team (optional)…"
              options={[
                { value: '', label: 'None' },
                ...teams.data.map((t: any) => ({ value: t.id, label: t.name })),
              ]}
            />
          )}
        </div>
      </Dialog>
    </div>
  );
}
