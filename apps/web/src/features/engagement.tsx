/** CMP-027 ActionBar, SCR-006 call outcome sheet, SCR-007 composer, notes, follow-ups, CMP-028 timeline (FR-035, FR-044 – FR-049, FR-081). */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MapPin, MessageCircle, Phone, StickyNote, CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { mapsLink } from '@ss/domain';
import { ApiError, get, post, patch, del } from '../lib/api';
import { dateTime, uid } from '../lib/format';
import { enqueue, onOutboxChange, pending, type OutboxItem } from '../lib/outbox';
import { Badge, Button, Dialog, EmptyState, Field, Select, SelectField, Skeleton, Textarea, TextField, toast } from '../ui';
import { errorToast } from '../ui/toast';
import { useOptions, type Activity } from './hooks';

interface RecordRef {
  recordType: 'lead' | 'customer';
  recordId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address?: string | null;
}

const PENDING_CALL = 'ss-pending-call';

export function ActionBar({ rec }: { rec: RecordRef }) {
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<null | 'outcome' | 'whatsapp' | 'email' | 'note' | 'followup'>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [showNumber, setShowNumber] = useState(false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['timeline', rec.recordId] });
    void qc.invalidateQueries({ queryKey: ['lead', rec.recordId] });
  };

  // FR-044 AC1: when the user returns from the dialer, open the outcome sheet
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const p = sessionStorage.getItem(PENDING_CALL);
      if (!p) return;
      const c = JSON.parse(p) as { id: string; recordId: string };
      if (c.recordId === rec.recordId) {
        setCallId(c.id);
        setSheet('outcome');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    onVis();
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [rec.recordId]);

  const call = async () => {
    const id = uid();
    sessionStorage.setItem(PENDING_CALL, JSON.stringify({ id, recordId: rec.recordId }));
    setCallId(id);
    try {
      await post('/activities', { clientId: id, recordType: rec.recordType, recordId: rec.recordId, type: 'call', status: 'pending' });
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'OFFLINE')) errorToast(e);
    }
    // Open tel: on all devices (mobile dialer, desktop Phone Link / FaceTime)
    if (rec.phone) {
      const cleanPhone = rec.phone.replace(/[^\d+]/g, '');
      const a = document.createElement('a');
      a.href = `tel:${cleanPhone}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setShowNumber(true);
    setSheet('outcome');
  };

  const btn = 'flex min-h-touch flex-1 flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface px-2 text-xs font-medium hover:bg-surface-2 disabled:opacity-50';
  return (
    <>
      <div className="grid grid-cols-6 gap-2" role="toolbar" aria-label="Actions">
        <button className={btn} onClick={() => void call()} disabled={!rec.phone}><Phone size={18} aria-hidden />Call</button>
        <button className={btn} onClick={() => setSheet('whatsapp')}><MessageCircle size={18} aria-hidden />WhatsApp</button>
        <button className={btn} onClick={() => setSheet('email')} disabled={!rec.email}><Mail size={18} aria-hidden />Email</button>
        <a className={btn} href={rec.address ? mapsLink(rec.address) : undefined} target="_blank" rel="noreferrer" aria-disabled={!rec.address}><MapPin size={18} aria-hidden />Directions</a>
        <button className={btn} onClick={() => setSheet('note')}><StickyNote size={18} aria-hidden />Note</button>
        <button className={btn} onClick={() => setSheet('followup')}><CalendarPlus size={18} aria-hidden />Follow-up</button>
      </div>
      {sheet === 'outcome' && callId && (
        <CallOutcomeSheet rec={rec} activityId={callId} showNumber={showNumber} onClose={(saved) => {
          sessionStorage.removeItem(PENDING_CALL);
          setSheet(null);
          setShowNumber(false);
          if (!saved) toast('Call saved without an outcome — add it from the timeline', 'info');
          refresh();
        }} />
      )}
      {sheet === 'whatsapp' && <WhatsAppComposer rec={rec} onClose={() => { setSheet(null); refresh(); }} />}
      {sheet === 'email' && <EmailComposer rec={rec} onClose={() => { setSheet(null); refresh(); }} />}
      {sheet === 'note' && <NoteSheet rec={rec} onClose={() => { setSheet(null); refresh(); }} />}
      {sheet === 'followup' && <FollowUpSheet rec={rec} onClose={() => { setSheet(null); refresh(); }} />}
    </>
  );
}

function CallOutcomeSheet({ rec, activityId, showNumber, onClose }: { rec: RecordRef; activityId: string; showNumber: boolean; onClose(saved: boolean): void }) {
  const outcomes = useOptions('callOutcomes');
  const defaultOutcomes = [
    { id: 'connected', label: 'Connected' },
    { id: 'no_answer', label: 'No answer' },
    { id: 'busy', label: 'Busy' },
    { id: 'wrong_number', label: 'Wrong number' },
    { id: 'call_back_later', label: 'Call back later' },
  ];
  const outcomeList = outcomes.data && outcomes.data.length > 0 ? outcomes.data : defaultOutcomes;
  const [outcomeId, setOutcomeId] = useState('');
  const [note, setNote] = useState('');
  const [fu, setFu] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const payload = { outcomeId, note: note || null, followUp: fu ? { dueAt: new Date(fu).toISOString(), type: 'call' } : null };
    try {
      if (!navigator.onLine) throw new ApiError(0, 'OFFLINE', 'offline');
      await post(`/activities/${activityId}/outcome`, payload);
      toast('Call outcome saved', 'success');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OFFLINE') {
        await enqueue('call_outcome', { activityId, recordType: rec.recordType, recordId: rec.recordId, ...payload });
        toast('Saved — will sync when online', 'info');
      } else {
        errorToast(e);
        setBusy(false);
        return;
      }
    }
    onClose(true);
  };
  return (
    <Dialog open sheet onClose={() => onClose(false)} title={`How did the call with ${rec.name} go?`} footer={<Button disabled={!outcomeId} busy={busy} onClick={() => void save()}>Save outcome</Button>}>
      {showNumber && rec.phone && (
        <p className="mb-3 flex items-center gap-2 text-sm">Call <b>{rec.phone}</b> <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(rec.phone!)}>Copy</Button></p>
      )}
      <fieldset className="mb-3">
        <legend className="mb-2 text-sm font-medium">Outcome</legend>
        <div className="grid grid-cols-2 gap-2">
          {outcomeList.map((o) => (
            <label key={o.id} className={`flex min-h-touch cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${outcomeId === o.id ? 'border-primary bg-primary-subtle font-medium text-primary' : 'border-border'}`}>
              <input type="radio" name="outcome" value={o.id} checked={outcomeId === o.id} onChange={() => setOutcomeId(o.id)} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Note">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Summary of the conversation..." />}</Field>
      <div className="mt-3"><TextField label="Next follow-up (optional)" type="datetime-local" value={fu} onChange={(e) => setFu(e.target.value)} /></div>
    </Dialog>
  );
}

function WhatsAppComposer({ rec, onClose }: { rec: RecordRef; onClose(): void }) {
  const templates = useOptions('messageTemplates');
  const isDocument = rec.recordType === 'quote' || rec.recordType === 'invoice';
  const wa = (templates.data ?? []).filter((t: any) => {
    const isWa = (t?.data?.channel || t?.channel) === 'whatsapp';
    if (!isWa) return false;
    const isDocTpl = (t?.data?.category || t?.category) === 'document' || t?.key === 'invoice' || t?.key === 'quote';
    return isDocument ? isDocTpl : !isDocTpl;
  });
  const [templateId, setTemplateId] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t: any = wa.find((x: any) => x.id === templateId);
    if (t) {
      const raw = String(t.data?.body || t.body || '');
      const filled = raw
        .replace(/\{\{\s*name\s*\}\}|\{\s*name\s*\}/gi, rec.name || 'Valued Customer')
        .replace(/\{\{\s*company\s*\}\}|\{\s*company\s*\}/gi, (rec as any).company || rec.name || 'your company')
        .replace(/\{\{\s*doc_no\s*\}\}|\{\s*doc_no\s*\}/gi, (rec as any).docNo || (rec as any).number || '')
        .replace(/\{\{\s*amount\s*\}\}|\{\s*amount\s*\}/gi, (rec as any).amount || '')
        .replace(/\{\{\s*link\s*\}\}|\{\s*link\s*\}/gi, (rec as any).link || '');
      setText(filled);
    }
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = async () => {
    setBusy(true);
    try {
      const r = await post<{ url: string }>('/messages/whatsapp', { recordType: rec.recordType, recordId: rec.recordId, text });
      window.open(r.url, '_blank', 'noopener');
      toast('WhatsApp opened and activity logged', 'success');
      onClose();
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open sheet onClose={onClose} title="WhatsApp message" footer={<Button busy={busy} disabled={!text.trim()} onClick={() => void open()}>Open WhatsApp</Button>}>
      <SelectField label="Template" placeholder="Choose a template (optional)" value={templateId} onChange={(e) => setTemplateId(e.target.value)} options={wa.map((t: any) => ({ value: t.id, label: t.label }))} />
      <div className="mt-3"><Field label="Message">{(id) => <Textarea id={id} rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type WhatsApp message..." />}</Field></div>
      <p className="mt-2 text-xs text-muted">Opens WhatsApp Web or App with the pre-filled message.</p>
    </Dialog>
  );
}

function EmailComposer({ rec, onClose }: { rec: RecordRef; onClose(): void }) {
  const templates = useOptions('messageTemplates');
  const isDocument = rec.recordType === 'quote' || rec.recordType === 'invoice';
  const emailTemplates = (templates.data ?? []).filter((t: any) => {
    const isEmail = (t?.data?.channel || t?.channel) === 'email';
    if (!isEmail) return false;
    const isDocTpl = (t?.data?.category || t?.category) === 'document' || t?.key === 'email_invoice' || t?.key === 'email_quote';
    return isDocument ? isDocTpl : !isDocTpl;
  });
  const [templateId, setTemplateId] = useState('');
  const [to, setTo] = useState(rec.email ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSaleSphereSend, setShowSaleSphereSend] = useState(false);

  useEffect(() => {
    const t: any = emailTemplates.find((x: any) => x.id === templateId);
    if (t) {
      const rawSubject = String(t.data?.subject || t.subject || 'Proposal from HopEpitome Strategics');
      const rawBody = String(t.data?.body || t.body || '');
      const fill = (str: string) => str
        .replace(/\{\{\s*name\s*\}\}|\{\s*name\s*\}/gi, rec.name || 'Valued Customer')
        .replace(/\{\{\s*company\s*\}\}|\{\s*company\s*\}/gi, (rec as any).company || rec.name || 'your company')
        .replace(/\{\{\s*doc_no\s*\}\}|\{\s*doc_no\s*\}/gi, (rec as any).docNo || (rec as any).number || '')
        .replace(/\{\{\s*amount\s*\}\}|\{\s*amount\s*\}/gi, (rec as any).amount || '')
        .replace(/\{\{\s*link\s*\}\}|\{\s*link\s*\}/gi, (rec as any).link || '');

      setSubject(fill(rawSubject));
      setBody(fill(rawBody));
    }
  }, [templateId]);

  // Primary action: Open device default mail app
  const openMailApp = async () => {
    setBusy(true);
    try {
      await post('/activities', {
        recordType: rec.recordType,
        recordId: rec.recordId,
        type: 'email',
        summary: `Email composed: ${subject || 'No subject'}`,
        note: subject + (body ? '\n\n' + body : ''),
      });
      const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoUrl;
      toast('Opened in default mail app and logged to timeline', 'info');
      onClose();
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(false);
    }
  };

  // Secondary action: Send via SaleSphere Gmail integration
  const sendViaSaleSphere = async () => {
    setBusy(true);
    try {
      await post('/emails', { recordType: rec.recordType, recordId: rec.recordId, to: to.split(/[,;\s]+/).filter(Boolean), subject, html: body.replace(/\n/g, '<br>') });
      toast('Email sent via SaleSphere');
      onClose();
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      sheet
      onClose={onClose}
      title="Compose Email"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowSaleSphereSend(!showSaleSphereSend)}>
            {showSaleSphereSend ? 'Back to default' : 'Send via SaleSphere (Gmail)'}
          </Button>
          {showSaleSphereSend ? (
            <Button busy={busy} disabled={!to || !subject} onClick={() => void sendViaSaleSphere()}>
              Send via SaleSphere
            </Button>
          ) : (
            <Button busy={busy} disabled={!to} onClick={() => void openMailApp()}>
              Open Mail App
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {emailTemplates.length > 0 && (
          <SelectField
            label="Template"
            placeholder="Choose a template (optional)"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            options={emailTemplates.map((t: any) => ({ value: t.id, label: t.label }))}
          />
        )}
        <TextField label="To" type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
        <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
        <Field label="Message">{(id) => <Textarea id={id} rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your message..." />}</Field>
      </div>
    </Dialog>
  );
}

function NoteSheet({ rec, onClose }: { rec: RecordRef; onClose(): void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const clientId = uid();
    try {
      if (!navigator.onLine) throw new ApiError(0, 'OFFLINE', 'offline');
      await post('/activities', { clientId, recordType: rec.recordType, recordId: rec.recordId, type: 'note', note });
      toast('Note added');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OFFLINE') {
        await enqueue('note', { recordType: rec.recordType, recordId: rec.recordId, note }, clientId);
        toast('Will sync when online', 'info');
      } else {
        errorToast(e);
        setBusy(false);
        return;
      }
    }
    onClose();
  };
  return (
    <Dialog open sheet onClose={onClose} title="Add a note" footer={<Button busy={busy} disabled={!note.trim()} onClick={() => void save()}>Save note</Button>}>
      <Field label="Note">{(id) => <Textarea id={id} rows={5} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />}</Field>
    </Dialog>
  );
}

function FollowUpSheet({ rec, onClose }: { rec: RecordRef; onClose(): void }) {
  const [dueAt, setDueAt] = useState('');
  const [type, setType] = useState('call');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const payload = { recordType: rec.recordType, recordId: rec.recordId, dueAt: new Date(dueAt).toISOString(), type, note: note || null };
    const clientId = uid();
    try {
      if (!navigator.onLine) throw new ApiError(0, 'OFFLINE', 'offline');
      await post('/follow-ups', { ...payload, clientId });
      toast('Follow-up scheduled');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OFFLINE') {
        await enqueue('follow_up', payload, clientId);
        toast('Will sync when online', 'info');
      } else {
        errorToast(e);
        setBusy(false);
        return;
      }
    }
    onClose();
  };
  return (
    <Dialog open sheet onClose={onClose} title="Schedule a follow-up" footer={<Button busy={busy} disabled={!dueAt} onClick={() => void save()}>Schedule</Button>}>
      <div className="flex flex-col gap-3">
        <TextField label="When" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
        <Field label="Type">{(id) => <Select id={id} value={type} onChange={(e) => setType(e.target.value)}>{['call', 'whatsapp', 'email', 'visit', 'other'].map((t) => <option key={t} value={t}>{t}</option>)}</Select>}</Field>
        <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Dialog>
  );
}

const TYPE_LABEL: Record<string, string> = { call: 'Call', whatsapp: 'WhatsApp', email: 'Email', note: 'Note', stage: 'Stage', assign: 'Assignment', system: 'Update', quote: 'Quotation', invoice: 'Invoice', payment: 'Payment', file: 'File', visit: 'Visit' };

export function Timeline({ recordType, recordId }: { recordType: 'lead' | 'customer'; recordId: string }) {
  const qc = useQueryClient();
  const [type, setType] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const q = useQuery({ queryKey: ['timeline', recordId, type], queryFn: () => get<{ items: Activity[] }>(`/timeline/${recordType}/${recordId}?limit=100${type ? `&types=${type}` : ''}`), enabled: Boolean(recordId && recordId !== 'undefined') });
  const [queued, setQueued] = useState<OutboxItem[]>([]);
  useEffect(() => {
    const load = () => void pending().then((p) => setQueued(p.filter((i) => i.payload.recordId === recordId)));
    load();
    return onOutboxChange(load);
  }, [recordId]);

  const handleDelete = async (actId: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await del(`/activities/${actId}`);
      toast('Note deleted', 'success');
      void qc.invalidateQueries({ queryKey: ['timeline', recordId] });
    } catch (e) {
      errorToast(e);
    }
  };

  const handleSaveEdit = async (actId: string) => {
    try {
      await patch(`/activities/${actId}`, { note: editText });
      toast('Note updated', 'success');
      setEditingId(null);
      void qc.invalidateQueries({ queryKey: ['timeline', recordId] });
    } catch (e) {
      errorToast(e);
    }
  };

  return (
    <section aria-labelledby="tl-h">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="tl-h" className="text-base font-semibold">Timeline</h2>
        <Select aria-label="Filter timeline" className="w-40" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All activity</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      {q.isLoading ? <Skeleton /> : (
        <ol className="flex flex-col gap-2">
          {queued.map((i) => (
            <li key={i.clientId} className="rounded-md border border-dashed border-warning p-3 text-sm">
              <Badge tone={i.status === 'failed' ? 'danger' : 'warning'}>{i.status === 'failed' ? `Sync failed: ${i.error}` : 'Will sync'}</Badge> <span className="ml-1">{String(i.payload.note ?? i.kind.replace('_', ' '))}</span>
            </li>
          ))}
          {!(q.data?.items ?? []).length && !queued.length && <EmptyState title="No activity yet" body="Calls, messages, notes and documents appear here." />}
          {(q.data?.items ?? []).map((a) => (
            <li key={a.id} className="rounded-md border border-border bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={a.status === 'failed' ? 'danger' : a.status === 'pending' ? 'warning' : 'neutral'}>{TYPE_LABEL[a.type] ?? a.type}</Badge>
                {a.outcomeLabel && <Badge tone="info">{a.outcomeLabel}</Badge>}
                {a.status === 'pending' && a.type === 'call' && <span className="text-xs text-warning">Outcome not recorded</span>}
                <span className="ml-auto text-xs text-muted">{a.userName} · {dateTime(a.occurredAt)}</span>
                {a.type === 'note' && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(a.id);
                        setEditText(a.note || '');
                      }}
                      className="p-1 text-[#778477] hover:text-[#3D7952] rounded"
                      title="Edit note"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(a.id)}
                      className="p-1 text-[#778477] hover:text-red-600 rounded"
                      title="Delete note"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
              {editingId === a.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button size="sm" onClick={() => void handleSaveEdit(a.id)}>Save</Button>
                  </div>
                </div>
              ) : (
                a.note && <p className="mt-1 whitespace-pre-wrap">{a.note}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
