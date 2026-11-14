/** SCR-036 App shell: role-filtered navigation (sidebar ≥ 1024, bottom tabs + FAB below), offline banner, search, notifications. */
import { useQuery } from '@tanstack/react-query';
import { Bell, Briefcase, CalendarCheck, Home, LogOut, Menu, Plus, Search, Settings, Users, UserSquare2, BarChart3 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { get } from '../lib/api';
import { useBrandColours, useTerm } from '../lib/appConfig';
import { useAuth } from '../lib/auth';
import { onOutboxChange, pending } from '../lib/outbox';
import { Banner, Dialog } from '../ui';
import { CommandPalette } from './CommandPalette';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  show: boolean;
}

export function Shell() {
  const { user, can, perm, signOut } = useAuth();
  const term = useTerm();
  useBrandColours();
  const nav = useNavigate();
  const loc = useLocation();
  const [online, setOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const unread = useQuery({ queryKey: ['notifications', 'unread'], queryFn: () => get<{ unreadCount: number }>('/notifications?unread=1&limit=1'), refetchInterval: 60_000 });

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const refresh = () => void pending().then((p) => setQueued(p.length));
    refresh();
    const un = onOutboxChange(refresh);
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('keydown', key);
      un();
    };
  }, []);
  useEffect(() => setMoreOpen(false), [loc.pathname]);

  const items: NavItem[] = [
    { to: '/', label: 'Home', icon: <Home size={20} aria-hidden />, show: true },
    { to: '/leads', label: term('leads', 'Leads'), icon: <UserSquare2 size={20} aria-hidden />, show: can('lead') },
    { to: '/customers', label: term('customers', 'Customers'), icon: <Users size={20} aria-hidden />, show: can('customer') },
    { to: '/sales', label: 'Sales', icon: <Briefcase size={20} aria-hidden />, show: can('quote') || can('invoice') },
    { to: '/follow-ups', label: 'Follow-ups', icon: <CalendarCheck size={20} aria-hidden />, show: can('activity') },
    { to: '/reports', label: 'Reports', icon: <BarChart3 size={20} aria-hidden />, show: can('report') },
    { to: '/settings', label: 'Settings', icon: <Settings size={20} aria-hidden />, show: perm('settings:read') || perm('audit:read') },
  ].filter((i) => i.show);
  const bottom = items.filter((i) => ['/', '/leads', '/customers', '/sales'].includes(i.to));

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:p-2">Skip to content</a>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex" aria-label="Main">
        <div className="flex h-16 items-center px-4 text-lg font-bold text-primary">SaleSphere</div>
        <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Primary">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `flex min-h-touch items-center gap-3 rounded-md px-3 text-sm font-medium ${isActive ? 'bg-primary-subtle text-primary' : 'text-muted hover:bg-surface-2 hover:text-text'}`}>
              {i.icon}
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3 text-sm">
          <Link to="/me" className="block truncate font-medium hover:underline">{user?.fullName}</Link>
          <p className="text-xs text-muted">{user?.roleLabel}</p>
          <button onClick={() => void signOut().then(() => nav('/sign-in'))} className="mt-2 flex min-h-touch items-center gap-2 text-muted hover:text-text"><LogOut size={16} aria-hidden /> Sign out</button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur lg:px-6">
          <span className="font-bold text-primary lg:hidden">SaleSphere</span>
          <button onClick={() => setSearchOpen(true)} className="ml-auto flex min-h-touch items-center gap-2 rounded-md border border-border px-3 text-sm text-muted hover:bg-surface-2 lg:ml-0 lg:w-80" aria-label="Search (Ctrl+K)">
            <Search size={16} aria-hidden /> <span className="hidden md:inline">Search… </span><kbd className="hidden text-xs md:inline">Ctrl K</kbd>
          </button>
          <Link to="/notifications" className="relative ml-auto flex min-h-touch min-w-touch items-center justify-center rounded-md hover:bg-surface-2 lg:ml-auto" aria-label={`Notifications${unread.data?.unreadCount ? `, ${unread.data.unreadCount} unread` : ''}`}>
            <Bell size={20} aria-hidden />
            {!!unread.data?.unreadCount && <span className="absolute right-1 top-1 rounded-full bg-danger px-1.5 text-[10px] font-bold text-primary-fg">{unread.data.unreadCount}</span>}
          </Link>
        </header>
        {!online && <Banner tone="warning">Offline — showing saved data. Notes, call outcomes and follow-ups will sync when you're back online{queued ? ` (${queued} waiting)` : ''}.</Banner>}
        {online && queued > 0 && <Banner tone="info">{queued} offline change{queued === 1 ? '' : 's'} syncing…</Banner>}
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 lg:px-6 lg:pb-8">
          <Outlet />
        </main>
      </div>
      {/* CMP-024 bottom tab bar + FAB (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Primary">
        {bottom.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-primary' : 'text-muted'}`}>
            {i.icon}
            {i.label}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)} className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted"><Menu size={20} aria-hidden />More</button>
      </nav>
      {can('lead', 'create') && (
        <button onClick={() => setQuickAdd(true)} className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-2 lg:bottom-6 lg:right-6" aria-label="Quick add">
          <Plus size={24} aria-hidden />
        </button>
      )}
      <Dialog open={quickAdd} onClose={() => setQuickAdd(false)} title="Quick add" sheet>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['New lead', '/leads/new', can('lead', 'create')],
            ['New quotation', '/sales/quotes/new', can('quote', 'create')],
            ['Record payment', '/sales/payments/new', can('payment', 'create')],
            ['New customer', '/customers/new', can('customer', 'create')],
          ].filter(([, , s]) => s).map(([l, to]) => (
            <button key={String(to)} onClick={() => { setQuickAdd(false); nav(String(to)); }} className="min-h-touch rounded-md border border-border p-3 text-left text-sm font-medium hover:bg-surface-2">{String(l)}</button>
          ))}
        </div>
      </Dialog>
      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More" sheet>
        <div className="flex flex-col">
          {items.filter((i) => !bottom.includes(i)).map((i) => <Link key={i.to} to={i.to} className="flex min-h-touch items-center gap-3 rounded-md px-2 hover:bg-surface-2">{i.icon}{i.label}</Link>)}
          <Link to="/me" className="flex min-h-touch items-center gap-3 rounded-md px-2 hover:bg-surface-2">My account</Link>
          <button onClick={() => void signOut().then(() => nav('/sign-in'))} className="flex min-h-touch items-center gap-3 rounded-md px-2 text-left hover:bg-surface-2"><LogOut size={18} aria-hidden /> Sign out</button>
        </div>
      </Dialog>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
