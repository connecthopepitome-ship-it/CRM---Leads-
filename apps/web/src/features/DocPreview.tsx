/** CMP-042 DocumentPreview: sandboxed iframe with the same HTML template used for the PDF. */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Skeleton } from '../ui';

export function DocPreview({ type, id, version }: { type: 'quote' | 'order' | 'invoice' | 'receipt' | 'credit_note'; id: string; version?: number }) {
  const q = useQuery({
    queryKey: ['preview', type, id, version],
    queryFn: async () => {
      const r = await api<Response>(`/documents/${type}/${id}/preview`, { raw: true });
      return r.text();
    },
  });
  if (q.isLoading) return <Skeleton rows={8} />;
  return <iframe title="Document preview" className="doc-frame" sandbox="" srcDoc={q.data ?? ''} />;
}
