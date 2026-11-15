/** Grovia-inspired Component Kit (Minimalist Sage-Green SaaS Design System) */
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
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3D7952] disabled:opacity-50 disabled:cursor-not-allowed select-none',
        size === 'md' ? 'min-h-[40px] px-4 text-xs sm:text-sm' : 'min-h-[34px] px-3 text-xs',
        variant === 'primary' && 'bg-[#3D7952] text-white hover:bg-[#233D2D] active:bg-[#1C3224] shadow-xs',
        variant === 'secondary' && 'border border-[#DCE7D9] bg-white text-[#202820] hover:bg-[#F5F9F2] hover:border-[#CFE5CB] shadow-2xs',
        variant === 'ghost' && 'text-[#3D7952] hover:bg-[#E3EFDF]/70',
        variant === 'danger' && 'bg-[#D66B68] text-white hover:bg-[#C25855] shadow-xs',
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
    <Link
      to={to}
      className={cx(
        'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3D7952] select-none',
        variant === 'primary' ? 'bg-[#3D7952] text-white hover:bg-[#233D2D] shadow-xs' : variant === 'ghost' ? 'text-[#3D7952] hover:bg-[#E3EFDF]/70' : 'border border-[#DCE7D9] bg-white text-[#202820] hover:bg-[#F5F9F2] hover:border-[#CFE5CB] shadow-2xs',
        className,
      )}
    >
      {children}
    </Link>
  );
}

// CMP-008 FormField
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
      <span className="text-xs font-semibold text-[#202820] tracking-tight">
        <label htmlFor={id}>{label}</label>
        {required && <span className="text-[#D66B68]" aria-hidden> *</span>}
      </span>
      {children(id, desc)}
      {hint && !error && <p id={`${id}-hint`} className="text-[11px] text-[#778477]">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-[#D66B68] font-medium">{error}</p>}
    </div>
  );
}

const inputCls = 'min-h-[42px] w-full rounded-xl border border-[#DCE7D9] bg-white px-3.5 py-2 text-sm text-[#202820] placeholder:text-[#778477]/60 transition-all shadow-2xs hover:border-[#CFE5CB] focus:border-[#3D7952] focus:outline-none focus:ring-4 focus:ring-[#3D7952]/10 aria-[invalid=true]:border-[#D66B68] aria-[invalid=true]:focus:ring-[#D66B68]/10';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cx(inputCls, className)} {...p} />);
Input.displayName = 'Input';
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cx(inputCls, 'cursor-pointer', className)} {...p} />);
Select.displayName = 'Select';
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cx(inputCls, 'min-h-[88px] py-2.5', className)} {...p} />);
Textarea.displayName = 'Textarea';

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
    <section className={cx('rounded-2xl border border-[#DCE7D9] bg-white p-5 shadow-2xs', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-[#DCE7D9]/60 pb-3">
          {title && <h2 className="text-sm font-bold text-[#202820] tracking-tight">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, tone, to }: { label: string; value: ReactNode; tone?: 'danger' | 'warning' | 'success'; to?: string }) {
  const body = (
    <div className={cx('flex h-full flex-col gap-1 rounded-2xl border border-[#DCE7D9] bg-white p-4 shadow-2xs transition-all', to && 'hover:border-[#3D7952] hover:shadow-xs')}>
      <span className="text-xs font-semibold tracking-wide text-[#778477]">{label}</span>
      <span className={cx('text-2xl font-bold tabular-nums tracking-tight text-[#202820]', tone === 'danger' && 'text-[#D66B68]', tone === 'warning' && 'text-[#D99A45]', tone === 'success' && 'text-[#3D7952]')}>{value}</span>
    </div>
  );
  return to ? <Link to={to} className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3D7952]">{body}</Link> : body;
}

// CMP-019 Badge / StatusChip
const TONES: Record<string, string> = {
  success: 'bg-[#EAF5E8] text-[#3D7952] border border-[#CFE5CB]',
  warning: 'bg-[#FDF5E8] text-[#D99A45] border border-[#FBE0B5]',
  danger: 'bg-[#FDF0EF] text-[#D66B68] border border-[#F8CCCC]',
  info: 'bg-[#EDF5EA] text-[#3D7952] border border-[#DCE7D9]',
  neutral: 'bg-[#F5F9F2] text-[#778477] border border-[#DCE7D9]',
};
const STATUS_TONE: Record<string, keyof typeof TONES> = {
  paid: 'success', accepted: 'success', won: 'success', met: 'success', connected: 'success', active: 'success', done: 'success', delivered: 'success', closed: 'neutral',
  overdue: 'danger', breached: 'danger', lost: 'danger', rejected: 'danger', cancelled: 'danger', failed: 'danger', reversed: 'danger', junk: 'neutral',
  pending_approval: 'warning', partly_paid: 'warning', pending: 'warning', changes_requested: 'warning', on_hold: 'warning', negotiation: 'warning',
  sent: 'info', viewed: 'info', issued: 'info', approved: 'info', confirmed: 'info', in_progress: 'info', new: 'info', contacted: 'info', interested: 'info',
};
export function Badge({ children, tone, status }: { children?: ReactNode; tone?: keyof typeof TONES; status?: string | null }) {
  const t = tone ?? (status ? STATUS_TONE[status] : undefined) ?? 'neutral';
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[t])}>{children ?? (status ? status.replace(/_/g, ' ') : '')}</span>;
}

