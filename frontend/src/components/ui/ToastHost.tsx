import { useToastStore } from '../../store/toastStore';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const STYLES = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-status-confirmed-text',
    border: 'border-slate-200 dark:border-slate-800',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-status-cancelled-text',
    border: 'border-slate-200 dark:border-slate-800',
  },
  info: {
    icon: Info,
    iconClass: 'text-primary',
    border: 'border-slate-200 dark:border-slate-800',
  },
} as const;

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const style = STYLES[t.kind];
        const Icon = style.icon;
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto animate-in fade-in slide-in-from-top-2 zoom-in-95 flex items-start gap-3 rounded-xl border ${style.border} bg-card p-4 text-text-main shadow-md dark:bg-slate-900 dark:text-white`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              {t.title && <p className="text-sm font-semibold">{t.title}</p>}
              <p className="text-sm text-text-muted dark:text-slate-300">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded-xl p-1 text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}