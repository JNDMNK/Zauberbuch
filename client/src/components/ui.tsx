import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-16 text-parchment-700 dark:text-parchment-300">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

interface FieldProps {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
  className?: string;
}

export function Field({ label, error, hint, children, className = '' }: FieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ invalid, className = '', ...props }, ref) {
    return <input ref={ref} className={`input ${invalid ? 'input-error' : ''} ${className}`} aria-invalid={invalid || undefined} {...props} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function TextArea({ invalid, className = '', ...props }, ref) {
    return <textarea ref={ref} className={`input ${invalid ? 'input-error' : ''} ${className}`} aria-invalid={invalid || undefined} {...props} />;
  },
);

export function Checkbox({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="chip-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'info' | 'success'; children: ReactNode }) {
  const cls =
    kind === 'error'
      ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200'
      : kind === 'success'
        ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
        : 'border-parchment-400 bg-parchment-50 text-ink dark:border-night-700 dark:bg-night-800 dark:text-parchment-100';
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}
