/** Component kit (design-system.md CMP-xxx). Tokens only — no raw colours or spacing. */
import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { create } from './toast';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// CMP-001 Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean; size?: 'sm' | 'md' }>(
  ({ variant = 'primary', busy, size = 'md', className, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed select-none',
        size === 'md' ? 'min-h-[40px] px-4 text-xs sm:text-sm' : 'min-h-[34px] px-3 text-xs',
        variant === 'primary' && 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm shadow-indigo-500/20',
        variant === 'secondary' && 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs',
        variant === 'ghost' && 'text-indigo-600 hover:bg-indigo-50',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-500/20',
        className,
      )}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export function LinkButton({ to, children, variant = 'secondary', className }: { to: string; children: ReactNode; variant?: Variant; className?: string }) {
  return (
    <Link to={to} className={cx('inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 select-none', variant === 'primary' ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-500/20' : variant === 'ghost' ? 'text-indigo-600 hover:bg-indigo-50' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs', className)}>
      {children}
    </Link>
  );
}

// CMP-008 FormField + CMP-003/004/006
interface FieldProps {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}
export function Field({ label, error, hint, required, children }: FieldProps) {
  const id = useId();
  const desc = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-700 tracking-tight">
        <label htmlFor={id}>{label}</label>
        {required && <span className="text-rose-500" aria-hidden> *</span>}
      </span>
      {children(id, desc)}
      {hint && !error && <p id={`${id}-hint`} className="text-[11px] text-slate-400">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-rose-600 font-medium">{error}</p>}
    </div>
  );
}
const inputCls = 'min-h-[42px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition-all shadow-2xs hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 aria-[invalid=true]:border-rose-500 aria-[invalid=true]:focus:ring-rose-500/10';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cx(inputCls, className)} {...p} />);
Input.displayName = 'Input';
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cx(inputCls, 'cursor-pointer', className)} {...p} />);
Select.displayName = 'Select';
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cx(inputCls, 'min-h-[88px] py-2.5', className)} {...p} />);
Textarea.displayName = 'Textarea';

/** Labelled input in one line. */
export function TextField({ label, error, hint, required, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null; hint?: string }) {
  return <Field label={label} error={error} hint={hint} required={required}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!error} required={required} {...p} />}</Field>;
}
export function SelectField({ label, error, options, required, placeholder, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string | null; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <Field label={label} error={error} required={required}>
      {(id, d) => (
        <Select id={id} aria-describedby={d} aria-invalid={!!error} required={required} {...p}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      )}
    </Field>
  );
}

// CMP-012 Card, CMP-013 StatTile
export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          {title && <h2 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
export function StatTile({ label, value, tone, to }: { label: string; value: ReactNode; tone?: 'danger' | 'warning' | 'success'; to?: string }) {
  const body = (
    <div className={cx('flex h-full flex-col gap-1 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all', to && 'hover:border-indigo-400 hover:shadow-md')}>
      <span className="text-xs font-semibold tracking-wide text-slate-500">{label}</span>
      <span className={cx('text-2xl font-bold tabular-nums tracking-tight text-slate-900', tone === 'danger' && 'text-rose-600', tone === 'warning' && 'text-amber-600', tone === 'success' && 'text-emerald-600')}>{value}</span>
    </div>
  );
  return to ? <Link to={to} className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">{body}</Link> : body;
}

// CMP-019 Badge / StatusChip
const TONES: Record<string, string> = {
  success: 'bg-success-subtle text-success', warning: 'bg-warning-subtle text-warning', danger: 'bg-danger-subtle text-danger', info: 'bg-primary-subtle text-primary-hover', neutral: 'bg-surface-2 text-muted',
};
const STATUS_TONE: Record<string, keyof typeof TONES> = {
  paid: 'success', accepted: 'success', won: 'success', met: 'success', connected: 'success', active: 'success', done: 'success', delivered: 'success', closed: 'neutral',
  overdue: 'danger', breached: 'danger', lost: 'danger', rejected: 'danger', cancelled: 'danger', failed: 'danger', reversed: 'danger', junk: 'neutral',
  pending_approval: 'warning', partly_paid: 'warning', pending: 'warning', changes_requested: 'warning', on_hold: 'warning',
  sent: 'info', viewed: 'info', issued: 'info', approved: 'info', confirmed: 'info', in_progress: 'info', new: 'info',
};
export function Badge({ children, tone, status }: { children?: ReactNode; tone?: keyof typeof TONES; status?: string | null }) {
  const t = tone ?? (status ? STATUS_TONE[status] : undefined) ?? 'neutral';
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', TONES[t])}>{children ?? (status ? status.replace(/_/g, ' ') : '')}</span>;
}

// CMP-018 Alert / Banner
export function Banner({ tone = 'info', children, action }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode; action?: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex flex-wrap items-center justify-between gap-2 rounded-md px-4 py-3 text-sm', TONES[tone])}>
      <div>{children}</div>
      {action}
    </div>
  );
}

