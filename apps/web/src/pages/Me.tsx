/** SCR-033 My account: profile, password, 2FA, login history, notification preferences, theme (FR-009, FR-012, FR-082). */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { del, get, post, put } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dateTime } from '../lib/format';
import { useAction } from '../features/hooks';
import { Button, Card, KeyValue, PageHeader, Select, TextField, toast } from '../ui';
import { errorToast } from '../ui/toast';

export default function Me() {
  const { user, changePassword } = useAuth();
  const history = useQuery({ queryKey: ['login-history'], queryFn: () => get<{ items: { at: string; action: string; ipMasked: string }[] }>('/me/login-history') });
  const prefs = useQuery({ queryKey: ['prefs'], queryFn: () => get<{ events: { id: string; label: string; push: boolean }[] }>('/me/notification-prefs') });
  const savePrefs = useAction((push: Record<string, boolean>) => put('/me/notification-prefs', { push }), [['prefs']], () => toast('Preferences saved'));
  const [pw, setPw] = useState({ current: '', next: '' });
  const [totp, setTotp] = useState<{ otpauthUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [theme, setTheme] = useState(document.documentElement.dataset.theme ?? 'light');

  const enablePush = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return toast('Notifications are blocked in your browser settings.', 'danger');
      toast('Push notifications enabled on this device');
    } catch (e) {
      errorToast(e);
    }
  };

  return (
    <>
      <PageHeader title="My account" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profile">
          <KeyValue items={[['Name', user?.fullName], ['Username', user?.username], ['Role', user?.roleLabel]]} />
          <label className="mt-3 flex items-center gap-2 text-sm">Theme
            <Select className="w-40" value={theme} onChange={(e) => { setTheme(e.target.value); document.documentElement.dataset.theme = e.target.value; localStorage.setItem('ss-theme', e.target.value); }}>
              <option value="light">Light</option><option value="dark">Dark</option>
            </Select>
          </label>
        </Card>
        <Card title="Change password">
          <div className="flex flex-col gap-3">
            <TextField label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <Button onClick={() => void changePassword(pw.current, pw.next).then(() => { toast('Password changed'); setPw({ current: '', next: '' }); }).catch(errorToast)}>Change password</Button>
          </div>
        </Card>
        <Card title="Two-step verification">
          {user?.mfaEnabled ? (
            <Button variant="secondary" onClick={() => void del('/me/2fa').then(() => toast('2-step verification turned off')).catch(errorToast)}>Turn off</Button>
          ) : totp ? (
            <div className="flex flex-col gap-3 text-sm">
              <p>Add this key to your authenticator app, then enter the 6-digit code.</p>
              <code className="break-all rounded-sm bg-surface-2 p-2">{totp.secret}</code>
              <TextField label="Code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
              <Button onClick={() => void post('/me/2fa/enable', { code }).then(() => toast('2-step verification is on')).catch(errorToast)}>Turn on</Button>
            </div>
          ) : <Button variant="secondary" onClick={() => void post<{ otpauthUrl: string; secret: string }>('/me/2fa/setup').then(setTotp).catch(errorToast)}>Set up</Button>}
        </Card>
        <Card title="Notifications">
          <div id="notifications" className="flex flex-col gap-2 text-sm">
            <Button variant="secondary" onClick={() => void enablePush()}>Allow push notifications on this device</Button>
            {(prefs.data?.events ?? []).map((e) => (
              <label key={e.id} className="flex min-h-touch items-center justify-between gap-3">
                <span>{e.label}</span>
                <input type="checkbox" className="h-5 w-5" checked={e.push} onChange={(ev) => savePrefs.mutate(Object.fromEntries((prefs.data?.events ?? []).map((x) => [x.id, x.id === e.id ? ev.target.checked : x.push])))} />
              </label>
            ))}
          </div>
        </Card>
        <Card title="Recent sign-ins" className="lg:col-span-2">
          <ul className="text-sm">{(history.data?.items ?? []).map((h, i) => <li key={i} className="flex justify-between border-b border-border py-1"><span>{h.action.replace('auth.', '').replace('_', ' ')}</span><span className="text-muted">{dateTime(h.at)} · {h.ipMasked}</span></li>)}</ul>
        </Card>
      </div>
    </>
  );
}
