import { useState, useEffect, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Banner, Button, TextField } from '../ui';
import { ArrowRight, Eye, EyeOff, Lock, Sparkles, User, KeyRound, ShieldCheck } from 'lucide-react';

export function SignIn() {
  const { user, ready, signIn, verifyMfa, changePassword } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();

  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('ss_remember_username') || 'admin';
    } catch {
      return 'admin';
    }
  });
  const [password, setPassword] = useState('ChangeMe!2026');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem('ss_remember_me') === 'true';
    } catch {
      return true;
    }
  });

  const [mfa, setMfa] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rawNext = params.get('next') ?? '/';
  const next = rawNext && !rawNext.startsWith('/sign-in') ? rawNext : '/';

  if (ready && user && !user.mustChangePassword) return <Navigate to={next} replace />;

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    try {
      localStorage.setItem('ss_remember_me', String(checked));
      if (checked) {
        localStorage.setItem('ss_remember_username', username);
      } else {
        localStorage.removeItem('ss_remember_username');
      }
    } catch {
      // ignore
    }
  };

  const run = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (rememberMe) {
        localStorage.setItem('ss_remember_username', username);
      }
      await fn();
      nav(next, { replace: true });
    } catch (err) {
      setError((err as { title?: string; message?: string }).title || (err as { message?: string }).message || 'Invalid credentials or service offline.');
    } finally {
      setBusy(false);
    }
  };

  const enterDemo = async () => {
    setBusy(true);
    setError(null);
    localStorage.removeItem('ss-signed-out');
    localStorage.setItem('ss-demo-active', 'true');
    try {
      await signIn('admin', 'ChangeMe!2026');
    } catch {
      // ignore
    } finally {
      setBusy(false);
      nav(next, { replace: true });
    }
  };

  const fillDemoCreds = () => {
    setUsername('admin');
    setPassword('ChangeMe!2026');
  };

  const mustChange = user?.mustChangePassword;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#EDF5EA] px-4 py-8 sm:px-6 lg:px-8 text-[#202820] antialiased">
      <div className="w-full max-w-[420px] space-y-6">
        {/* Brand Card */}
        <div className="rounded-3xl border border-[#DCE7D9] bg-white p-6 sm:p-8 shadow-sm">
          {/* Logo & Product Heading */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#233D2D] p-2.5 text-white shadow-xs">
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" />
                <path d="M12 3a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9" />
                <path d="M7 12a5 5 0 0 1 5-5" stroke="white" strokeWidth="2.5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[#202820] leading-none">SaleSphere</h1>
                <span className="rounded-full bg-[#E3EFDF] px-2 py-0.5 text-[10px] font-bold text-[#233D2D]">v2.6</span>
              </div>
              <p className="text-xs text-[#778477] mt-1 font-medium">Enterprise CRM for Growing Businesses</p>
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
              <div>
                <h2 className="text-base font-bold text-[#202820]">Set a new password</h2>
                <p className="text-xs text-[#778477] mt-0.5">For your security, choose a new password before continuing.</p>
              </div>
              {error && <Banner tone="danger">{error}</Banner>}
              <TextField
                label="Current password"
                type="password"
                autoComplete="current-password"
                leadingIcon={<Lock size={16} />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <TextField
                label="New password"
                type="password"
                autoComplete="new-password"
                leadingIcon={<KeyRound size={16} />}
                hint="At least 10 characters."
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
              />
              <TextField
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                leadingIcon={<KeyRound size={16} />}
                value={newPw2}
                onChange={(e) => setNewPw2(e.target.value)}
                required
              />
              <Button type="submit" busy={busy} className="w-full mt-1 bg-[#3D7952] hover:bg-[#233D2D] text-white">
                Save Password
              </Button>
            </form>
          ) : mfa ? (
            <form onSubmit={run(async () => verifyMfa(mfa, code))} className="flex flex-col gap-4" noValidate>
              <div>
                <h2 className="text-base font-bold text-[#202820]">Two-Factor Authentication</h2>
                <p className="text-xs text-[#778477] mt-0.5">Enter the 6-digit verification code from your authenticator app.</p>
              </div>
              {error && <Banner tone="danger">{error}</Banner>}
              <TextField
                label="Authenticator code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                leadingIcon={<ShieldCheck size={16} />}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <Button type="submit" busy={busy} className="w-full mt-1 bg-[#3D7952] hover:bg-[#233D2D] text-white">
                Verify & Continue
              </Button>
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
                leadingIcon={<User size={16} />}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
              />

              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                leadingIcon={<Lock size={16} />}
                trailingAction={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="p-1.5 text-[#778477] hover:text-[#202820] focus:outline-none transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />

              {/* Remember me & Demo Hint */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#778477] hover:text-[#202820]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => handleRememberMeChange(e.target.checked)}
                    className="h-4 w-4 rounded border-[#DCE7D9] text-[#3D7952] focus:ring-[#3D7952]/20"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={fillDemoCreds}
                  className="text-xs font-semibold text-[#3D7952] hover:text-[#233D2D] hover:underline"
                >
                  Fill demo login
                </button>
              </div>

              {/* Primary Submit Button */}
              <Button
                type="submit"
                busy={busy}
                className="w-full mt-2 min-h-[44px] bg-[#3D7952] hover:bg-[#233D2D] text-white rounded-xl text-sm font-semibold shadow-xs"
              >
                Sign In
              </Button>

              {/* Quick Explore Divider */}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#DCE7D9]" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider text-[#778477]">
                  <span className="bg-white px-3">or instant access</span>
                </div>
              </div>

              {/* 1-Tap Demo Mode Button */}
              <button
                type="button"
                onClick={enterDemo}
                disabled={busy}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#CFE5CB] bg-[#E3EFDF] py-2.5 px-4 text-xs font-bold text-[#233D2D] hover:bg-[#D5E8D1] active:bg-[#C8DFC3] transition-colors shadow-2xs"
              >
                <Sparkles size={16} className="text-[#3D7952]" />
                <span>Explore Demo as Owner Admin</span>
                <ArrowRight size={14} className="text-[#3D7952]" />
              </button>
            </form>
          )}
        </div>

        {/* Footer Subtext */}
        <p className="text-center text-xs text-[#778477]">
          Default demo credentials: <span className="font-mono font-semibold text-[#202820]">admin</span> / <span className="font-mono font-semibold text-[#202820]">ChangeMe!2026</span>
        </p>
      </div>
    </div>
  );
}