// CMP-021 EmptyState, CMP-022 Skeleton
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden className="text-primary"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 26h16M16 20h10" stroke="currentColor" strokeWidth="2" /></svg>
      <p className="font-medium">{title}</p>
      {body && <p className="text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_x, i) => <div key={i} className="h-12 animate-pulse rounded-md bg-surface-2" />)}
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = (error as { title?: string; message?: string })?.title ?? (error as Error)?.message ?? 'Something went wrong.';
  return <Banner tone="danger" action={retry && <Button variant="secondary" size="sm" onClick={retry}>Try again</Button>}>{msg}</Banner>;
}

// CMP-025 PageHeader
export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link to={back} className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors group">
            <span className="transition-transform group-hover:-translate-x-0.5">←</span>
            <span>Back</span>
          </Link>
        )}
        <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

// CMP-014 Tabs (links, so tabs live in the URL)
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange(id: string): void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)} className={cx('min-h-touch whitespace-nowrap border-b-2 px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary', active === t.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// CMP-015 Dialog / CMP-016 Sheet (native <dialog> = focus trap + Esc + inert background)
export function Dialog({ open, onClose, title, children, footer, sheet }: { open: boolean; onClose(): void; title: string; children: ReactNode; footer?: ReactNode; sheet?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dlg-title" className={cx('w-full max-w-lg rounded-lg bg-surface p-0 text-text shadow-3 backdrop:bg-overlay/50', sheet && 'mb-0 mt-auto max-w-none rounded-b-none md:mb-auto md:max-w-lg md:rounded-lg')}>
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="dlg-title" className="text-base font-semibold">{title}</h2>
            <button onClick={onClose} className="min-h-touch min-w-touch rounded-md hover:bg-surface-2" aria-label="Close">✕</button>
          </div>
          <div className="overflow-y-auto p-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-4 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

// CMP-009 DataTable (desktop) — simple and accessible
export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  align?: 'right';
}
export function Table<T extends { id?: string }>({ columns, rows, onRow, empty }: { columns: Column<T>[]; rows: T[]; onRow?: (r: T) => void; empty?: ReactNode }) {
  if (!rows.length) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={cx('px-3 py-2 font-medium', c.align === 'right' && 'text-right')}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className={cx('border-t border-border', onRow && 'cursor-pointer hover:bg-primary-subtle')} onClick={onRow ? () => onRow(r) : undefined}>
              {columns.map((c, ci) => (
                <td key={c.key} className={cx('px-3 py-2', c.align === 'right' && 'text-right tabular-nums')}>
                  {ci === 0 && onRow ? <button className="text-left font-medium text-primary hover:underline" onClick={(e) => { e.stopPropagation(); onRow(r); }}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '')}</button> : c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-border py-1">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right font-medium">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export const toast = create;
export { Toaster } from './toast';
