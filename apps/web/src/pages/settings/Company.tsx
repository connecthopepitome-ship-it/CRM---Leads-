/** FR-017 company profile, tax regime, multi-country and multi-currency. */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { GST_STATES, COUNTRIES, CURRENCIES, UAE_EMIRATES, validateGstin, validateTrn } from '@ss/domain';
import { get, put } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useAction } from '../../features/hooks';
import { Button, Card, SelectField, TextField, toast } from '../../ui';
import { errorToast } from '../../ui/toast';

export function Company() {
  const { perm } = useAuth();
  const q = useQuery({ queryKey: ['company'], queryFn: () => get<Record<string, unknown> | null>('/admin/company') });
  const [logo, setLogo] = useState<string | null>(null);
  const [f, setF] = useState({
    legalName: '',
    tradeName: '',
    country: 'IN',
    baseCurrency: 'INR',
    taxRegime: 'IN_GST',
    timezone: 'Asia/Kolkata',
    numberFormat: 'in',
    dateFormat: 'DD/MM/YYYY',
    fiscalYearStart: '04-01',
    taxRegistered: 'yes',
    gstin: '',
    trn: '',
    stateCode: '29',
    emirate: 'Dubai',
    address: '',
    phone: '',
    email: '',
    pan: '',
    jurisdiction: '',
    signatory: '',
    lutNumber: '',
    lutValidFrom: '',
    lutValidTo: '',
  });

  useEffect(() => {
    const d = q.data;
    if (d) {
      const country = String(d.country ?? 'IN');
      const gstinVal = String(d.gstin ?? '');
      // Do not accept placeholder 29ABCDE1234F1Z5
      const cleanGstin = gstinVal === '29ABCDE1234F1Z5' ? '' : gstinVal;
      setF({
        legalName: String(d.legalName ?? ''),
        tradeName: String(d.tradeName ?? ''),
        country,
        baseCurrency: String(d.baseCurrency ?? d.currency ?? (country === 'IN' ? 'INR' : country === 'AE' ? 'AED' : 'USD')),
        taxRegime: String(d.taxRegime ?? (country === 'IN' ? 'IN_GST' : country === 'AE' ? 'AE_VAT' : 'NONE')),
        timezone: String(d.timezone ?? 'Asia/Kolkata'),
        numberFormat: String(d.numberFormat ?? (country === 'IN' ? 'in' : 'intl')),
        dateFormat: String(d.dateFormat ?? 'DD/MM/YYYY'),
        fiscalYearStart: String(d.fiscalYearStart ?? '04-01'),
        taxRegistered: d.taxRegistered !== false && d.gstRegistered !== false ? 'yes' : 'no',
        gstin: cleanGstin,
        trn: String(d.trn ?? ''),
        stateCode: String(d.stateCode ?? (cleanGstin.length >= 2 ? cleanGstin.slice(0, 2) : '29')),
        emirate: String(d.emirate ?? 'Dubai'),
        address: String(d.address ?? ''),
        phone: String(d.phone ?? ''),
        email: String(d.email ?? ''),
        pan: String(d.pan ?? ''),
        jurisdiction: String(d.jurisdiction ?? ''),
        signatory: String(d.signatory ?? ''),
        lutNumber: String(d.lutNumber ?? ''),
        lutValidFrom: String(d.lutValidFrom ?? ''),
        lutValidTo: String(d.lutValidTo ?? ''),
      });
      setLogo((d.logoDataUrl as string | null) ?? null);
    }
  }, [q.data]);

  const pickLogo = (file: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return errorToast({ title: 'Choose a PNG, JPEG or WebP image.' });
    if (file.size > 300 * 1024) return errorToast({ title: 'Logo must be 300 KB or smaller.' });
    const r = new FileReader();
    r.onload = () => setLogo(String(r.result));
    r.readAsDataURL(file);
  };

  const handleCountryChange = (countryCode: string) => {
    let baseCurrency = 'INR';
    let taxRegime = 'IN_GST';
    let numberFormat = 'in';
    let timezone = 'Asia/Kolkata';

    if (countryCode === 'AE') {
      baseCurrency = 'AED';
      taxRegime = 'AE_VAT';
      numberFormat = 'intl';
      timezone = 'Asia/Dubai';
    } else if (countryCode !== 'IN') {
      baseCurrency = 'USD';
      taxRegime = 'NONE';
      numberFormat = 'intl';
      timezone = 'UTC';
    }

    setF((prev) => ({
      ...prev,
      country: countryCode,
      baseCurrency,
      taxRegime,
      numberFormat,
      timezone,
    }));
  };

  const handleGstinChange = (val: string) => {
    const clean = val.toUpperCase().trim();
    let derivedState = f.stateCode;
    if (clean.length >= 2 && /^\d{2}$/.test(clean.slice(0, 2))) {
      derivedState = clean.slice(0, 2);
    }
    setF((prev) => ({
      ...prev,
      gstin: clean,
      stateCode: derivedState,
    }));
  };

  const save = useAction(
    () => {
      // Validate GSTIN if registered and IN
      if (f.taxRegistered === 'yes' && f.country === 'IN' && f.taxRegime === 'IN_GST') {
        if (!f.gstin) {
          throw new Error('GSTIN is required for tax-registered Indian entities.');
        }
        if (f.gstin === '29ABCDE1234F1Z5') {
          throw new Error('Please enter a valid, real GSTIN. Placeholder GSTIN is not allowed.');
        }
        const err = validateGstin(f.gstin, f.stateCode);
        if (err) {
          throw new Error(`Invalid GSTIN: ${err}`);
        }
      }

      // Validate TRN if registered and AE
      if (f.taxRegistered === 'yes' && f.country === 'AE' && f.taxRegime === 'AE_VAT') {
        if (!f.trn || !validateTrn(f.trn)) {
          throw new Error('Valid 15-digit UAE TRN (starting with 100) is required.');
        }
      }

      return put('/admin/company', {
        ...f,
        taxRegistered: f.taxRegistered === 'yes',
        gstRegistered: f.taxRegistered === 'yes',
        currency: f.baseCurrency,
        gstin: f.taxRegistered === 'yes' ? f.gstin || null : null,
        trn: f.taxRegistered === 'yes' ? f.trn || null : null,
        phone: f.phone || null,
        email: f.email || null,
        pan: f.pan || null,
        tradeName: f.tradeName || null,
        jurisdiction: f.jurisdiction || null,
        signatory: f.signatory || null,
        lutNumber: f.lutNumber || null,
        lutValidFrom: f.lutValidFrom || null,
        lutValidTo: f.lutValidTo || null,
        logoDataUrl: logo,
      });
    },
    [['company'], ['app-config']],
    () => toast('Company settings saved successfully')
  );

  const ro = !perm('settings:write');

  return (
    <Card title="Company profile & Tax Settings">
      <fieldset disabled={ro} className="grid gap-3 md:grid-cols-2">
        <TextField label="Legal name" required value={f.legalName} onChange={(e) => setF((x) => ({ ...x, legalName: e.target.value }))} />
        <TextField label="Trade name" value={f.tradeName} onChange={(e) => setF((x) => ({ ...x, tradeName: e.target.value }))} />

        <SelectField
          label="Country"
          value={f.country}
          onChange={(e) => handleCountryChange(e.target.value)}
          options={COUNTRIES.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))}
        />

        <SelectField
          label="Base Currency"
          value={f.baseCurrency}
          onChange={(e) => setF((x) => ({ ...x, baseCurrency: e.target.value }))}
          options={Object.entries(CURRENCIES).map(([code, cur]) => ({ value: code, label: `${code} — ${cur.name} (${cur.symbol})` }))}
        />

        <SelectField
          label="Tax Regime"
          value={f.taxRegime}
          onChange={(e) => setF((x) => ({ ...x, taxRegime: e.target.value }))}
          options={[
            { value: 'IN_GST', label: 'India GST (IN_GST)' },
            { value: 'AE_VAT', label: 'UAE VAT 5% (AE_VAT)' },
            { value: 'NONE', label: 'No Tax Regime / Tax Free' },
          ]}
        />

        <SelectField
          label="Registered for Tax?"
          value={f.taxRegistered}
          onChange={(e) => setF((x) => ({ ...x, taxRegistered: e.target.value }))}
          options={[
            { value: 'yes', label: 'Yes — Tax Registered (Issue Tax Invoices)' },
            { value: 'no', label: 'No — Not Registered (Issue Bills of Supply)' },
          ]}
        />

        {f.taxRegistered === 'yes' && f.country === 'IN' && (
          <>
            <TextField
              label="GSTIN"
              required
              value={f.gstin}
              onChange={(e) => handleGstinChange(e.target.value)}
              maxLength={15}
              placeholder="e.g. 29AABCU9603R1ZM"
            />
            <SelectField
              label="State (from GSTIN)"
              value={f.stateCode}
              onChange={(e) => setF((x) => ({ ...x, stateCode: e.target.value }))}
              options={Object.entries(GST_STATES).map(([v, l]) => ({ value: v, label: `${l} (${v})` }))}
            />
          </>
        )}

        {f.taxRegistered === 'yes' && f.country === 'AE' && (
          <>
            <TextField
              label="UAE TRN (15 digits)"
              required
              value={f.trn}
              onChange={(e) => setF((x) => ({ ...x, trn: e.target.value.replace(/\D/g, '').slice(0, 15) }))}
              maxLength={15}
              placeholder="100XXXXXXXXXXXX"
            />
            <SelectField
              label="Emirate"
              value={f.emirate}
              onChange={(e) => setF((x) => ({ ...x, emirate: e.target.value }))}
              options={UAE_EMIRATES.map((em) => ({ value: em, label: em }))}
            />
          </>
        )}

        <TextField label="Address" required value={f.address} onChange={(e) => setF((x) => ({ ...x, address: e.target.value }))} />
        <TextField label="Phone" value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} />
        <TextField label="Email" type="email" value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} />
        <TextField label="PAN / Tax ID" value={f.pan} onChange={(e) => setF((x) => ({ ...x, pan: e.target.value.toUpperCase() }))} />
        <TextField label="Jurisdiction (for invoices)" value={f.jurisdiction} onChange={(e) => setF((x) => ({ ...x, jurisdiction: e.target.value }))} />
        <TextField label="Authorised Signatory" value={f.signatory} onChange={(e) => setF((x) => ({ ...x, signatory: e.target.value }))} />

        {f.country === 'IN' && (
          <div className="col-span-full border-t border-border pt-3">
            <h4 className="text-sm font-semibold text-text mb-2">Export Settings (India GST)</h4>
            <div className="grid gap-3 md:grid-cols-3">
              <TextField
                label="LUT Number"
                value={f.lutNumber}
                onChange={(e) => setF((x) => ({ ...x, lutNumber: e.target.value.toUpperCase() }))}
                placeholder="e.g. AD290324001234F"
              />
              <TextField
                label="LUT Valid From"
                type="date"
                value={f.lutValidFrom}
                onChange={(e) => setF((x) => ({ ...x, lutValidFrom: e.target.value }))}
              />
              <TextField
                label="LUT Valid To"
                type="date"
                value={f.lutValidTo}
                onChange={(e) => setF((x) => ({ ...x, lutValidTo: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted mt-1">
              If a valid LUT is configured, export documents default to &quot;Zero-rated under LUT (no IGST)&quot;. Otherwise, export documents require IGST payment.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1 text-sm col-span-full border-t border-border pt-3">
          <label htmlFor="logo-file" className="font-medium">Company Logo</label>
          {logo && <img src={logo} alt="Current logo" className="h-12 w-auto self-start rounded-sm border border-border bg-surface p-1" />}
          <input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && pickLogo(e.target.files[0])} />
          <span className="text-xs text-muted">PNG, JPEG or WebP up to 300 KB. Documents already issued keep their original logo.</span>
          {logo && <Button size="sm" variant="ghost" className="self-start" onClick={() => setLogo(null)}>Remove logo</Button>}
        </div>
      </fieldset>
      {!ro && (
        <Button className="mt-4" busy={save.isPending} onClick={() => save.mutate(undefined)}>
          Save changes
        </Button>
      )}
    </Card>
  );
}
