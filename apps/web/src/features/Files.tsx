/** CMP-032 FileUpload / AttachmentList (FR-078, RULE-050): chunked, resumable upload through the API. */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { api, download, get, post } from '../lib/api';
import { dateTime } from '../lib/format';
import { Button, EmptyState, Skeleton, toast } from '../ui';
import { errorToast } from '../ui/toast';

const ALLOWED = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt';
const MAX = 25 * 1024 * 1024;

export function Files({ recordType, recordId }: { recordType: string; recordId: string }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const q = useQuery({ queryKey: ['files', recordId], queryFn: () => get<{ items: { id: string; name: string; size: number; mimeType: string; kind: string; createdAt: string }[] }>(`/files?recordType=${recordType}&recordId=${recordId}`) });

  const upload = async (file: File) => {
    if (file.size > MAX) return toast('Files must be 25 MB or smaller.', 'danger');
    try {
      const s = await post<{ sessionId: string; chunkSize: number }>('/files/uploads', { recordType, recordId, name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size });
      let offset = 0;
      while (offset < file.size) {
        const end = Math.min(file.size, offset + s.chunkSize);
        let attempt = 0;
        for (;;) {
          try {
            const r = await api<Response>(`/files/uploads/${s.sessionId}`, { method: 'PUT', body: file.slice(offset, end), headers: { 'Content-Range': `bytes ${offset}-${end - 1}/${file.size}`, 'Content-Type': 'application/octet-stream' }, raw: true });
            if (!r.ok && r.status !== 308) throw new Error((await r.json().catch(() => ({ title: 'Upload failed' }))).title);
            break;
          } catch (e) {
            if (++attempt >= 3) throw e; // FR-078 AC4: resume by retrying the same range
            await new Promise((res) => setTimeout(res, 1000 * attempt));
          }
        }
        offset = end;
        setProgress(Math.round((offset / file.size) * 100));
      }
      toast('File uploaded');
      void qc.invalidateQueries({ queryKey: ['files', recordId] });
    } catch (e) {
      errorToast(e);
    } finally {
      setProgress(null);
    }
  };

  return (
    <section aria-label="Documents">
      <div className="mb-3 flex items-center gap-2">
        <input ref={input} type="file" accept={ALLOWED} capture="environment" className="sr-only" id={`file-${recordId}`} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <Button onClick={() => input.current?.click()} busy={progress !== null}>{progress !== null ? `Uploading ${progress}%` : 'Upload file'}</Button>
        <span className="text-xs text-muted">PDF, images, Word, Excel, CSV, text · up to 25 MB</span>
      </div>
      {q.isLoading ? <Skeleton /> : !q.data?.items.length ? <EmptyState title="No documents yet" /> : (
        <ul className="flex flex-col gap-2">
          {q.data.items.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface p-3 text-sm">
              <span className="min-w-0 truncate">{f.name} <span className="text-muted">· {(f.size / 1024).toFixed(0)} KB · {dateTime(f.createdAt)}</span></span>
              <Button size="sm" variant="ghost" onClick={() => void download(`/api/v1/files/${f.id}/content?download=1`, f.name)}>Download</Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
