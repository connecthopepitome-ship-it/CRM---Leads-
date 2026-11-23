/** SCR-024 / CMP-026 global search (FR-083). */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../lib/api';
import { Dialog, Input, Skeleton } from '../ui';

interface Hit {
  id: string;
  title: string;
  subtitle?: string;
  link: string;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose(): void }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const nav = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);
  const res = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => get<{ groups: Record<string, Hit[]> }>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length >= 2,
  });
  const groups = Object.entries(res.data?.groups ?? {});
  return (
    <Dialog open={open} onClose={onClose} title="Search">
      <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, email, GSTIN or document number" aria-label="Search" />
      <div className="mt-3 flex flex-col gap-3" aria-live="polite">
        {res.isLoading && debounced.length >= 2 && <Skeleton rows={3} />}
        {res.isError && debounced.length >= 2 && <p className="text-sm text-[#D66B68]">Failed to search. Please try again.</p>}
        {debounced.length >= 2 && !res.isLoading && !res.isError && !groups.length && <p className="text-sm text-muted">No matches for “{debounced}”.</p>}
        {groups.map(([g, hits]) => (
          <div key={g}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{g}</h3>
            <ul>
              {(hits ?? []).map((h) => (
                <li key={h.id}>
                  <button onClick={() => { onClose(); nav(h.link); }} className="flex min-h-touch w-full flex-col items-start rounded-md px-2 py-1 text-left hover:bg-primary-subtle">
                    <span className="font-medium">{h.title}</span>
                    {h.subtitle && <span className="text-xs text-muted">{h.subtitle}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
