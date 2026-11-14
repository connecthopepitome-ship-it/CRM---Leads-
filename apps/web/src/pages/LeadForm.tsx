/** SCR-005 Lead form (FR-025, FR-028, FR-029 AC2 duplicate hint). */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, get, patch, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toPaise } from '../lib/format';
import { useOptions, type Lead } from '../features/hooks';
import { Banner, Button, Card, Field, PageHeader, SelectField, Skeleton, Textarea, TextField, toast } from '../ui';

export default function LeadForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { mode, user } = useAuth();
  const sources = useOptions('leadSources');
  const products = useOptions('products');
  const existing = useQuery({ queryKey: ['lead', id], queryFn: () => get<Lead>(`/leads/${id}`), enabled: !!id });
  const [f, setF] = useState({ name: '', phone: '', email: '', company: '', city: '', pincode: '', sourceId: '', interestProductId: '', expectedValue: '', notes: '', assignAuto: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dups, setDups] = useState<{ type: string; id: string | null; name: string }[]>([]);

  useEffect(() => {
    const l = existing.data;
    if (l) setF({ name: l.name, phone: l.phone ?? l.phoneRaw ?? '', email: l.email ?? '', company: l.company ?? '', city: l.city ?? '', pincode: l.pincode ?? '', sourceId: l.sourceId, interestProductId: '', expectedValue: l.expectedValue ? String(l.expectedValue / 100) : '', notes: l.notes ?? '', assignAuto: false });
  }, [existing.data]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const checkDup = async () => {
    if (id || (!f.phone && !f.email)) return;
    const r = await post<{ matches: { type: string; id: string | null; name: string }[] }>('/leads/check-duplicate', { phone: f.phone, email: f.email }).catch(() => ({ matches: [] }));
    setDups(r.matches);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = 'Enter a name.';
    if (!f.phone.trim() && !f.email.trim()) errs.phone = 'Add a phone number or email.';
    if (f.pincode && !/^\d{6}$/.test(f.pincode)) errs.pincode = 'Pincode has 6 digits.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError(null);
    const body = {
      name: f.name, phone: f.phone || null, email: f.email || null, company: f.company || null, city: f.city || null, pincode: f.pincode || null,
      sourceId: f.sourceId || undefined, interestProductId: f.interestProductId || null, expectedValue: f.expectedValue ? toPaise(f.expectedValue) : null, notes: f.notes || null,
      ...(id ? {} : { assignAuto: f.assignAuto }),
    };
    try {
      if (id) {
        await patch(`/leads/${id}`, body, existing.data?.version);
        toast('Lead saved');
        nav(`/leads/${id}`);
      } else {
        const r = await post<{ outcome: string; lead: Lead }>('/leads', body);
        toast(r.outcome === 'merged' ? 'Existing lead updated with this enquiry' : 'Lead created');
        nav(`/leads/${r.lead.id}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LEAD_CONTACT_REQUIRED') setErrors({ phone: err.title });
      else setFormError((err as ApiError).title);
    } finally {
      setBusy(false);
    }
  };

  if (id && existing.isLoading) return <Skeleton rows={6} />;
  return (
    <>
      <PageHeader back={id ? `/leads/${id}` : '/leads'} title={id ? 'Edit lead' : 'New lead'} />
      <Card>
        <form onSubmit={(e) => void submit(e)} className="grid gap-4 md:grid-cols-2" noValidate>
          {formError && <div className="md:col-span-2"><Banner tone="danger">{formError}</Banner></div>}
          <TextField label="Name" required value={f.name} onChange={set('name')} error={errors.name} autoComplete="name" />
          <TextField label="Company" value={f.company} onChange={set('company')} autoComplete="organization" />
          <TextField label="Mobile" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} onBlur={() => void checkDup()} error={errors.phone} hint="Indian numbers can be entered without +91" autoComplete="tel" />
          <TextField label="Email" type="email" value={f.email} onChange={set('email')} onBlur={() => void checkDup()} autoComplete="email" />
          {dups.length > 0 && (
            <div className="md:col-span-2">
              <Banner tone="warning">
                {dups.map((d, i) => <span key={i}>{d.type === 'customer' ? 'Existing customer: ' : 'Existing lead: '}{d.id ? <Link className="underline" to={`/${d.type === 'customer' ? 'customers' : 'leads'}/${d.id}`}>{d.name}</Link> : d.name}. </span>)}
                Saving adds this as a re-enquiry.
              </Banner>
            </div>
          )}
          <TextField label="City" value={f.city} onChange={set('city')} />
          <TextField label="Pincode" inputMode="numeric" value={f.pincode} onChange={set('pincode')} error={errors.pincode} />
          <SelectField label="Source" value={f.sourceId} onChange={set('sourceId')} placeholder="Walk-in / phone" options={(sources.data ?? []).map((s) => ({ value: s.id, label: s.label }))} />
          <SelectField label="Interested in" value={f.interestProductId} onChange={set('interestProductId')} placeholder="Not specified" options={(products.data ?? []).map((s) => ({ value: s.id, label: s.label }))} />
          <TextField label="Expected value (₹)" inputMode="decimal" value={f.expectedValue} onChange={set('expectedValue')} />
          {!id && mode === 'team' && user?.role !== 'sales_exec' && (
            <label className="flex min-h-touch items-center gap-2 text-sm"><input type="checkbox" checked={f.assignAuto} onChange={(e) => setF((x) => ({ ...x, assignAuto: e.target.checked }))} /> Assign automatically</label>
          )}
          <div className="md:col-span-2"><Field label="Notes">{(fid) => <Textarea id={fid} value={f.notes} onChange={set('notes')} />}</Field></div>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" busy={busy}>{id ? 'Save changes' : 'Create lead'}</Button>
            <Button type="button" variant="secondary" onClick={() => nav(-1)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
