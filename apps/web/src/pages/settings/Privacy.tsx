/** SCR-032 Privacy requests: find, export, erase (FR-087, FR-088). */
import { useState } from 'react';
import { download, post, waitForJob } from '../../lib/api';
import { Banner, Button, Card, Dialog, TextField, toast } from '../../ui';
import { errorToast } from '../../ui/toast';

interface Found {
  personKey: string;
  counts: Record<string, number>;
  plan: { mode: 'delete' | 'anonymise'; keep: string[] };
  records: { type: string; id: string; name: string }[];
}

export function Privacy() {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const find = async () => {
    setBusy(true);
    try {
      setFound(await post<Found>('/admin/privacy/find', { phone: phone || null, email: email || null }));
    } catch (e) {
      errorToast(e);
      setFound(null);
    } finally {
      setBusy(false);
    }
  };
  const exportData = async () => {
    try {
      const { jobId } = await post<{ jobId: string }>('/admin/privacy/export', { personKey: found!.personKey });
      const j = await waitForJob(jobId);
      if (j.result?.url) await download(j.result.url, 'personal-data-export.xlsx');
    } catch (e) {
      errorToast(e);
    }
  };
  const erase = async () => {
    try {
      const { jobId } = await post<{ jobId: string }>('/admin/privacy/erase', { personKey: found!.personKey, confirm: typed });
      await waitForJob(jobId);
      toast('Personal data erased');
      setConfirm(false);
      setFound(null);
    } catch (e) {
      errorToast(e);
    }
  };
  return (
    <Card title="Privacy requests (DPDP)">
      <div className="mb-3 grid gap-2 md:grid-cols-3">
        <TextField label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button className="self-end" busy={busy} disabled={!phone && !email} onClick={() => void find()}>Find records</Button>
      </div>
      {found && (
        <div className="flex flex-col gap-3 text-sm">
          <p>{Object.entries(found.counts).map(([k, v]) => `${v} ${k}`).join(' · ')}</p>
          <Banner tone="info">{found.plan.mode === 'delete' ? 'No financial documents: erasing deletes the leads, contacts, activities, quotations and files.' : `Financial documents exist: contact details, notes and activities are anonymised; ${found.plan.keep.join(', ')} are kept as required by law.`}</Banner>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void exportData()}>Export personal data</Button>
            <Button variant="danger" onClick={() => setConfirm(true)}>Erase…</Button>
          </div>
        </div>
      )}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Erase this person’s data?" footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" disabled={typed !== 'ERASE'} onClick={() => void erase()}>Erase permanently</Button></>}>
        <p className="mb-3 text-sm">This can’t be undone. Backups keep a copy for up to about 35 days and are re-erased after any restore.</p>
        <TextField label="Type ERASE to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </Dialog>
    </Card>
  );
}
