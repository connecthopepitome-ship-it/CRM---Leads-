/** SCR-005 Lead form (FR-025, FR-028, FR-029 AC2 duplicate hint). Modern balanced color-coded design with dummy presets. */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, get, patch, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, toPaise } from '../lib/format';
import { useOptions, type Lead } from '../features/hooks';
import { Banner, Button, Field, PageHeader, SelectField, Skeleton, Textarea, TextField, toast } from '../ui';
import { errorToast } from '../ui/toast';
import { 
  Building2, CheckCircle2, ChevronRight, FileText, Globe2, HelpCircle, 
  IndianRupee, Mail, MapPin, Phone, RotateCcw, Sparkles, Tag, User, Users 
} from 'lucide-react';

interface PresetLead {
  label: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  city: string;
  pincode: string;
  expectedValue: string;
  notes: string;
  assignAuto: boolean;
}

const PRESET_LEADS: Record<string, PresetLead> = {
  enterprise: {
    label: 'Enterprise SaaS',
    name: 'Ananya Sharma',
    phone: '9845123456',
    email: 'ananya.sharma@apextech.in',
    company: 'Apex Global Technologies Pvt Ltd',
    city: 'Bengaluru',
    pincode: '560001',
    expectedValue: '350000',
    notes: 'Looking to migrate 45 sales reps from legacy spreadsheet system. Needs GST invoicing, role-based controls, and custom approval workflows. Decision expected by end of month.',
    assignAuto: true,
  },
  manufacturing: {
    label: 'Industrial Mfg',
    name: 'Rohan Mehra',
    phone: '9822098765',
    email: 'rohan.mehra@bharatprecision.in',
    company: 'Bharat Precision Bearings Ltd',
    city: 'Pune',
    pincode: '411019',
    expectedValue: '185000',
    notes: 'Referred by Deshmukh Mfg. Needs quotation for enterprise modules with WhatsApp delivery. Scheduled virtual product walk-through for Thursday.',
    assignAuto: false,
  },
  retail: {
    label: 'Retail Network',
    name: 'Siddharth Nair',
    phone: '9740011223',
    email: 'siddharth@nairretail.com',
    company: 'Nair Modern Supermarkets',
    city: 'Kochi',
    pincode: '682001',
    expectedValue: '95000',
    notes: 'Evaluating for 4 supermarket branch locations. Focus on client credit terms, overdue tracking, and fast barcode/item quote generation.',
    assignAuto: true,
  },
};

const QUICK_TAGS = [
  '🔥 High Priority',
  '📅 Demo Requested',
  '💰 Budget Approved',
  '🤝 Referred by Existing Customer',
  '⚡ Immediate Onboarding',
];