// CMP-018 Alert / Banner
export function Banner({ tone = 'info', children, action }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode; action?: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm', TONES[tone])}>
      <div>{children}</div>
      {action}
    </div>
  );
}

// CMP-021 EmptyState, CMP-022 Skeleton
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#DCE7D9] bg-white p-8 text-center">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden className="text-[#3D7952]"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 26h16M16 20h10" stroke="currentColor" strokeWidth="2" /></svg>
      <p className="font-semibold text-[#202820]">{title}</p>
      {body && <p className="text-sm text-[#778477]">{body}</p>}
      {action}
    </div>
  );
}
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_x, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-[#E3EFDF]/50" />)}
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
          <Link to={back} className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#3D7952] hover:text-[#233D2D] transition-colors group">
            <span className="transition-transform group-hover:-translate-x-0.5">←</span>
            <span>Back</span>
          </Link>
        )}
        <h1 className="truncate text-2xl font-bold tracking-tight text-[#202820]">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-[#778477] mt-0.5 font-normal">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

// CMP-014 Tabs (Pill style matching Grovia reference)
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange(id: string): void }) {
  return (
    <div role="tablist" className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#E3EFDF]/70 p-1 border border-[#DCE7D9]">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3D7952]',
            active === t.id
              ? 'bg-[#233D2D] text-white shadow-xs'
              : 'text-[#778477] hover:text-[#202820] hover:bg-white/60',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// CMP-015 Dialog / CMP-016 Sheet
export function Dialog({ open, onClose, title, children, footer, sheet }: { open: boolean; onClose(): void; title: string; children: ReactNode; footer?: ReactNode; sheet?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dlg-title" className={cx('w-full max-w-lg rounded-2xl bg-white p-0 text-[#202820] shadow-xl border border-[#DCE7D9] backdrop:bg-[#202820]/40', sheet && 'mb-0 mt-auto max-w-none rounded-b-none md:mb-auto md:max-w-lg md:rounded-2xl')}>
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-[#DCE7D9] px-5 py-4 bg-[#F5F9F2]">
            <h2 id="dlg-title" className="text-sm font-bold text-[#202820]">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1 text-[#778477] hover:bg-white hover:text-[#202820]" aria-label="Close">✕</button>
          </div>
          <div className="overflow-y-auto p-5">{children}</div>
          {footer && <div className="flex justify-end gap-2.5 border-t border-[#DCE7D9] px-5 py-3.5 bg-[#F5F9F2]">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

// CMP-009 DataTable (desktop)
export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  align?: 'right';
}
export function Table<T extends { id?: string }>({ columns, rows, onRow, empty }: { columns: Column<T>[]; rows: T[]; onRow?: (r: T) => void; empty?: ReactNode }) {
  if (!rows.length) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#DCE7D9] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-[#F5F9F2] text-left text-xs font-semibold uppercase tracking-wider text-[#778477] border-b border-[#DCE7D9]">
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={cx('px-4 py-3 font-semibold', c.align === 'right' && 'text-right')}>{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[#DCE7D9]/60">
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className={cx('transition-colors', onRow && 'cursor-pointer hover:bg-[#F5F9F2]/80')} onClick={onRow ? () => onRow(r) : undefined}>
              {columns.map((c, ci) => (
                <td key={c.key} className={cx('px-4 py-3 text-sm text-[#202820]', c.align === 'right' && 'text-right tabular-nums')}>
                  {ci === 0 && onRow ? <button className="text-left font-semibold text-[#3D7952] hover:underline" onClick={(e) => { e.stopPropagation(); onRow(r); }}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '')}</button> : c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '')}
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
        <div key={k} className="flex justify-between gap-3 border-b border-[#DCE7D9]/60 py-1.5">
          <dt className="text-[#778477] font-medium">{k}</dt>
          <dd className="text-right font-semibold text-[#202820]">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export const toast = create;
export { Toaster } from './toast';
