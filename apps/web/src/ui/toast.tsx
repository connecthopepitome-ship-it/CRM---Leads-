/** CMP-017 Toast — polite live region. */
import { useEffect, useState } from 'react';

interface T {
  id: number;
  text: string;
  tone: 'success' | 'danger' | 'info';
}
let items: T[] = [];
const subs = new Set<(t: T[]) => void>();
let n = 0;

export function create(text: string, tone: T['tone'] = 'success') {
  const t = { id: ++n, text, tone };
  items = [...items, t];
  subs.forEach((s) => s(items));
  setTimeout(() => {
    items = items.filter((x) => x.id !== t.id);
    subs.forEach((s) => s(items));
  }, 4500);
}

export function errorToast(e: unknown) {
  create((e as { title?: string })?.title ?? (e as Error)?.message ?? 'Something went wrong.', 'danger');
}

export function Toaster() {
  const [list, setList] = useState<T[]>(items);
  useEffect(() => {
    subs.add(setList);
    return () => void subs.delete(setList);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {list.map((t) => (
        <div key={t.id} role={t.tone === 'danger' ? 'alert' : 'status'} className={`pointer-events-auto max-w-md rounded-md px-4 py-3 text-sm shadow-2 ${t.tone === 'danger' ? 'bg-danger text-primary-fg' : t.tone === 'info' ? 'bg-text text-surface' : 'bg-success text-primary-fg'}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
