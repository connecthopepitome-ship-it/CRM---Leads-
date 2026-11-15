import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Banner, Button, TextField } from '../ui';
import { ArrowRight, Sparkles } from 'lucide-react';

export function SignIn() {
  const { user, ready, signIn, verifyMfa, changePassword } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('ChangeMe!2026');
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
      nav(next, { replace: true });
    } catch (err) {
      setError((err as { title?: string }).title ?? 'Invalid credentials or service offline.');
    } finally {
      setBusy(false);
    }
  };

  const enterDemo = async () => {
    setBusy(true);
    try {
      await signIn('admin', 'ChangeMe!2026');
    } catch {
      // ignore
    } finally {
      setBusy(false);
      nav(next, { replace: true });
    }
  };

  const mustChange = user?.mustChangePassword;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EDF5EA] px-4 font-sans antialiased text-[#202820]">
      <div className="w-full max-w-md rounded-3xl border border-[#DCE7D9] bg-white p-8 shadow-md">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#233D2D] p-2 text-white shadow-xs">
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" />
              <path d="M12 3a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9" />
              <path d="M7 12a5 5 0 0 1 5-5" stroke="white" strokeWidth="2.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#202820] leading-tight">SaleSphere</h1>
            <p className="text-xs text-[#778477]">Enterprise CRM for Growing Businesses</p>
          </div>
        </div>

        {mustChange ? (
          <form
            onSubmit={run(async () => {
              if (newPw !== newPw2) throw { title: 'The new passwords don’t match.' };
              await changePassword(password, newPw);
              nav(next, { replace: true });
            })}
            className="flex flex-col gap-4"
            noValidate
          >
            <h2 className="text-base font-bold text-[#202820]">Set a new password</h2>
            <p className="text-xs text-[#778477]">For your security, choose a new password before continuing.</p>
            {error && <Banner tone="danger">{error}</Banner>}
            <TextField label="Current password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} required />
            <Button type="submit" busy={busy} className="bg-[#3D7952] hover:bg-[#2F5E3F] text-white">Save password</Button>
          </form>
        ) : mfa ? (
          <form onSubmit={run(async () => verifyMfa(mfa, code))} className="flex flex-col gap-4" noValidate>
            <h2 className="text-base font-bold text-[#202820]">Enter your 6-digit code</h2>
            {error && <Banner tone="danger">{error}</Banner>}
            <TextField label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
            <Button type="submit" busy={busy} className="bg-[#3D7952] hover:bg-[#2F5E3F] text-white">Verify</Button>
          </form>
        ) : (
          <form
            onSubmit={run(async () => {
              const r = await signIn(username, password);
              if (r.mfaToken) setMfa(r.mfaToken);
            })}
            className="flex flex-col gap-4"
            noValidate
          >
            <div>
              <h2 className="text-base font-bold text-[#202820]">Welcome back</h2>
              <p className="text-xs text-[#778477] mt-0.5">Enter your credentials to access your pipeline.</p>
            </div>

            {error && <Banner tone="danger">{error}</Banner>}

            <TextField
              label="Username or Email"
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              busy={busy}
              className="w-full mt-1 bg-[#3D7952] hover:bg-[#2F5E3F] text-white rounded-xl py-2.5 font-semibold transition-colors"
            >
              Sign In
            </Button>

            {/* Quick Demo Mode Action */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#DCE7D9]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-semibold text-[#778477]">
                <span className="bg-white px-2">or quick explore</span>
              </div>
            </div>

            <button
              type="button"
              onClick={enterDemo}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#CFE5CB] bg-[#E3EFDF] py-2.5 px-4 text-xs font-semibold text-[#233D2D] hover:bg-[#D5E8D1] transition-colors"
            >
              <Sparkles size={15} className="text-[#3D7952]" />
              <span>Explore Demo as Owner Admin</span>
              <ArrowRight size={14} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
