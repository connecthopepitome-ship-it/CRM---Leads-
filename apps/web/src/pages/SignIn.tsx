/** SCR-001 Sign in, change password, 2FA (FR-007 – FR-009, FR-012). */
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Banner, Button, TextField } from '../ui';

export function SignIn() {
  const { user, ready, signIn, verifyMfa, changePassword } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfa, setMfa] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = params.get('next') ?? '/';

  if (ready && user && !user.mustChangePassword) return <Navigate to={next} replace />;

  const run = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError((err as { title?: string }).title ?? 'Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  const mustChange = user?.mustChangePassword;
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-2">
        <p className="mb-1 text-2xl font-bold text-primary">SaleSphere</p>
        {mustChange ? (
          <form onSubmit={run(async () => {
            if (newPw !== newPw2) throw { title: 'The new passwords don’t match.' };
            await changePassword(password, newPw);
            nav(next, { replace: true });
          })} className="flex flex-col gap-4" noValidate>
            <h1 className="text-lg font-semibold">Set a new password</h1>
            <p className="text-sm text-muted">For your security, choose a new password before continuing.</p>
            {error && <Banner tone="danger">{error}</Banner>}
            <TextField label="Current password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters; not your username or a common password." value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} required />
            <Button type="submit" busy={busy}>Save password</Button>
          </form>
        ) : mfa ? (
          <form onSubmit={run(async () => verifyMfa(mfa, code))} className="flex flex-col gap-4" noValidate>
            <h1 className="text-lg font-semibold">Enter your 6-digit code</h1>
            {error && <Banner tone="danger">{error}</Banner>}
            <TextField label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
            <Button type="submit" busy={busy}>Verify</Button>
          </form>
        ) : (
          <form onSubmit={run(async () => {
            const r = await signIn(username, password);
            if (r.mfaToken) setMfa(r.mfaToken);
          })} className="flex flex-col gap-4" noValidate>
            <h1 className="text-lg font-semibold">Sign in</h1>
            {error && <Banner tone="danger">{error}</Banner>}
            <TextField label="Username" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" busy={busy}>Sign in</Button>
            <p className="text-xs text-muted">Forgot your password? Ask your admin to reset it.</p>
          </form>
        )}
      </div>
    </div>
  );
}
