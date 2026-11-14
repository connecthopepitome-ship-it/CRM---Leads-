/** SCR-027 – SCR-032, SCR-034 Settings area. */
import { NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { PageHeader } from '../../ui';
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

export default function Settings() {
  const { perm } = useAuth();
  const links = [
    ['', 'Company', perm('settings:read')], ['preferences', 'Mode, SLA & modules', perm('settings:read')], ['masters', 'Masters', perm('settings:read')], ['numbering', 'Numbering', perm('settings:read')],
    ['users', 'Users & teams', perm('users:read')], ['google', 'Google & Sheets', perm('settings:read')], ['import', 'Import leads', perm('lead:import')], ['import-data', 'Import products & customers', perm('settings:write')],
    ['audit', 'Audit log', perm('audit:read')], ['privacy', 'Privacy requests', perm('privacy:execute')],
  ].filter(([, , s]) => s) as [string, string, boolean][];
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Settings" className="flex gap-1 overflow-x-auto lg:flex-col">
          {links.map(([to, l]) => (
            <NavLink key={to} to={`/settings/${to}`} end={to === ''} className={({ isActive }) => `min-h-touch whitespace-nowrap rounded-md px-3 py-2 text-sm ${isActive ? 'bg-primary-subtle font-medium text-primary' : 'hover:bg-surface-2'}`}>{l}</NavLink>
          ))}
        </nav>
        <div className="min-w-0">
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
    </>
  );
}