export default function LeadForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { mode, user } = useAuth();
  const sources = useOptions('leadSources');
  const products = useOptions('products');
  const existing = useQuery({ queryKey: ['lead', id], queryFn: () => get<Lead>(`/leads/${id}`), enabled: !!id });

  const [f, setF] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    city: '',
    pincode: '',
    sourceId: '',
    interestProductId: '',
    expectedValue: '',
    notes: '',
    assignAuto: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dups, setDups] = useState<{ type: string; id: string | null; name: string }[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    const l = existing.data;
    if (l) {
      setF({
        name: l.name,
        phone: l.phone ?? l.phoneRaw ?? '',
        email: l.email ?? '',
        company: l.company ?? '',
        city: l.city ?? '',
        pincode: l.pincode ?? '',
        sourceId: l.sourceId,
        interestProductId: '',
        expectedValue: l.expectedValue ? String(l.expectedValue / 100) : '',
        notes: l.notes ?? '',
        assignAuto: false,
      });
    }
  }, [existing.data]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setActivePreset(null);
    setF((x) => ({ ...x, [k]: e.target.value }));
  };

  const applyPreset = (key: string) => {
    const p = PRESET_LEADS[key];
    if (!p) return;
    setActivePreset(key);
    setF((x) => ({
      ...x,
      name: p.name,
      phone: p.phone,
      email: p.email,
      company: p.company,
      city: p.city,
      pincode: p.pincode,
      expectedValue: p.expectedValue,
      notes: p.notes,
      assignAuto: p.assignAuto,
      sourceId: sources.data?.[0]?.id || x.sourceId,
      interestProductId: products.data?.[0]?.id || x.interestProductId,
    }));
    setErrors({});
    toast(`Loaded test preset: ${p.label}`);
  };

  const resetForm = () => {
    setActivePreset(null);
    setF({
      name: '',
      phone: '',
      email: '',
      company: '',
      city: '',
      pincode: '',
      sourceId: '',
      interestProductId: '',
      expectedValue: '',
      notes: '',
      assignAuto: false,
    });
    setErrors({});
    setDups([]);
    toast('Form reset');
  };

  const appendTag = (tag: string) => {
    setF((x) => ({
      ...x,
      notes: x.notes ? `${x.notes} [${tag}]` : `[${tag}]`,
    }));
  };

  const checkDup = async () => {
    if (id || (!f.phone && !f.email)) return;
    try {
      const r = await post<{ matches: { type: string; id: string | null; name: string }[] }>('/leads/check-duplicate', { phone: f.phone, email: f.email });
      setDups(r.matches || []);
    } catch {
      setDups([]);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = 'Contact name is required.';
    if (!f.phone.trim() && !f.email.trim()) errs.phone = 'Add a phone number or email address.';
    if (f.pincode && !/^\d{6}$/.test(f.pincode)) errs.pincode = 'Pincode must be 6 digits.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setFormError(null);
    const body = {
      name: f.name,
      phone: f.phone || null,
      email: f.email || null,
      company: f.company || null,
      city: f.city || null,
      pincode: f.pincode || null,
      sourceId: f.sourceId || undefined,
      interestProductId: f.interestProductId || null,
      expectedValue: f.expectedValue ? toPaise(f.expectedValue) : null,
      notes: f.notes || null,
      ...(id ? {} : { assignAuto: f.assignAuto }),
    };

    try {
      if (id) {
        await patch(`/leads/${id}`, body, existing.data?.version);
        toast('Lead saved successfully');
        nav(`/leads/${id}`);
      } else {
        const r = await post<{ outcome: string; lead?: Lead; id?: string }>('/leads', body);
        const leadId = r.lead?.id || r.id;
        if (!leadId) {
          throw new Error('Server returned an invalid lead record without an ID');
        }
        toast(r.outcome === 'merged' ? 'Existing lead updated with enquiry' : 'New lead created successfully');
        nav(`/leads/${leadId}`);
      }
    } catch (err: any) {
      if (err?.body?.errors || err?.errors) {
        const fieldErrors = err.body?.errors || err.errors;
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      }
      if (err instanceof ApiError && err.code === 'LEAD_CONTACT_REQUIRED') {
        setErrors((prev) => ({ ...prev, phone: err.title }));
      }
      const msg = err?.title || err?.message || 'Failed to save lead. Please try again.';
      setFormError(msg);
      errorToast(err);
    } finally {
      setBusy(false);
    }
  };

  if (id && existing.isLoading) return <Skeleton rows={6} />;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Top Breadcrumb & Page Title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader 
          back={id ? `/leads/${id}` : '/leads'} 
          title={id ? 'Edit Lead' : 'Create New Lead'} 
        />

        {/* Dummy Data Test Presets Toolbar */}
        {!id && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#CFE5CB] bg-[#E3EFDF] p-1.5 shadow-2xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#233D2D]">
              <Sparkles className="h-3.5 w-3.5 text-[#3D7952]" />
              Test Data:
            </span>
            {Object.entries(PRESET_LEADS).map(([k, p]) => (
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
        {formError && <Banner tone="danger">{formError}</Banner>}

        {dups.length > 0 && (
          <Banner tone="warning">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Possible Duplicate Found:</span>
              {dups.map((d, i) => (
                <span key={i}>
                  {d.type === 'customer' ? 'Customer ' : 'Lead '}
                  {d.id ? (
                    <Link className="font-medium underline hover:text-amber-900" to={`/${d.type === 'customer' ? 'customers' : 'leads'}/${d.id}`}>
                      {d.name}
                    </Link>
                  ) : (
                    d.name
                  )}
                  .
                </span>
              ))}
              <span className="text-xs text-amber-700">Submitting will register this enquiry under the existing record.</span>
            </div>
          </Banner>
        )}

        {/* SECTION 1: Contact & Identity (Blue Accent) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 border-l-blue-600 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shadow-2xs">
                <User className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Primary Contact & Identity</h3>
                <p className="text-xs text-slate-500">Key stakeholder details and organizational affiliation.</p>
              </div>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
              Required
            </span>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <TextField
              label="Contact Person Name"
              required
              value={f.name}
              onChange={set('name')}
              error={errors.name}
              placeholder="e.g. Ananya Sharma"
              autoComplete="name"
            />
            <TextField
              label="Company Name"
              value={f.company}
              onChange={set('company')}
              placeholder="e.g. Apex Global Technologies"
              autoComplete="organization"
            />
            <TextField
              label="Mobile Number"
              type="tel"
              inputMode="tel"
              value={f.phone}
              onChange={set('phone')}
              onBlur={() => void checkDup()}
              error={errors.phone}
              hint="Enter 10-digit number. +91 prefix is automatic."
              placeholder="e.g. 98451 23456"
              autoComplete="tel"
            />
            <TextField
              label="Business Email"
              type="email"
              value={f.email}
              onChange={set('email')}
              onBlur={() => void checkDup()}
              placeholder="e.g. ananya@apextech.in"
              autoComplete="email"
            />
          </div>
        </div>

        {/* SECTION 2: Commercial Intent & Deal Sizing (Emerald Accent) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 border-l-emerald-600 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 shadow-2xs">
                <IndianRupee className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Commercial Sizing & Source</h3>
                <p className="text-xs text-slate-500">Expected contract value, product of interest, and acquisition origin.</p>
              </div>
            </div>
            {f.expectedValue && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                {money(toPaise(f.expectedValue))}
              </span>
            )}
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <TextField
              label="Expected Contract Value (₹)"
              inputMode="decimal"
              value={f.expectedValue}
              onChange={set('expectedValue')}
              placeholder="e.g. 3,50,000"
            />
            <SelectField
              label="Product / Solution Interested In"
              value={f.interestProductId}
              onChange={set('interestProductId')}
              placeholder="Select solution tier…"
              options={(products.data ?? []).map((s) => ({ value: s.id, label: s.label }))}
            />
            <SelectField
              label="Lead Acquisition Source"
              value={f.sourceId}
              onChange={set('sourceId')}
              placeholder="Select lead origin…"
              options={(sources.data ?? []).map((s) => ({ value: s.id, label: s.label }))}
            />

            {!id && mode === 'team' && user?.role !== 'sales_exec' && (
              <div className="sm:col-span-3 rounded-xl border border-emerald-100 bg-emerald-50/30 p-3.5">
                <label className="flex items-center gap-3 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={f.assignAuto}
                    onChange={(e) => setF((x) => ({ ...x, assignAuto: e.target.checked }))}
                    className="h-4 w-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    Auto-assign lead to round-robin sales executive
                    <span className="block text-[11px] font-normal text-slate-500">
                      Evenly distributes workload based on sales team capacity and availability.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: Territory & Demographics (Purple Accent) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 border-l-purple-600 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 shadow-2xs">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Geographic Location</h3>
                <p className="text-xs text-slate-500">Operating city and postal routing code.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <TextField
              label="City"
              value={f.city}
              onChange={set('city')}
              placeholder="e.g. Bengaluru"
            />
            <TextField
              label="Pincode (6 Digits)"
              inputMode="numeric"
              value={f.pincode}
              onChange={set('pincode')}
              error={errors.pincode}
              placeholder="e.g. 560001"
              maxLength={6}
            />
          </div>
        </div>

        {/* SECTION 4: Context & Requirement Notes (Amber Accent) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 border-l-amber-600 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 shadow-2xs">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Opportunity Context & Discovery Notes</h3>
                <p className="text-xs text-slate-500">Document client pain points, timeline expectations, or qualification criteria.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-5">
            {/* Quick Tag Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">Quick Tags:</span>
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => appendTag(tag)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 transition-all shadow-2xs"
                >
                  + {tag}
                </button>
              ))}
            </div>

            <Field label="Meeting & Scope Notes">
              {(fid) => (
                <Textarea
                  id={fid}
                  value={f.notes}
                  onChange={set('notes')}
                  placeholder="Record customer requirement discussion, legacy migration points, key stakeholders..."
                  rows={4}
                />
              )}
            </Field>
          </div>
        </div>

        {/* FORM ACTIONS FOOTER */}
        <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline font-medium">
              {f.name ? `Draft for ${f.name}${f.company ? ` (${f.company})` : ''}` : 'Ready to create lead'}
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
              className="px-6 shadow-md shadow-indigo-600/20"
            >
              {id ? 'Save Changes' : 'Create Lead'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
