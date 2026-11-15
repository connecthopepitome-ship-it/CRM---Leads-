/**
 * SCR-027 – SCR-032, SCR-034 Settings area.
 * Redesigned with Grovia-inspired Minimalist SaaS Design System.
 */
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { AuditLog } from './AuditLog';
import { Company } from './Company';
import { Google } from './Google';
import { ImportData } from './ImportData';
import { ImportLeads } from './ImportLeads';
import { Masters } from './Masters';
import { NumberSeries } from './NumberSeries';
import { Preferences } from './Preferences';
import { Privacy } from './Privacy';
import { Users } from './Users';
import { 
  Building2, 
  Database, 
  Users2, 
  Sliders, 
  FileSpreadsheet, 
  UploadCloud, 
  Hash, 
  ShieldCheck, 
  Lock, 
  ChevronRight 
} from 'lucide-react';

interface SettingNav {
  to: string;
  label: string;
  desc: string;
  icon: typeof Building2;
}

const SETTINGS_SECTIONS: SettingNav[] = [
  { to: '', label: 'Company', desc: 'Company details and branding', icon: Building2 },
  { to: 'masters', label: 'Masters', desc: 'UOM, payee and reference', icon: Database },
  { to: 'users', label: 'Users & Teams', desc: 'Manage users and access', icon: Users2 },
  { to: 'preferences', label: 'Mode, SLA & Modules', desc: 'Configure modules and SLA', icon: Sliders },
  { to: 'google', label: 'Google & Sheets', desc: 'Integrations and sync', icon: FileSpreadsheet },
  { to: 'import', label: 'Import Leads', desc: 'Bulk lead ingestion from CSV', icon: UploadCloud },
  { to: 'import-data', label: 'Import Products & Customers', desc: 'Import items and contacts', icon: UploadCloud },
  { to: 'numbering', label: 'Numbering Series', desc: 'Custom series prefix and padding', icon: Hash },
  { to: 'audit', label: 'Audit Logs', desc: 'Track data changes and user actions', icon: ShieldCheck },
  { to: 'privacy', label: 'Privacy Requests', desc: 'Data protection and erasure', icon: Lock },
];

export default function Settings() {
  const { perm } = useAuth();
  const location = useLocation();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#202820]">Settings</h1>
        <p className="text-xs text-[#778477] mt-0.5">Configure your company, masters and system.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr] items-start">
        {/* Settings Navigation List (Grovia Modular Cards) */}
        <nav aria-label="Settings navigation" className="space-y-2">
          {SETTINGS_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            return (
              <NavLink
                key={sec.to}
                to={sec.to === '' ? '/settings' : `/settings/${sec.to}`}
                end={sec.to === ''}
                className={({ isActive }) =>
                  `flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-[#E3EFDF] border-[#3D7952]/40 shadow-xs'
                      : 'bg-white border-[#DCE7D9] hover:bg-[#F5F9F2] hover:border-[#CFE5CB]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isActive
                            ? 'bg-[#233D2D] text-white shadow-xs'
                            : 'bg-[#F5F9F2] text-[#3D7952] border border-[#DCE7D9]'
                        }`}
                      >
                        <Icon size={17} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isActive ? 'text-[#233D2D]' : 'text-[#202820]'}`}>
                          {sec.label}
                        </p>
                        <p className="text-[11px] text-[#778477] truncate mt-0.5">
                          {sec.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      size={15}
                      className={`shrink-0 transition-transform ${
                        isActive ? 'text-[#233D2D] translate-x-0.5' : 'text-[#778477]'
                      }`}
                    />
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Selected Setting Workspace Panel */}
        <div className="min-w-0 rounded-2xl border border-[#DCE7D9] bg-white p-6 shadow-xs">
          <Routes>
            <Route index element={<Company />} />
            <Route path="preferences" element={<Preferences />} />
            <Route path="masters" element={<Masters />} />
            <Route path="numbering" element={<NumberSeries />} />
            <Route path="users" element={<Users />} />
            <Route path="google" element={<Google />} />
            <Route path="import" element={<ImportLeads />} />
            <Route path="import-data" element={<ImportData />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="privacy" element={<Privacy />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
