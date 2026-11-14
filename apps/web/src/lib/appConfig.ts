/** API-002 app bootstrap config: terminology (FR-003 AC1), module switches (FR-004 AC4), brand colour (FR-003). */
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { get } from './api';

export interface AppConfig {
  appName: string;
  companyName: string;
  branding: { primary?: string; primaryDark?: string; poweredBy?: boolean };
  terminology: Record<string, string>;
  mode: 'solo' | 'team';
  modules: { orders: boolean; sheetSync: boolean; webForm: boolean };
  gstRegistered: boolean;
}

export function useAppConfig() {
  return useQuery({ queryKey: ['app-config'], queryFn: () => get<AppConfig>('/app-config'), staleTime: 60_000 });
}

/** `term('leads', 'Leads')` → the Admin's word for it (e.g. "Enquiries"), else the default. */
export function useTerm() {
  const t = useAppConfig().data?.terminology ?? {};
  return (key: string, fallback: string) => t[key]?.trim() || fallback;
}

const channels = (hex?: string) => {
  const m = hex && /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** Applies the brand colour to the design tokens (light → primary, dark → primaryDark); contrast is checked on save (FR-003 AC3). */
export function useBrandColours() {
  const b = useAppConfig().data?.branding;
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const c = channels(root.dataset.theme === 'dark' ? b?.primaryDark : b?.primary);
      if (c) root.style.setProperty('--color-primary', c);
      else root.style.removeProperty('--color-primary');
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [b?.primary, b?.primaryDark]);
}
