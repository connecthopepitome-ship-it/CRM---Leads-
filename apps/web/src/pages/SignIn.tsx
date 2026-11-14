import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, DEMO_OWNER } from '../lib/auth';
import { Banner, Button, TextField } from '../ui';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

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
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6fb] px-4 font-sans antialiased text-slate-800">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-8 shadow-xl shadow-slate-200/50">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 p-2 shadow-md shadow-indigo-500/20">
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.4" />
              <path d="M12 3a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9" />
              <path d="M7 12a5 5 0 0 1 5-5" stroke="white" strokeWidth="2.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">SaleSphere</h1>
            <p className="text-xs text-slate-500">Enterprise CRM for Growing Businesses</p>
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
            <h2 className="text-base font-bold text-slate-900">Set a new password</h2>
            <p className="text-xs text-slate-500">For your security, choose a new password before continuing.</p>
            {error && <Banner tone="danger">{error}</Banner>}
            <TextField label="Current password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} required />
            <Button type="submit" busy={busy}>Save password</Button>
          </form>
        ) : mfa ? (
          <form onSubmit={run(async () => verifyMfa(mfa, code))} className="flex flex-col gap-4" noValidate>
            <h2 className="text-base font-bold text-slate-900">Enter your 6-digit code</h2>
            {error && <Banner tone="danger">{error}</Banner>}
            <TextField label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
            <Button type="submit" busy={busy}>Verify</Button>
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
              <h2 className="text-base font-bold text-slate-900">Welcome back</h2>
              <p className="text-xs text-slate-500 mt-0.5">Enter your credentials to access your pipeline.</p>
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

            <Button type="submit" busy={busy} className="w-full mt-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
              Sign In
            </Button>

            {/* Quick Demo Mode Action */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-semibold text-slate-400">
                <span className="bg-white px-2">or quick explore</span>
              </div>
            </div>

            <button
              type="button"
              onClick={enterDemo}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/50 py-2.5 px-4 text-xs font-semibold text-indigo-700 hover:bg-indigo-100/70 hover:border-indigo-300 transition-colors"
            >
              <Sparkles size={15} />
              <span>Explore Demo as Owner Admin</span>
              <ArrowRight size={14} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
