/** FR-017 company profile and GST registration. */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { GST_STATES } from '@ss/domain';
import { get, put } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useAction } from '../../features/hooks';
import { Button, Card, SelectField, TextField, toast } from '../../ui';
import { errorToast } from '../../ui/toast';

export function Company() {
  const { perm } = useAuth();
  const q = useQuery({ queryKey: ['company'], queryFn: () => get<Record<string, unknown> | null>('/admin/company') });
  const [logo, setLogo] = useState<string | null>(null);
  const [f, setF] = useState({ legalName: '', tradeName: '', gstRegistered: 'yes', gstin: '', stateCode: '29', address: '', phone: '', email: '', pan: '', jurisdiction: '', signatory: '' });
  useEffect(() => {
    const d = q.data;
    if (d) setF({ legalName: String(d.legalName ?? ''), tradeName: String(d.tradeName ?? ''), gstRegistered: d.gstRegistered ? 'yes' : 'no', gstin: String(d.gstin ?? ''), stateCode: String(d.stateCode ?? '29'), address: String(d.address ?? ''), phone: String(d.phone ?? ''), email: String(d.email ?? ''), pan: String(d.pan ?? ''), jurisdiction: String(d.jurisdiction ?? ''), signatory: String(d.signatory ?? '') });
    if (d) setLogo((d.logoDataUrl as string | null) ?? null);
  }, [q.data]);
  /** FR-003 AC2: new documents use the new logo; issued documents keep the logo they were issued with. */
  const pickLogo = (file: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return errorToast({ title: 'Choose a PNG, JPEG or WebP image.' });
    if (file.size > 300 * 1024) return errorToast({ title: 'Logo must be 300 KB or smaller.' });
    const r = new FileReader();
    r.onload = () => setLogo(String(r.result));
    r.readAsDataURL(file);
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = useAction(() => put('/admin/company', { ...f, gstRegistered: f.gstRegistered === 'yes', gstin: f.gstin || null, phone: f.phone || null, email: f.email || null, pan: f.pan || null, tradeName: f.tradeName || null, jurisdiction: f.jurisdiction || null, signatory: f.signatory || null, logoDataUrl: logo }), [['company'], ['app-config']], () => toast('Company saved'));
  const ro = !perm('settings:write');
  return (
    <Card title="Company profile">
      <fieldset disabled={ro} className="grid gap-3 md:grid-cols-2">
        <TextField label="Legal name" required value={f.legalName} onChange={set('legalName')} />
        <TextField label="Trade name" value={f.tradeName} onChange={set('tradeName')} />
        <SelectField label="GST registered?" value={f.gstRegistered} onChange={set('gstRegistered')} options={[{ value: 'yes', label: 'Yes — issue Tax Invoices' }, { value: 'no', label: 'No — issue Bills of Supply' }]} />
        <TextField label="GSTIN" value={f.gstin} onChange={(e) => setF((x) => ({ ...x, gstin: e.target.value.toUpperCase() }))} maxLength={15} disabled={f.gstRegistered === 'no'} />
        <SelectField label="State" value={f.stateCode} onChange={set('stateCode')} options={Object.entries(GST_STATES).map(([v, l]) => ({ value: v, label: `${l} (${v})` }))} />
        <TextField label="Address" required value={f.address} onChange={set('address')} />
        <TextField label="Phone" value={f.phone} onChange={set('phone')} />
        <TextField label="Email" type="email" value={f.email} onChange={set('email')} />
        <TextField label="PAN" value={f.pan} onChange={(e) => setF((x) => ({ ...x, pan: e.target.value.toUpperCase() }))} />
        <TextField label="Jurisdiction (for invoices)" value={f.jurisdiction} onChange={set('jurisdiction')} />
        <TextField label="Signatory" value={f.signatory} onChange={set('signatory')} />
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="logo-file" className="font-medium">Logo on documents</label>
          {logo && <img src={logo} alt="Current logo" className="h-12 w-auto self-start rounded-sm border border-border bg-surface p-1" />}
          <input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && pickLogo(e.target.files[0])} />
          <span className="text-xs text-muted">PNG, JPEG or WebP up to 300 KB. Documents already issued keep their original logo.</span>
          {logo && <Button size="sm" variant="ghost" className="self-start" onClick={() => setLogo(null)}>Remove logo</Button>}
        </div>
      </fieldset>
      {!ro && <Button className="mt-4" busy={save.isPending} onClick={() => save.mutate(undefined)}>Save changes</Button>}
    </Card>
  );
}
