/** Customer create (FR-074). Multi-country, multi-currency & tax determination aware. */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GST_STATES, COUNTRIES, CURRENCIES, UAE_EMIRATES, validateGstin, validateTrn } from '@ss/domain';
import { ApiError, post } from '../lib/api';
import { useOptions } from '../features/hooks';
import { Banner, Button, PageHeader, SelectField, TextField, toast } from '../ui';
import { errorToast } from '../ui/toast';
import { 
  Building2, FileBadge, Globe, RotateCcw, 
  Sparkles, UserCheck 
} from 'lucide-react';

interface PresetCustomer {
  label: string;
  displayName: string;
  legalName: string;
  type: string;
  country: string;
  currency: string;
  taxStatus: string;
  taxId: string;
  contactName: string;
  phone: string;
  email: string;
  line1: string;
  city: string;
  stateCode: string;
  pincode: string;
  creditDays: string;
}

const PRESET_CUSTOMERS: Record<string, PresetCustomer> = {
  manufacturing: {
    label: 'Mfg Enterprise (Pune)',
    displayName: 'Deshmukh Manufacturing Ltd',
    legalName: 'Deshmukh Precision Engineering Pvt Ltd',
    type: 'business',
    country: 'IN',
    currency: 'INR',
    taxStatus: 'registered',
    taxId: '27AABCD1234F1Z5',
    contactName: 'Kavita Deshmukh',
    phone: '9822012345',
    email: 'kavita@deshmukh-mfg.com',
    line1: 'Plot 42, MIDC Bhosari Industrial Area',
    city: 'Pune',
    stateCode: '27',
    pincode: '411026',
    creditDays: '30',
  },
  consulting: {
    label: 'IT Services (BLR)',
    displayName: 'Iyer Consulting Services',
    legalName: 'Iyer Cloud Solutions LLP',
    type: 'business',
    country: 'IN',
    currency: 'INR',
    taxStatus: 'registered',
    taxId: '29AAACI9876Q1Z2',
    contactName: 'Rajesh Iyer',
    phone: '9448098765',
    email: 'rajesh@iyerconsulting.com',
    line1: 'Level 4, Prestige Tech Park, Outer Ring Road',
    city: 'Bengaluru',
    stateCode: '29',
    pincode: '560103',
    creditDays: '15',
  },
  uae_client: {
    label: 'UAE Overseas (Dubai)',
    displayName: 'Al Manar Global FZE',
    legalName: 'Al Manar Global Free Zone Enterprise',
    type: 'business',
    country: 'AE',
    currency: 'AED',
    taxStatus: 'overseas',
    taxId: '100456789012345',
    contactName: 'Tariq Mansoor',
    phone: '+971 50 123 4567',
    email: 'tariq@almanarglobal.ae',
    line1: 'Building A2, DAFZA, Dubai Airport Freezone',
    city: 'Dubai',
    stateCode: '',
    pincode: '',
    creditDays: '30',
  },
};

