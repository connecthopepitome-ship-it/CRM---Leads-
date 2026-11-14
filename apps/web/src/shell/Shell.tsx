import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Briefcase,
  CalendarCheck,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
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
  Layers,
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

interface SubNavItem {
  to: string;
  label: string;
  show: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: ReactNode;
  show: boolean;
  to?: string; // Direct link if no children
  children?: SubNavItem[];
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
  const [quickAddMenuOpen, setQuickAddMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // PWA Installation State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  });
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ss_pwa_banner_dismissed') !== 'true';
    } catch {
      return true;
    }
  });

  // Collapsible sidebar state (persisted)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ss_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Right-side Tasks drawer state (persisted)
  const [taskDrawerOpen, setTaskDrawerOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ss_task_drawer_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Expandable navigation groups state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    leads: true,
    sales: true,
    settings: false,
  });

  const quickAddRef = useRef<HTMLDivElement>(null);

  // Auto-expand nav group if current route matches
  useEffect(() => {
    const path = loc.pathname;
    if (path.startsWith('/leads')) {
      setExpandedGroups((prev) => ({ ...prev, leads: true }));
    } else if (path.startsWith('/sales')) {
      setExpandedGroups((prev) => ({ ...prev, sales: true }));
    } else if (path.startsWith('/settings')) {
      setExpandedGroups((prev) => ({ ...prev, settings: true }));
    }
  }, [loc.pathname]);

  // Click outside to close quick-create dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setQuickAddMenuOpen(false);
      }
    };
    if (quickAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [quickAddMenuOpen]);

  // Capture PWA beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const triggerPwaInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setShowInstallBanner(false);
      }
      setInstallPrompt(null);
    } else {
      // Friendly mobile instructions
      alert(
        "To install SaleSphere as a Mobile App on your device:\n\n" +
        "• On iPhone / iPad (Safari):\n  Tap the Share button (box with arrow up) and select 'Add to Home Screen'.\n\n" +
        "• On Android (Chrome):\n  Tap the three dots menu at top right and choose 'Install app' or 'Add to Home screen'.\n\n" +
        "• On Windows / Mac (Chrome/Edge):\n  Click the Install icon in the browser address bar."
      );
    }
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem('ss_pwa_banner_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ss_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

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

  const toggleGroup = (id: string) => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      try {
        localStorage.setItem('ss_sidebar_collapsed', 'false');
      } catch {
        // ignore
      }
    }
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
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

  // Navigation Items matching enterprise SaaS structure and reference image
  const navGroups: NavGroup[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home size={18} aria-hidden />,
      to: '/',
      show: true,
    },
    {
      id: 'leads',
      label: term('leads', 'Leads'),
      icon: <UserSquare2 size={18} aria-hidden />,
      show: true,
      children: [
        { to: '/leads', label: 'All Leads', show: true },
        { to: '/leads?view=board', label: 'Board View', show: true },
        { to: '/settings/import', label: 'Import Leads', show: true },
      ],
    },
    {
      id: 'customers',
      label: term('customers', 'Customers'),
      icon: <Users size={18} aria-hidden />,
      to: '/customers',
      show: true,
    },
    {
      id: 'sales',
      label: 'Sales',
      icon: <Briefcase size={18} aria-hidden />,
      show: true,
      children: [
        { to: '/sales?tab=quotes', label: 'Quotations', show: true },
        { to: '/sales?tab=invoices', label: 'Invoices', show: true },
        { to: '/sales?tab=payments', label: 'Payments', show: true },
      ],
    },
    {
      id: 'followups',
      label: 'Follow-ups',
      icon: <CalendarCheck size={18} aria-hidden />,
      to: '/follow-ups',
      show: true,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <BarChart3 size={18} aria-hidden />,
      to: '/reports',
      show: true,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={18} aria-hidden />,
      show: true,
      children: [
        { to: '/settings', label: 'General', show: true },
        { to: '/settings/users', label: 'Team & Roles', show: true },
        { to: '/settings/masters', label: 'Custom Fields', show: true },
        { to: '/settings/audit', label: 'Audit Logs', show: true },
      ],
    },
  ];

  const isCurrentActive = (item: NavGroup | SubNavItem) => {
    if ('children' in item && item.children) {
      return item.children.some((c) => loc.pathname + loc.search === c.to || (c.to === '/leads' && loc.pathname === '/leads' && !loc.search.includes('view=board')));
    }
    const target = item.to;
    if (!target) return false;
    if (target === '/') return loc.pathname === '/';
    return (loc.pathname + loc.search).startsWith(target) || loc.pathname === target;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f4f6fb] font-sans antialiased text-slate-800">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:shadow-lg focus:text-indigo-600 font-semibold"
      >
        Skip to content
      </a>

      {/* ============================================================== */}
      {/* 1. COLLAPSIBLE LEFT SIDEBAR (Dark Navy Enterprise Aesthetic) */}
      {/* ============================================================== */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-[#0c1024] border-r border-[#1a2238] transition-all duration-300 ease-in-out select-none relative z-30 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
        aria-label="Main Navigation"
      >
        {/* Brand Header */}
        <div className={`flex h-16 items-center border-b border-[#161d33] transition-all ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
          {sidebarCollapsed ? (
            <button
              onClick={toggleSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 p-2 shadow-md shadow-indigo-500/20 hover:scale-105 transition-transform"
              title="Click to expand sidebar"
              aria-label="Expand sidebar"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.4" />
                <path d="M12 3a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9" />
                <path d="M7 12a5 5 0 0 1 5-5" stroke="white" strokeWidth="2.5" />
              </svg>
            </button>
          ) : (
            <>
              <Link to="/" className="flex items-center gap-3 group">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 p-2 shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.4" />
                    <path d="M12 3a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9" />
                    <path d="M7 12a5 5 0 0 1 5-5" stroke="white" strokeWidth="2.5" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-[17px] tracking-tight text-white leading-none">
                    SaleSphere
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 mt-0.5 tracking-normal">
                    CRM for Business
                  </span>
                </div>
              </Link>

              <button
                onClick={toggleSidebar}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2238] transition-colors"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <ChevronsLeft size={16} />
              </button>
            </>
          )}
        </div>

        {/* Navigation Groups List */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
          {navGroups.map((group) => {
            const hasChildren = group.children && group.children.length > 0;
            const isExpanded = expandedGroups[group.id];
            const active = isCurrentActive(group);

            if (!hasChildren) {
              return (
                <NavLink
                  key={group.id}
                  to={group.to!}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-300 hover:bg-[#141b30] hover:text-white'
                    } ${sidebarCollapsed ? 'justify-center px-0' : ''}`
                  }
                  title={sidebarCollapsed ? group.label : undefined}
                >
                  <span className="shrink-0">{group.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{group.label}</span>}
                </NavLink>
              );
            }

            return (
              <div key={group.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150 ${
                    active && !isExpanded
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-300 hover:bg-[#141b30] hover:text-white'
                  } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                  title={sidebarCollapsed ? group.label : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0">{group.icon}</span>
                    {!sidebarCollapsed && <span className="truncate">{group.label}</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <ChevronDown
                      size={14}
                      className={`text-slate-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  )}
                </button>

                {!sidebarCollapsed && isExpanded && (
                  <div className="ml-5 pl-3 border-l border-slate-700/60 space-y-1 py-1">
                    {group.children?.map((sub) => {
                      const isSubActive = loc.pathname + loc.search === sub.to || (sub.to === '/leads' && loc.pathname === '/leads' && !loc.search.includes('view=board'));
                      return (
                        <Link
                          key={sub.to}
                          to={sub.to}
                          className={`block rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            isSubActive
                              ? 'bg-indigo-600/30 text-indigo-300 font-semibold'
                              : 'text-slate-400 hover:text-white hover:bg-[#141b30]'
                          }`}
                        >
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* PWA Install Button in Desktop Sidebar */}
        {!isInstalled && (
          <div className="px-3 pb-2">
            <button
              onClick={triggerPwaInstall}
              className="w-full flex items-center gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-950/40 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-900/60 transition-colors"
            >
              <Smartphone size={16} className="text-indigo-400 shrink-0" />
              {!sidebarCollapsed && <span>Install App</span>}
            </button>
          </div>
        )}

        {/* Bottom Monthly Target Card (from reference image) */}
        {!sidebarCollapsed && (
          <div className="p-3 mx-3 mb-3 rounded-2xl bg-gradient-to-br from-[#12182e] to-[#1a2342] border border-[#242f55] text-white shadow-lg">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>This Month</span>
              <span className="flex items-center text-emerald-400 font-semibold text-[10px]">
                <TrendingUp size={11} className="mr-0.5" /> +32%
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-bold tracking-tight">₹49,500</span>
              <div className="flex items-end gap-0.5 h-4">
                <div className="w-1 bg-indigo-500/40 h-1.5 rounded-xs" />
                <div className="w-1 bg-indigo-500/60 h-2.5 rounded-xs" />
                <div className="w-1 bg-indigo-400 h-3 rounded-xs" />
                <div className="w-1 bg-indigo-300 h-4 rounded-xs" />
              </div>
            </div>
          </div>
        )}

        {/* User Profile Pill at Bottom of Sidebar */}
        <div className="flex items-center justify-between border-t border-[#161d33] p-3 bg-[#0a0d1e]">
          <Link
            to="/me"
            className={`flex items-center gap-2.5 min-w-0 rounded-xl p-1.5 hover:bg-[#141b30] transition-colors ${
              sidebarCollapsed ? 'justify-center w-full' : ''
            }`}
            title="User Profile & Settings"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-xs">
              {user?.fullName?.slice(0, 2).toUpperCase() || 'OA'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0 text-left">
                <span className="truncate text-xs font-bold text-white leading-tight">
                  {user?.fullName || 'Owner Admin'}
                </span>
                <span className="truncate text-[11px] text-slate-400">
                  {user?.username ? `${user.username}@salesphere.in` : 'admin@salesphere.in'}
                </span>
              </div>
            )}
          </Link>

          {!sidebarCollapsed && (
            <button
              onClick={() => void signOut().then(() => nav('/sign-in'))}
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#1a2238] transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MAIN APP CONTENT COLUMN (Header + PWA Banner + Outlet) */}
      {/* ============================================================== */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Persistent Top Header */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/90 bg-white px-3 sm:px-4 lg:px-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          {/* Left: Mobile Brand & Global Search */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-1 max-w-xl">
            {/* Mobile Brand Mark */}
            <Link to="/" className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 p-1.5 shadow-md shadow-indigo-500/25">
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.4" />
                  <path d="M12 3a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9" />
                  <path d="M7 12a5 5 0 0 1 5-5" stroke="white" strokeWidth="2.5" />
                </svg>
              </div>
              <span className="font-extrabold text-slate-900 text-base tracking-tight hidden sm:inline">SaleSphere</span>
            </Link>

            {/* Global Search Bar (matching reference image) */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-xs text-slate-400 hover:border-slate-300 hover:bg-slate-100/60 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              aria-label="Global search (Ctrl+K)"
            >
              <Search size={15} className="text-slate-400 shrink-0" aria-hidden />
              <span className="truncate">Search leads, customers, quotations...</span>
              <kbd className="ml-auto hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline-block shadow-2xs">
                Ctrl + K
              </kbd>
            </button>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Task Drawer Toggle Button */}
            <button
              onClick={toggleTaskDrawer}
              className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors ${
                taskDrawerOpen
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Toggle My Tasks Drawer"
              aria-label="Toggle tasks drawer"
            >
              <CheckSquare size={16} />
              <span className="hidden sm:inline">Tasks</span>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white font-bold">
                3
              </span>
            </button>

            {/* Notification Bell */}
            <Link
              to="/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </Link>

            {/* Help / Docs Button (Hidden on tiny screens) */}
            <button
              onClick={() => setHelpOpen(true)}
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
              title="Help & Shortcuts"
              aria-label="Help"
            >
              <HelpCircle size={18} />
            </button>

            {/* Quick-Create Dropdown Button */}
            <div className="relative" ref={quickAddRef}>
              <button
                type="button"
                onClick={() => setQuickAddMenuOpen((prev) => !prev)}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 sm:px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                aria-haspopup="true"
                aria-expanded={quickAddMenuOpen}
              >
                <Plus size={15} strokeWidth={2.5} />
                <span className="hidden xs:inline">New</span>
                <ChevronDown size={14} className={`transition-transform ${quickAddMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Quick-Create Dropdown Menu */}
              {quickAddMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-xs animate-in fade-in duration-100">
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Quick Create
                  </div>
                  <button
                    onClick={() => {
                      setQuickAddMenuOpen(false);
                      nav('/leads/new');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                  >
                    <UserPlus size={15} className="text-indigo-600" />
                    <span>New Lead</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickAddMenuOpen(false);
                      nav('/sales/quotes/new');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                  >
                    <FilePlus size={15} className="text-emerald-600" />
                    <span>New Quotation</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickAddMenuOpen(false);
                      nav('/sales/payments/new');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                  >
                    <CreditCard size={15} className="text-amber-600" />
                    <span>Record Payment</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickAddMenuOpen(false);
                      nav('/customers/new');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                  >
                    <UserCheck size={15} className="text-blue-600" />
                    <span>New Customer</span>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={() => {
                      setQuickAddMenuOpen(false);
                      setTaskDrawerOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                  >
                    <Plus size={15} className="text-purple-600" />
                    <span>Add Task</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* PWA Mobile App In-App Installation Banner */}
        {!isInstalled && showInstallBanner && (
          <div className="flex items-center justify-between border-b border-indigo-100 bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 px-4 py-2.5 text-white shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 p-1.5 border border-white/20">
                <Smartphone size={16} className="text-cyan-300" />
              </div>
              <div className="min-w-0 text-xs">
                <span className="font-bold text-white block truncate">
                  SaleSphere Mobile App
                </span>
                <span className="text-indigo-200 text-[11px] block truncate">
                  Install on your device for 1-tap launch & offline CRM access
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={triggerPwaInstall}
                className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-indigo-900 shadow-sm hover:bg-indigo-50 active:scale-95 transition-all"
              >
                <Download size={13} strokeWidth={2.5} />
                <span>Install</span>
              </button>
              <button
                onClick={dismissInstallBanner}
                className="rounded-lg p-1 text-indigo-300 hover:bg-white/10 hover:text-white transition-colors"
                title="Dismiss"
                aria-label="Dismiss banner"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Offline & Outbox Sync Alerts */}
        {!online && (
          <Banner tone="warning">
            Offline — working with local cached data. Changes will sync automatically when your connection is restored.
          </Banner>
        )}
        {online && queued > 0 && (
          <Banner tone="info">
            {queued} offline change{queued === 1 ? '' : 's'} currently syncing…
          </Banner>
        )}

        {/* Dynamic Resizable Content Area (with safe bottom padding for mobile navigation bar) */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto px-3 py-4 pb-28 sm:px-4 sm:py-5 lg:px-6 lg:py-6 lg:pb-6"
        >
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ============================================================== */}
      {/* 3. RIGHT-SIDE TASKS DRAWER (Collapsible, Tabs, Complete, Add) */}
      {/* ============================================================== */}
      <TaskDrawer
        open={taskDrawerOpen}
        onClose={() => setTaskDrawerOpen(false)}
        onToggle={toggleTaskDrawer}
      />

      {/* ============================================================== */}
      {/* 4. MOBILE NATIVE BOTTOM NAVIGATION BAR (Visible on < lg) */}
      {/* ============================================================== */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200/90 bg-white/95 px-2 py-2 backdrop-blur-md shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-safe lg:hidden"
        aria-label="Mobile Bottom Navigation"
      >
        {/* Tab 1: Dashboard */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Home size={19} strokeWidth={isActive ? 2.5 : 2} />
              <span className="mt-1">Home</span>
            </>
          )}
        </NavLink>

        {/* Tab 2: Leads */}
        <NavLink
          to="/leads"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <UserSquare2 size={19} strokeWidth={isActive ? 2.5 : 2} />
              <span className="mt-1">Leads</span>
            </>
          )}
        </NavLink>

        {/* Center Quick Action (+) Button */}
        <button
          type="button"
          onClick={() => setQuickAddMenuOpen(true)}
          className="flex h-11 w-11 -mt-4 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/35 active:scale-95 transition-transform"
          aria-label="Quick Create Menu"
        >
          <Plus size={22} strokeWidth={2.8} />
        </button>

        {/* Tab 3: Sales (Quotes & Billing) */}
        <NavLink
          to="/sales"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Briefcase size={19} strokeWidth={isActive ? 2.5 : 2} />
              <span className="mt-1">Sales</span>
            </>
          )}
        </NavLink>

        {/* Tab 4: Tasks Drawer Trigger */}
        <button
          type="button"
          onClick={toggleTaskDrawer}
          className={`relative flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold transition-colors ${
            taskDrawerOpen ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="Tasks"
        >
          <div className="relative">
            <CheckSquare size={19} strokeWidth={taskDrawerOpen ? 2.5 : 2} />
            <span className="absolute -top-1 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-600 text-[8px] text-white font-bold">
              3
            </span>
          </div>
          <span className="mt-1">Tasks</span>
        </button>

        {/* Tab 5: Mobile Menu Drawer Trigger */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 text-[10px] font-semibold transition-colors ${
            mobileMenuOpen ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="All Navigation Modules"
        >
          <Menu size={19} strokeWidth={2} />
          <span className="mt-1">Menu</span>
        </button>
      </nav>

      {/* ============================================================== */}
      {/* 5. MOBILE APP SLIDE-OVER NAVIGATION DRAWER */}
      {/* ============================================================== */}
      <Dialog open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} title="SaleSphere App Menu" sheet>
        <div className="flex flex-col gap-2 pb-6">
          {/* User Profile Card */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 mb-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-xs">
              {user?.fullName?.slice(0, 2).toUpperCase() || 'OA'}
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-slate-900 text-sm block truncate">
                {user?.fullName || 'Owner Admin'}
              </span>
              <span className="text-xs text-slate-500 block truncate">
                {user?.username ? `${user.username}@salesphere.in` : 'admin@salesphere.in'}
              </span>
            </div>
          </div>

          {/* PWA Install Button inside Mobile Menu */}
          {!isInstalled && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                void triggerPwaInstall();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 transition-colors text-left"
            >
              <Smartphone size={18} className="text-indigo-600" />
              <div>
                <span>Install Mobile App</span>
                <span className="block text-[11px] font-normal text-indigo-500">
                  Add to home screen for offline access
                </span>
              </div>
            </button>
          )}

          {/* Navigation Groups List */}
          <div className="space-y-1">
            {navGroups.map((g) => (
              <div key={g.id}>
                {g.to ? (
                  <Link
                    to={g.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-100 text-slate-700"
                  >
                    <span className="text-slate-500">{g.icon}</span>
                    {g.label}
                  </Link>
                ) : (
                  <div className="py-1">
                    <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="text-slate-400">{g.icon}</span>
                      {g.label}
                    </div>
                    {g.children?.map((c) => (
                      <Link
                        key={c.to}
                        to={c.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block pl-9 pr-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="my-2 border-t border-slate-200" />
          <Link
            to="/me"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-slate-100 rounded-xl text-slate-700"
          >
            <UserCheck size={18} className="text-slate-500" />
            My Account & Profile
          </Link>
          <button
            onClick={() => void signOut().then(() => nav('/sign-in'))}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl text-left"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </Dialog>

      {/* Help Modal */}
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard Shortcuts & Tips">
        <div className="space-y-4 text-xs text-slate-600">
          <p className="text-slate-700">SaleSphere CRM keyboard shortcuts for high-velocity sales:</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <span>Global Search</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">Ctrl + K</kbd>
            </div>
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <span>Toggle Tasks Drawer</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">Alt + T</kbd>
            </div>
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <span>Quick New Lead</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">Alt + L</kbd>
            </div>
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <span>New Quotation</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">Alt + Q</kbd>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            For support or questions, reach out to your system administrator at admin@salesphere.in
          </p>
        </div>
      </Dialog>

      {/* Global Command Palette */}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
