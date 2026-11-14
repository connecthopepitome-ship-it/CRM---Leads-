/** SCR-031 Audit log (FR-016) and record history. */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { download, get, post, waitForJob } from '../../lib/api';
import { dateTime, today } from '../../lib/format';
import { Button, Card, Dialog, ErrorState, Skeleton, Table, TextField } from '../../ui';
import { errorToast } from '../../ui/toast';

type Entry = { id: string; at: string; userName: string; action: string; recordType: string | null; recordId: string | null; changes: { field: string; before: unknown; after: unknown }[]; ipMasked: string | null };

export function AuditLog() {
  const [params] = useSearchParams();
  const recordType = params.get('recordType');
  const recordId = params.get('recordId');
  const [from, setFrom] = useState(`${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today());
  const [action, setAction] = useState('');
  const [open, setOpen] = useState<Entry | null>(null);
  const filter = { from, to, action: action || null, recordType, recordId, limit: 100 };
  const q = useQuery({
    queryKey: ['audit', from, to, action, recordType, recordId],
    queryFn: () => (recordType && recordId ? get<{ items: Entry[] }>(`/history/${recordType}/${recordId}`) : post<{ items: Entry[] }>('/admin/audit/search', filter)),
  });
  const exportXlsx = async () => {
    try {
      const { jobId } = await post<{ jobId: string }>('/admin/audit/export', filter);
      const j = await waitForJob(jobId);
      if (j.result?.url) await download(j.result.url, 'audit-log.xlsx');
    } catch (e) {
      errorToast(e);
    }
  };
  return (
    <Card title={recordId ? `History of ${recordType} ${recordId}` : 'Audit log'} actions={!recordId && <Button size="sm" variant="secondary" onClick={() => void exportXlsx()}>Export</Button>}>
      {!recordId && (
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <TextField label="Action (e.g. invoice.issue)" value={action} onChange={(e) => setAction(e.target.value)} />
        </div>
      )}
      {q.isLoading ? <Skeleton /> : q.error ? <ErrorState error={q.error} /> : (
        <Table<Entry> rows={q.data!.items} onRow={setOpen} columns={[
          { key: 'at', label: 'When', render: (e) => dateTime(e.at) },
          { key: 'userName', label: 'Who' },
          { key: 'action', label: 'Action' },
          { key: 'record', label: 'Record', render: (e) => (e.recordType ? `${e.recordType} ${e.recordId ?? ''}` : '—') },
          { key: 'n', label: 'Changes', render: (e) => e.changes?.length ?? 0 },
        ]} />
      )}
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.action ?? ''}>
        {open && (
          <>
            <p className="mb-2 text-sm text-muted">{open.userName} · {dateTime(open.at)} · IP {open.ipMasked ?? '—'}</p>
            <Table rows={(open.changes ?? []).map((c, i) => ({ id: String(i), ...c }))} columns={[{ key: 'field', label: 'Field' }, { key: 'before', label: 'Before', render: (c) => JSON.stringify(c.before) ?? '—' }, { key: 'after', label: 'After', render: (c) => JSON.stringify(c.after) ?? '—' }]} empty={<p className="text-sm text-muted">No field changes recorded.</p>} />
          </>
        )}
      </Dialog>
    </Card>
  );
}