export default function CustomerForm() {
  const nav = useNavigate();
  const territories = useOptions('territories');
  const customerGroups = useOptions('customerGroups');
  const tagsOpts = useOptions('tags');
  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [f, setF] = useState({
    displayName: '',
    legalName: '',
    type: 'business',
    country: 'IN',
    currency: 'INR',
    taxStatus: 'registered',
    taxId: '',
    contactName: '',
    phone: '',
    email: '',
    line1: '',
    city: '',
    stateCode: '', // No default 29! State must be explicitly chosen for IN
    emirate: 'Dubai',
    pincode: '',
    creditDays: '',
    territoryId: '',
    customerGroupId: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dup, setDup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setActivePreset(null);
    setF((x) => ({ ...x, [k]: e.target.value }));
  };

  const handleCountryChange = (cCode: string) => {
    setActivePreset(null);
    let defCur = 'INR';
    let taxStat = f.taxStatus;
    if (cCode === 'AE') {
      defCur = 'AED';
      taxStat = 'overseas';
    } else if (cCode !== 'IN') {
      defCur = 'USD';
      taxStat = 'overseas';
    } else {
      defCur = 'INR';
      taxStat = 'registered';
    }
    setF((x) => ({
      ...x,
      country: cCode,
      currency: defCur,
      taxStatus: taxStat,
      stateCode: cCode === 'IN' ? '' : '',
    }));
  };

  const handleTaxIdChange = (val: string) => {
    setActivePreset(null);
    const upper = val.toUpperCase().trim();
    let derivedState = f.stateCode;
    if (f.country === 'IN' && upper.length >= 2 && /^\d{2}$/.test(upper.slice(0, 2))) {
      derivedState = upper.slice(0, 2);
    }
    setF((x) => ({
      ...x,
      taxId: upper,
      stateCode: derivedState,
    }));
  };

  const applyPreset = (key: string) => {
    const p = PRESET_CUSTOMERS[key];
    if (!p) return;
    setActivePreset(key);
    setF({
      displayName: p.displayName,
      legalName: p.legalName,
      type: p.type,
      country: p.country,
      currency: p.currency,
      taxStatus: p.taxStatus,
      taxId: p.taxId,
      contactName: p.contactName,
      phone: p.phone,
      email: p.email,
      line1: p.line1,
      city: p.city,
      stateCode: p.stateCode,
      emirate: p.country === 'AE' ? 'Dubai' : '',
      pincode: p.pincode,
      creditDays: p.creditDays,
      territoryId: territories.data?.[0]?.id || '',
      customerGroupId: customerGroups.data?.[0]?.id || '',
    });
    setDup(false);
    setError(null);
    toast(`Loaded preset: ${p.label}`);
  };

  const resetForm = () => {
    setActivePreset(null);
    setF({
      displayName: '',
      legalName: '',
      type: 'business',
      country: 'IN',
      currency: 'INR',
      taxStatus: 'registered',
      taxId: '',
      contactName: '',
      phone: '',
      email: '',
      line1: '',
      city: '',
      stateCode: '',
      emirate: 'Dubai',
      pincode: '',
      creditDays: '',
      territoryId: '',
      customerGroupId: '',
    });
    setSelectedTags([]);
    setDup(false);
    setError(null);
    toast('Form reset');
  };

  const submit = async (e: FormEvent, confirmDuplicate = false) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    // Client-side validations
    if (f.country === 'IN') {
      if (!f.stateCode) {
        setBusy(false);
        setFieldErrors({ stateCode: 'State is required for Indian customers' });
        setError('Please select a state for this Indian customer.');
        return;
      }
      if (f.taxStatus === 'registered' && f.taxId) {
        const gstinErr = validateGstin(f.taxId, f.stateCode);
        if (gstinErr) {
          setBusy(false);
          setFieldErrors({ taxId: `Invalid GSTIN: ${gstinErr}` });
          setError(`Invalid GSTIN: ${gstinErr}`);
          return;
        }
      }
    } else if (f.country === 'AE') {
      if (f.taxId && !validateTrn(f.taxId)) {
        setBusy(false);
        setFieldErrors({ taxId: 'UAE TRN must be exactly 15 digits starting with 100' });
        setError('UAE TRN must be exactly 15 digits starting with 100');
        return;
      }
    }

    try {
      const stateName = f.country === 'IN' && f.stateCode ? GST_STATES[f.stateCode] : (f.country === 'AE' ? f.emirate : f.city);
      const r = await post<{ id: string }>('/customers', {
        displayName: f.displayName,
        legalName: f.legalName || null,
        type: f.type,
        country: f.country,
        currency: f.currency,
        taxStatus: f.taxStatus,
        taxId: f.taxId || null,
        gstin: f.country === 'IN' ? f.taxId || null : null,
        phone: f.phone || null,
        email: f.email || null,
        state: stateName || null,
        stateCode: f.stateCode || (f.country !== 'IN' ? '96' : null),
        creditDays: f.creditDays ? Number(f.creditDays) : undefined,
        territoryId: f.territoryId || null,
        customerGroupId: f.customerGroupId || null,
        tags: selectedTags,
        confirmDuplicate,
        contact: f.contactName ? { name: f.contactName, phone: f.phone || null, email: f.email || null } : undefined,
        billing: f.line1 ? { line1: f.line1, city: f.city, state: stateName, stateCode: f.stateCode, pincode: f.pincode || null } : undefined,
      });
      if (!r?.id) throw new Error('Server returned invalid customer record without an ID');
      toast('Customer created successfully');
      nav(`/customers/${r.id}`);
    } catch (err: any) {
      if (err?.body?.errors || err?.errors) {
        setFieldErrors(err.body?.errors || err.errors);
      }
      if (err instanceof ApiError && err.code === 'POSSIBLE_DUPLICATE') {
        setDup(true);
      } else {
        const msg = err?.title || err?.message || 'Failed to create customer';
        setError(msg);
        errorToast(err);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Header and Test Data Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader back="/customers" title="New Customer" />

        {isDemo && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#CFE5CB] bg-[#E3EFDF] p-1.5 shadow-2xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#233D2D]">
              <Sparkles className="h-3.5 w-3.5 text-[#3D7952]" />
              Presets:
            </span>
            {Object.entries(PRESET_CUSTOMERS).map(([k, p]) => (
              <button
                key={k}
                type="button"
                onClick={() => applyPreset(k)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                  activePreset === k
                    ? 'bg-[#233D2D] text-white shadow-xs font-bold'
                    : 'bg-white text-[#202820] hover:bg-[#F5F9F2] shadow-2xs'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={resetForm}
              title="Reset form"
              className="rounded-xl border border-[#DCE7D9] bg-white p-1.5 text-[#778477] hover:text-rose-600 transition-all shadow-2xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-6" noValidate>
        {error && <Banner tone="danger">{error}</Banner>}

        {dup && (
          <Banner
            tone="warning"
            action={
              <Button size="sm" onClick={(e) => void submit(e as unknown as FormEvent, true)}>
                Save Anyway
              </Button>
            }
          >
            A customer record with this Tax ID / GSTIN already exists in the system.
          </Banner>
        )}

        {/* SECTION 1: Country, Currency & Organization Identity */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 border-l-blue-600 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shadow-2xs">
                <Globe className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Country & Business Identity</h3>
                <p className="text-xs text-slate-500">Jurisdiction, billing currency and legal organization details.</p>
              </div>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
              Required
            </span>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <SelectField
              label="Country"
              value={f.country}
              onChange={(e) => handleCountryChange(e.target.value)}
              options={COUNTRIES.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))}
            />

            <SelectField
              label="Billing Currency"
              value={f.currency}
              onChange={(e) => setF((x) => ({ ...x, currency: e.target.value }))}
              options={Object.entries(CURRENCIES).map(([code, cur]) => ({ value: code, label: `${code} — ${cur.name} (${cur.symbol})` }))}
            />

            <TextField
              label="Display Name (Brand / Common Name)"
              required
              value={f.displayName}
              onChange={(e) => {
                setFieldErrors((prev) => ({ ...prev, displayName: '' }));
                set('displayName')(e);
              }}
              error={fieldErrors.displayName}
              placeholder="e.g. Deshmukh Manufacturing Ltd"
            />

            <TextField
              label="Legal Name (For Invoices & Tax Documents)"
              value={f.legalName}
              onChange={set('legalName')}
              placeholder="e.g. Deshmukh Precision Engineering Pvt Ltd"
            />

            <SelectField
              label="Entity Type"
              value={f.type}
              onChange={set('type')}
              options={[
                { value: 'business', label: 'Registered Business / Company' },
                { value: 'individual', label: 'Individual / Proprietor' },
                { value: 'government', label: 'Government / Public Sector' },
              ]}
            />

            <SelectField
              label="Tax Registration Status"
              value={f.taxStatus}
              onChange={(e) => setF((x) => ({ ...x, taxStatus: e.target.value }))}
              options={[
                { value: 'registered', label: 'Registered (Tax Registered Entity)' },
                { value: 'unregistered', label: 'Unregistered Business' },
                { value: 'consumer', label: 'Consumer (B2C)' },
                { value: 'sez_unit', label: 'SEZ Unit (Special Economic Zone)' },
                { value: 'sez_developer', label: 'SEZ Developer' },
                { value: 'overseas', label: 'Overseas (Non-resident)' },
                { value: 'un_body', label: 'UN Body / Embassy' },
              ]}
            />

            <TextField
              label={f.country === 'IN' ? 'GSTIN (15-Character India Tax ID)' : f.country === 'AE' ? 'UAE TRN (15 Digits)' : 'Tax ID / VAT Registration No.'}
              value={f.taxId}
              onChange={(e) => handleTaxIdChange(e.target.value)}
              placeholder={f.country === 'IN' ? 'e.g. 27AABCD1234F1Z5' : f.country === 'AE' ? '100XXXXXXXXXXXX' : 'e.g. US123456789'}
              maxLength={f.country === 'IN' ? 15 : f.country === 'AE' ? 15 : 30}
              error={fieldErrors.taxId}
              hint={f.country === 'IN' ? 'State digits auto-select state and are verified by checksum.' : undefined}
            />
          </div>
        </div>

        {/* SECTION 2: Key Contact Person */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 border-l-emerald-600 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 shadow-2xs">
                <UserCheck className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Primary Contact Person</h3>
                <p className="text-xs text-slate-500">Main executive for quotes, invoices, and payment follow-ups.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <TextField
              label="Contact Person Name"
              value={f.contactName}
              onChange={set('contactName')}
              placeholder="e.g. Kavita Deshmukh"
            />
            <TextField
              label="Mobile Number"
              type="tel"
              value={f.phone}
              onChange={set('phone')}
              placeholder="e.g. +91 98220 12345"
            />
            <TextField
              label="Email Address"
              type="email"
              value={f.email}
              onChange={set('email')}
              placeholder="e.g. contact@client.com"
            />
          </div>
        </div>

        {/* SECTION 3: Tax Location & Commercial Terms */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 border-l-purple-600 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 shadow-2xs">
                <FileBadge className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Billing Address & Place of Supply</h3>
                <p className="text-xs text-slate-500">Official registered location used to determine tax lines (IGST / CGST+SGST / VAT / Zero-rated).</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField
                label="Registered Billing Address"
                value={f.line1}
                onChange={set('line1')}
                placeholder="Street address, building, floor..."
              />
            </div>
            <TextField
              label="City"
              value={f.city}
              onChange={set('city')}
              placeholder="e.g. Mumbai"
            />

            {f.country === 'IN' ? (
              <SelectField
                label="State (Place of Supply for GST)"
                required
                value={f.stateCode}
                onChange={set('stateCode')}
                error={fieldErrors.stateCode}
                placeholder="-- Select Indian State --"
                options={Object.entries(GST_STATES).map(([v, l]) => ({ value: v, label: `${l} (${v})` }))}
              />
            ) : f.country === 'AE' ? (
              <SelectField
                label="Emirate"
                value={f.emirate}
                onChange={(e) => setF((x) => ({ ...x, emirate: e.target.value }))}
                options={UAE_EMIRATES.map((em) => ({ value: em, label: em }))}
              />
            ) : (
              <TextField
                label="State / Province"
                value={f.stateCode}
                onChange={set('stateCode')}
                placeholder="State or Province code"
              />
            )}

            <TextField
              label={f.country === 'IN' ? 'Pincode' : 'Postal / ZIP Code'}
              inputMode="numeric"
              value={f.pincode}
              onChange={set('pincode')}
              placeholder={f.country === 'IN' ? 'e.g. 400703' : 'e.g. 90210'}
              maxLength={10}
            />

            <TextField
              label="Approved Credit Window (Days)"
              inputMode="numeric"
              value={f.creditDays}
              onChange={set('creditDays')}
              placeholder="e.g. 30"
              hint="Payment due date is calculated automatically from this value."
            />

            <SelectField
              label="Customer Group"
              value={f.customerGroupId}
              onChange={set('customerGroupId')}
              placeholder="Select customer group…"
              options={(customerGroups.data ?? []).map((g) => ({ value: g.id, label: g.label }))}
            />

            <SelectField
              label="Territory"
              value={f.territoryId}
              onChange={set('territoryId')}
              placeholder="Select territory…"
              options={(territories.data ?? []).map((t) => ({ value: t.id, label: t.label }))}
            />

            {(tagsOpts.data ?? []).length > 0 && (
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-slate-600">Tags:</span>
                {(tagsOpts.data ?? []).map((t) => {
                  const active = selectedTags.includes(t.label);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setSelectedTags((prev) =>
                          prev.includes(t.label) ? prev.filter((x) => x !== t.label) : [...prev, t.label],
                        )
                      }
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                        active
                          ? 'border-emerald-600 bg-emerald-100 text-emerald-900 font-semibold'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline font-medium">
              {f.displayName ? `Creating profile for ${f.displayName}` : 'Ready to save customer profile'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => nav(-1)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              busy={busy}
              disabled={!f.displayName.trim()}
              className="px-6 shadow-md shadow-indigo-600/20"
            >
              Create Customer
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
