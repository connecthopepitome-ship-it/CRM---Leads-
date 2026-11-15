import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Briefcase,
  CalendarCheck,
  ChevronDown,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Users,
  UserSquare2,
  BarChart3,
  CheckSquare,
  Sparkles,
  UserPlus,
  FilePlus,
  CreditCard,
  UserCheck,
  TrendingUp,
  Download,
  Smartphone,
  X,
} from 'lucide-react';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { get } from '../lib/api';
import { useBrandColours, useTerm } from '../lib/appConfig';
import { useAuth } from '../lib/auth';
import { onOutboxChange, pending } from '../lib/outbox';
import { Banner, Dialog } from '../ui';
import { CommandPalette } from './CommandPalette';
import { TaskDrawer } from './TaskDrawer';

interface TopNavItem {
  id: string;
  label: string;
  to: string;
  icon?: ReactNode;
}

export function Shell() {
  const { user, signOut } = useAuth();
  const term = useTerm();
  useBrandColours();
  const nav = useNavigate();
  const loc = useLocation();

  const [online, setOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickAddMenuOpen, setQuickAddMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Right-side Tasks drawer state (persisted)
  const [taskDrawerOpen, setTaskDrawerOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ss_task_drawer_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const quickAddRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setQuickAddMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleTaskDrawer = () => {
    setTaskDrawerOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ss_task_drawer_open', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => get<{ unreadCount: number }>('/notifications?unread=1&limit=1').catch(() => ({ unreadCount: 2 })),
    refetchInterval: 60_000,
  });

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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [loc.pathname]);

  // Horizontal top navigation items matching Grovia reference
  const navItems: TopNavItem[] = [
    { id: 'overview', label: 'Overview', to: '/' },
    { id: 'leads', label: term('leads', 'Leads'), to: '/leads' },
    { id: 'customers', label: term('customers', 'Customers'), to: '/customers' },
    { id: 'sales', label: 'Sales', to: '/sales' },
    { id: 'followups', label: 'Follow-ups', to: '/follow-ups' },
    { id: 'reports', label: 'Reports', to: '/reports' },
    { id: 'settings', label: 'Settings', to: '/settings' },
  ];

  const isNavActive = (item: TopNavItem) => {
    if (item.to === '/') return loc.pathname === '/';
    return loc.pathname.startsWith(item.to);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#EDF5EA] font-sans antialiased text-[#202820]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:shadow-lg focus:text-[#3D7952] font-semibold"
      >
        Skip to content
      </a>

      {/* ============================================================== */}
      {/* 1. GROVIA HORIZONTAL TOP NAVIGATION BAR */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-[#DCE7D9] bg-white/95 px-4 lg:px-7 shadow-xs backdrop-blur-md">
        {/* Left: Brand Emblem + Name */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            {/* Grovia-style Green Circular Emblem */}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#233D2D] via-[#3D7952] to-[#5A9B68] p-1.5 shadow-xs group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.4" />
                <path d="M12 3a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9" />
                <path d="M7 12a5 5 0 0 1 5-5" stroke="white" strokeWidth="2.5" />
              </svg>
            </div>
            <span className="font-extrabold text-[18px] tracking-tight text-[#202820]">
              SaleSphere
            </span>
          </Link>
        </div>

        {/* Center: Horizontal Navigation Pills (Grovia Minimalist Style) */}
        <nav className="hidden md:flex items-center gap-1.5 rounded-full bg-[#F5F9F2] p-1 border border-[#DCE7D9]">
          {navItems.map((item) => {
            const active = isNavActive(item);
            return (
              <Link
                key={item.id}
                to={item.to}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 select-none ${
                  active
                    ? 'bg-[#233D2D] text-white shadow-xs'
                    : 'text-[#778477] hover:text-[#202820] hover:bg-white/80'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Controls & Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Global Search Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 items-center gap-2 rounded-xl border border-[#DCE7D9] bg-[#F5F9F2]/70 px-3 py-1.5 text-xs text-[#778477] hover:bg-white hover:text-[#202820] hover:border-[#CFE5CB] transition-all"
            title="Global search (Ctrl+K)"
            aria-label="Search"
          >
            <Search size={14} className="text-[#778477]" />
            <span className="hidden xl:inline text-[11px]">Search...</span>
            <kbd className="hidden sm:inline-block rounded-md border border-[#DCE7D9] bg-white px-1.5 py-0.2 font-mono text-[9px] text-[#778477]">
              ⌘K
            </kbd>
          </button>

          {/* Task Drawer Toggle Button */}
          <button
            onClick={toggleTaskDrawer}
            className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-all ${
              taskDrawerOpen
                ? 'bg-[#233D2D] text-white'
                : 'border border-[#DCE7D9] bg-white text-[#202820] hover:bg-[#F5F9F2]'
            }`}
            title="Toggle My Tasks Drawer"
            aria-label="Toggle tasks drawer"
          >
            <CheckSquare size={15} />
            <span className="hidden sm:inline">Tasks</span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#3D7952] text-[9px] text-white font-bold">
              3
            </span>
          </button>

          {/* Notifications Bell */}
          <Link
            to="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE7D9] bg-white text-[#778477] hover:text-[#202820] hover:bg-[#F5F9F2] transition-colors"
            aria-label="Notifications"
          >
            <Bell size={16} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#D66B68] ring-2 ring-white" />
          </Link>

          {/* Quick-Create (+) Dropdown */}
          <div className="relative" ref={quickAddRef}>
            <button
              type="button"
              onClick={() => setQuickAddMenuOpen((prev) => !prev)}
              className="flex h-9 items-center gap-1 rounded-xl bg-[#3D7952] px-3 text-xs font-bold text-white shadow-xs hover:bg-[#233D2D] active:scale-95 transition-all"
              aria-haspopup="true"
              aria-expanded={quickAddMenuOpen}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span className="hidden sm:inline">New</span>
            </button>

            {quickAddMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-[#DCE7D9] bg-white p-1.5 shadow-xl z-50 text-xs animate-in fade-in duration-100">
                <div className="px-3 py-1.5 text-[11px] font-bold text-[#778477] uppercase tracking-wider">
                  Quick Create
                </div>
                <button
                  onClick={() => {
                    setQuickAddMenuOpen(false);
                    nav('/leads/new');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#202820] hover:bg-[#EDF5EA] hover:text-[#3D7952] transition-colors text-left"
                >
                  <UserPlus size={15} className="text-[#3D7952]" />
                  <span>New Lead</span>
                </button>
                <button
                  onClick={() => {
                    setQuickAddMenuOpen(false);
                    nav('/sales/quotes/new');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#202820] hover:bg-[#EDF5EA] hover:text-[#3D7952] transition-colors text-left"
                >
                  <FilePlus size={15} className="text-[#3D7952]" />
                  <span>New Quotation</span>
                </button>
                <button
                  onClick={() => {
                    setQuickAddMenuOpen(false);
                    nav('/sales/payments/new');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#202820] hover:bg-[#EDF5EA] hover:text-[#3D7952] transition-colors text-left"
                >
                  <CreditCard size={15} className="text-[#3D7952]" />
                  <span>Record Payment</span>
                </button>
                <button
                  onClick={() => {
                    setQuickAddMenuOpen(false);
                    nav('/customers/new');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#202820] hover:bg-[#EDF5EA] hover:text-[#3D7952] transition-colors text-left"
                >
                  <UserCheck size={15} className="text-[#3D7952]" />
                  <span>New Customer</span>
                </button>
              </div>
            )}
          </div>

          {/* User Profile Avatar & Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E3EFDF] border border-[#DCE7D9] text-xs font-bold text-[#233D2D] hover:ring-2 hover:ring-[#3D7952]/30 transition-all"
              aria-label="User Profile Menu"
            >
              {user?.fullName?.slice(0, 2).toUpperCase() || 'OA'}
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#DCE7D9] bg-white p-2 shadow-xl z-50 text-xs animate-in fade-in duration-100">
                <div className="px-3 py-2 border-b border-[#DCE7D9]/60">
                  <span className="font-bold text-[#202820] block truncate">
                    {user?.fullName || 'Owner Admin'}
                  </span>
                  <span className="text-[11px] text-[#778477] block truncate">
                    {user?.username ? `${user.username}@salesphere.in` : 'admin@salesphere.in'}
                  </span>
                </div>
                <div className="py-1">
                  <Link
                    to="/me"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#202820] hover:bg-[#EDF5EA] hover:text-[#3D7952] transition-colors"
                  >
                    <UserCheck size={15} />
                    <span>My Account</span>
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#202820] hover:bg-[#EDF5EA] hover:text-[#3D7952] transition-colors"
                  >
                    <Settings size={15} />
                    <span>Settings</span>
                  </Link>
                </div>
                <div className="border-t border-[#DCE7D9]/60 pt-1">
                  <button
                    onClick={() => void signOut().then(() => nav('/sign-in'))}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#D66B68] hover:bg-[#FDF0EF] transition-colors text-left"
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Hamburger (Visible on small screens) */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE7D9] bg-white text-[#202820] md:hidden"
            aria-label="Open Mobile Menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* Offline / Outbox Alert */}
      {!online && (
        <Banner tone="warning">
          Offline — working with local cached data. Changes will sync automatically when restored.
        </Banner>
      )}

      {/* ============================================================== */}
      {/* 2. MAIN LAYOUT (Content Workspace + Floating TaskDrawer) */}
      {/* ============================================================== */}
      <div className="flex min-w-0 flex-1 overflow-hidden relative">
        {/* Dynamic Resizable Content Area */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto px-4 py-5 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:pb-8 transition-all duration-300"
        >
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>

        {/* Right-Side Grovia Forest-Green Task Drawer */}
        <TaskDrawer
          open={taskDrawerOpen}
          onClose={() => setTaskDrawerOpen(false)}
          onToggle={toggleTaskDrawer}
        />
      </div>

      {/* ============================================================== */}
      {/* 3. MOBILE BOTTOM NAVIGATION (for small screens) */}
      {/* ============================================================== */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[#DCE7D9] bg-white/95 px-2 py-2 backdrop-blur-md pb-safe md:hidden shadow-lg"
        aria-label="Mobile Navigation"
      >
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-[#3D7952]' : 'text-[#778477] hover:text-[#202820]'
            }`
          }
        >
          <Home size={18} />
          <span className="mt-0.5">Overview</span>
        </NavLink>

        <NavLink
          to="/leads"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-[#3D7952]' : 'text-[#778477] hover:text-[#202820]'
            }`
          }
        >
          <UserSquare2 size={18} />
          <span className="mt-0.5">Leads</span>
        </NavLink>

        <button
          type="button"
          onClick={() => setQuickAddMenuOpen(true)}
          className="flex h-10 w-10 -mt-3 items-center justify-center rounded-full bg-[#3D7952] text-white shadow-md active:scale-95 transition-transform"
          aria-label="Quick Create"
        >
          <Plus size={20} strokeWidth={2.8} />
        </button>

        <NavLink
          to="/sales"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-[#3D7952]' : 'text-[#778477] hover:text-[#202820]'
            }`
          }
        >
          <Briefcase size={18} />
          <span className="mt-0.5">Sales</span>
        </NavLink>

        <button
          type="button"
          onClick={toggleTaskDrawer}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold transition-colors ${
            taskDrawerOpen ? 'text-[#3D7952]' : 'text-[#778477] hover:text-[#202820]'
          }`}
          aria-label="Tasks"
        >
          <div className="relative">
            <CheckSquare size={18} />
            <span className="absolute -top-1 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#3D7952] text-[8px] text-white font-bold">
              3
            </span>
          </div>
          <span className="mt-0.5">Tasks</span>
        </button>
      </nav>

      {/* Mobile Drawer Dialog */}
      <Dialog open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} title="Menu" sheet>
        <div className="flex flex-col gap-2 pb-6">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isNavActive(item)
                    ? 'bg-[#233D2D] text-white'
                    : 'text-[#202820] hover:bg-[#EDF5EA]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="my-2 border-t border-[#DCE7D9]" />
          <Link
            to="/me"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#202820] hover:bg-[#EDF5EA] rounded-xl"
          >
            My Account
          </Link>
          <button
            onClick={() => void signOut().then(() => nav('/sign-in'))}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#D66B68] hover:bg-[#FDF0EF] rounded-xl text-left"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </Dialog>

      {/* Global Command Palette */}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
