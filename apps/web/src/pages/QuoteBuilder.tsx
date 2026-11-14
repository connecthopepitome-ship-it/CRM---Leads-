/** SCR-010 Quote builder: CMP-029 LineItemEditor + CMP-030 TotalsBlock, live totals from @ss/domain (same engine as the server). */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { computeDocument, GST_STATES, isIntraState } from '@ss/domain';
import { ApiError, get, patch, post } from '../lib/api';
import { money, toPaise } from '../lib/format';
import { useOptions } from '../features/hooks';
import { Banner, Button, Card, Field, Input, PageHeader, Select, SelectField, Skeleton, Textarea, TextField, toast } from '../ui';

interface Line {
  kind: 'item' | 'heading';
  productId: string | null;
  description: string;
  qty: string;
  unit: string;
  rate: string;
  discountPct: string;
  taxRatePct: string;
  hsnSac: string;
}
const blank = (): Line => ({ kind: 'item', productId: null, description: '', qty: '1', unit: 'Nos', rate: '', discountPct: '', taxRatePct: '18', hsnSac: '' });

export default function QuoteBuilder() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const products = useOptions('products');
  const company = useQuery({ queryKey: ['company'], queryFn: () => get<{ gstRegistered: boolean; stateCode: string } | null>('/admin/company').catch(() => null) });
  const existing = useQuery({ queryKey: ['quote', id], queryFn: () => get<Record<string, unknown>>(`/quotes/${id}`), enabled: !!id });
  const [partyType, setPartyType] = useState(params.get('partyType') ?? 'customer');
  const [partyId, setPartyId] = useState(params.get('partyId') ?? '');
  const [partySearch, setPartySearch] = useState('');
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [validDays, setValidDays] = useState('15');
  const [pos, setPos] = useState('');
  const [overall, setOverall] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parties = useQuery({ queryKey: ['party-search', partyType, partySearch], queryFn: () => get<{ items: { id: string; name?: string; displayName?: string }[] }>(`/${partyType === 'lead' ? 'leads' : 'customers'}?limit=10${partySearch.length >= 2 ? `&q=${encodeURIComponent(partySearch)}` : ''}`), enabled: !id });

  useEffect(() => {
    const q = existing.data;
    if (!q) return;
    setPartyType(String(q.partyType));
    setPartyId(String(q.partyId));
    setValidDays(String(q.validDays ?? 15));
    setPos(String(q.placeOfSupply ?? ''));
    setOverall(q.overallDiscountPct ? String(q.overallDiscountPct) : '');
    setTerms(String(q.termsText ?? ''));
    setNotes(String(q.notes ?? ''));
    setLines((q.lines as Record<string, unknown>[]).map((l) => ({ kind: l.kind as 'item', productId: (l.productId as string) ?? null, description: String(l.description ?? ''), qty: String(l.qty), unit: String(l.unit ?? ''), rate: String(Number(l.rate) / 100), discountPct: l.discountPct ? String(l.discountPct) : '', taxRatePct: String(l.taxRatePct ?? 0), hsnSac: String(l.hsnSac ?? '') })));
  }, [existing.data]);

  const placeOfSupply = pos || company.data?.stateCode || '29';
  const toBody = (l: Line) => ({ kind: l.kind, productId: l.productId, description: l.description, qty: Number(l.qty) || 0, unit: l.unit, rate: toPaise(l.rate || 0), discountPct: l.discountPct ? Number(l.discountPct) : null, taxRatePct: Number(l.taxRatePct) || 0, hsnSac: l.hsnSac || null });
  const calc = useMemo(() => {
    try {
      return computeDocument(lines.map(toBody), { gst: !!company.data?.gstRegistered, intraState: isIntraState(company.data?.stateCode ?? '29', placeOfSupply), overallDiscountPct: Number(overall) || 0, roundOff: true });
    } catch {
      return null;
    }
  }, [lines, company.data, placeOfSupply, overall]);  

  const upd = (i: number, k: keyof Line, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const pickProduct = (i: number, pid: string) => {
    const p = products.data?.find((x) => x.id === pid);
    if (!p) return;
    const d = p.data as { ratePaise: number; taxRatePct: number; hsnSac?: string; unit?: string; description?: string };
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, productId: pid, description: d.description ?? p.label, rate: String(d.ratePaise / 100), taxRatePct: String(d.taxRatePct), hsnSac: d.hsnSac ?? '', unit: d.unit ?? 'Nos' } : l)));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = { partyType, partyId, validDays: Number(validDays) || 15, placeOfSupply, overallDiscountPct: Number(overall) || 0, termsText: terms || null, notes: notes || null, lines: lines.filter((l) => l.kind === 'heading' ? l.description : l.description || l.rate).map(toBody) };
    try {
      const q = id ? await patch<{ id: string }>(`/quotes/${id}`, body, Number(existing.data?.version)) : await post<{ id: string }>('/quotes', body);
      toast('Draft saved');
      nav(`/sales/quotes/${q.id}`);
    } catch (e) {
      setError((e as ApiError).title);
    } finally {
      setBusy(false);
    }
  };

  if (id && existing.isLoading) return <Skeleton rows={6} />;
  const t = calc?.totals;
  return (
    <>
      <PageHeader back={id ? `/sales/quotes/${id}` : '/sales'} title={id ? 'Edit quotation' : 'New quotation'} subtitle="Drafts get a number when you send them." />
      {error && <div className="mb-3"><Banner tone="danger">{error}</Banner></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          {!id && (
            <Card title="For">
              <div className="grid gap-3 md:grid-cols-3">
                <SelectField label="Type" value={partyType} onChange={(e) => { setPartyType(e.target.value); setPartyId(''); }} options={[{ value: 'customer', label: 'Customer' }, { value: 'lead', label: 'Lead' }]} />
                <TextField label="Search" value={partySearch} onChange={(e) => setPartySearch(e.target.value)} placeholder="Name or phone" />
                <SelectField label={partyType === 'lead' ? 'Lead' : 'Customer'} required value={partyId} onChange={(e) => setPartyId(e.target.value)} placeholder="Choose…" options={[...(parties.data?.items ?? []).map((p) => ({ value: p.id, label: String(p.displayName ?? p.name) })), ...(partyId && !parties.data?.items.some((p) => p.id === partyId) ? [{ value: partyId, label: partyId }] : [])]} />
              </div>
            </Card>
          )}
          <Card title="Items">
            <div className="flex flex-col gap-3">
              {lines.map((l, i) => (
                <fieldset key={i} className="rounded-md border border-border p-3">
                  <legend className="px-1 text-xs text-muted">{l.kind === 'heading' ? 'Section heading' : `Line ${i + 1}`}</legend>
                  {l.kind === 'heading' ? (
                    <Input aria-label="Heading" value={l.description} onChange={(e) => upd(i, 'description', e.target.value)} placeholder="e.g. Hosting" />
                  ) : (
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                      <div className="col-span-2 md:col-span-3">
                        <Field label="Catalogue item">{(fid) => (
                          <Select id={fid} value={l.productId ?? ''} onChange={(e) => pickProduct(i, e.target.value)}>
                            <option value="">Free text</option>
                            {products.data?.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </Select>
                        )}</Field>
                      </div>
                      <div className="col-span-2 md:col-span-3"><TextField label="Description" value={l.description} onChange={(e) => upd(i, 'description', e.target.value)} /></div>
                      <TextField label="Qty" inputMode="decimal" value={l.qty} onChange={(e) => upd(i, 'qty', e.target.value)} />
                      <TextField label="Rate (₹)" inputMode="decimal" value={l.rate} onChange={(e) => upd(i, 'rate', e.target.value)} />
                      <TextField label="Discount %" inputMode="decimal" value={l.discountPct} onChange={(e) => upd(i, 'discountPct', e.target.value)} />
                      <SelectField label="GST %" value={l.taxRatePct} onChange={(e) => upd(i, 'taxRatePct', e.target.value)} options={['0', '5', '12', '18', '28'].map((r) => ({ value: r, label: `${r}%` }))} />
                      <TextField label="HSN/SAC" inputMode="numeric" value={l.hsnSac} onChange={(e) => upd(i, 'hsnSac', e.target.value)} />
                      <div className="flex items-end justify-between gap-2">
                        <span className="pb-3 text-sm tabular-nums">{calc ? money(calc.lines[i]?.total ?? 0) : '—'}</span>
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex justify-end"><Button size="sm" variant="ghost" onClick={() => setLines((ls) => ls.filter((_x, j) => j !== i))} disabled={lines.length === 1}>Remove</Button></div>
                </fieldset>
              ))}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setLines((ls) => [...ls, blank()])}>Add line</Button>
                <Button variant="ghost" onClick={() => setLines((ls) => [...ls, { ...blank(), kind: 'heading', qty: '0', taxRatePct: '0' }])}>Add heading</Button>
              </div>
            </div>
          </Card>
          <Card title="Terms">
            <div className="grid gap-3 md:grid-cols-3">
              <TextField label="Valid for (days)" inputMode="numeric" value={validDays} onChange={(e) => setValidDays(e.target.value)} />
              <SelectField label="Place of supply" value={placeOfSupply} onChange={(e) => setPos(e.target.value)} options={Object.entries(GST_STATES).map(([v, l]) => ({ value: v, label: `${l} (${v})` }))} />
              <TextField label="Overall discount %" inputMode="decimal" value={overall} onChange={(e) => setOverall(e.target.value)} />
            </div>
            <div className="mt-3"><Field label="Terms & conditions">{(fid) => <Textarea id={fid} rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Defaults from your terms template" />}</Field></div>
            <div className="mt-3"><Field label="Notes to customer">{(fid) => <Textarea id={fid} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field></div>
          </Card>
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card title="Totals">
            {!calc ? <p className="text-sm text-danger">Check the discounts — a discount can’t exceed the line amount.</p> : (
              <dl className="text-sm" aria-live="polite">
                {[['Sub-total', t!.subTotal], ['Discount', -t!.discountTotal], ['Taxable', t!.taxable], ...(t!.cgst ? [['CGST', t!.cgst], ['SGST', t!.sgst]] : []), ...(t!.igst ? [['IGST', t!.igst]] : []), ...(t!.roundOff ? [['Round-off', t!.roundOff]] : [])].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between py-1"><dt className="text-muted">{k}</dt><dd className="tabular-nums">{money(Number(v))}</dd></div>
                ))}
                <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(t!.grandTotal)}</dd></div>
                <p className="mt-1 text-xs text-muted">{t!.inWords}</p>
              </dl>
            )}
            <Button className="mt-4 w-full" busy={busy} disabled={!partyId || !calc} onClick={() => void save()}>Save draft</Button>
          </Card>
        </aside>
      </div>
    </>
  );
}
