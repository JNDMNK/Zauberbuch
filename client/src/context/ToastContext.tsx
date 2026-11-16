import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; to: string };
}

interface ToastApi {
  show: (message: string, kind?: ToastKind, action?: Toast['action']) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const show = useCallback<ToastApi['show']>(
    (message, kind = 'info', action) => {
      const id = nextId.current++;
      setToasts((ts) => [...ts.filter((t) => t.message !== message), { id, kind, message, action }].slice(-4));
      window.setTimeout(() => dismiss(id), action ? 6000 : 3500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ show, success: (m) => show(m, 'success'), error: (m) => show(m, 'error') }),
    [show],
  );

  const icons = { success: CheckCircle2, error: XCircle, info: Info };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => {
          const Icon = icons[t.kind];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur ${
                t.kind === 'error'
                  ? 'border-red-300 bg-red-50/95 text-red-900 dark:border-red-800 dark:bg-red-950/90 dark:text-red-100'
                  : t.kind === 'success'
                    ? 'border-emerald-300 bg-emerald-50/95 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100'
                    : 'border-parchment-400 bg-parchment-50/95 text-ink dark:border-night-700 dark:bg-night-800/95 dark:text-parchment-100'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="flex-1 text-sm">{t.message}</span>
              {t.action && (
                <Link
                  to={t.action.to}
                  onClick={() => dismiss(t.id)}
                  className="rounded-md bg-parchment-800 px-3 py-1 text-sm font-semibold text-parchment-50 hover:bg-parchment-900 dark:bg-parchment-300 dark:text-ink dark:hover:bg-parchment-200"
                >
                  {t.action.label}
                </Link>
              )}
              <button type="button" onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100" aria-label="×">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
