/** Customer create (FR-074). GSTIN state check happens on the server (RULE-016). */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GST_STATES } from '@ss/domain';
import { ApiError, post } from '../lib/api';
import { Banner, Button, Card, PageHeader, SelectField, TextField, toast } from '../ui';

export default function CustomerForm() {
  const nav = useNavigate();
  const [f, setF] = useState({ displayName: '', legalName: '', type: 'business', gstin: '', contactName: '', phone: '', email: '', line1: '', city: '', stateCode: '29', pincode: '', creditDays: '' });
  const [error, setError] = useState<string | null>(null);
  const [dup, setDup] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e: FormEvent, confirmDuplicate = false) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ id: string }>('/customers', {
        displayName: f.displayName, legalName: f.legalName || null, type: f.type, gstin: f.gstin || null, creditDays: f.creditDays ? Number(f.creditDays) : undefined, confirmDuplicate,
        contact: f.contactName ? { name: f.contactName, phone: f.phone || null, email: f.email || null } : undefined,
        billing: f.line1 ? { line1: f.line1, city: f.city, stateCode: f.stateCode, pincode: f.pincode || null } : undefined,
      });
      toast('Customer created');
      nav(`/customers/${r.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'POSSIBLE_DUPLICATE') setDup(true);
      else setError((err as ApiError).title);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader back="/customers" title="New customer" />
      <Card>
        <form onSubmit={(e) => void submit(e)} className="grid gap-4 md:grid-cols-2" noValidate>
          {error && <div className="md:col-span-2"><Banner tone="danger">{error}</Banner></div>}
          {dup && <div className="md:col-span-2"><Banner tone="warning" action={<Button size="sm" onClick={(e) => void submit(e as unknown as FormEvent, true)}>Save anyway</Button>}>A customer with this GSTIN already exists.</Banner></div>}
          <TextField label="Display name" required value={f.displayName} onChange={set('displayName')} />
          <TextField label="Legal name (for invoices)" value={f.legalName} onChange={set('legalName')} />
          <SelectField label="Type" value={f.type} onChange={set('type')} options={[{ value: 'business', label: 'Business' }, { value: 'individual', label: 'Individual' }, { value: 'government', label: 'Government' }]} />
          <TextField label="GSTIN" value={f.gstin} onChange={(e) => setF((x) => ({ ...x, gstin: e.target.value.toUpperCase() }))} maxLength={15} />
          <TextField label="Contact name" value={f.contactName} onChange={set('contactName')} />
          <TextField label="Mobile" type="tel" value={f.phone} onChange={set('phone')} />
          <TextField label="Email" type="email" value={f.email} onChange={set('email')} />
          <TextField label="Credit days" inputMode="numeric" value={f.creditDays} onChange={set('creditDays')} />
          <TextField label="Billing address" value={f.line1} onChange={set('line1')} />
          <TextField label="City" value={f.city} onChange={set('city')} />
          <SelectField label="State (place of supply)" value={f.stateCode} onChange={set('stateCode')} options={Object.entries(GST_STATES).map(([v, l]) => ({ value: v, label: `${l} (${v})` }))} />
          <TextField label="Pincode" inputMode="numeric" value={f.pincode} onChange={set('pincode')} />
          <div className="md:col-span-2"><Button type="submit" busy={busy} disabled={!f.displayName}>Create customer</Button></div>
        </form>
      </Card>
    </>
  );
}
