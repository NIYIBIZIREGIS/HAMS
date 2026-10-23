import { useToastStore } from '../../store/toastStore';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const STYLES = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-white',
    bg: 'bg-emerald-600 dark:bg-emerald-500',
    border: 'border-emerald-700/20 dark:border-emerald-400/30',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-white',
    bg: 'bg-red-600 dark:bg-red-500',
    border: 'border-red-700/20 dark:border-red-400/30',
  },
  info: {
    icon: Info,
    iconClass: 'text-white',
    bg: 'bg-primary dark:bg-primary-600',
    border: 'border-primary-700/20 dark:border-primary-400/30',
  },
} as const;

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-4 right-3 z-[100] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-2 sm:right-4 sm:w-[calc(100vw-2rem)]"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const style = STYLES[t.kind];
        const Icon = style.icon;
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto animate-in fade-in slide-in-from-top-2 zoom-in-95 flex items-start gap-3 rounded-xl border ${style.border} ${style.bg} p-4 text-white shadow-lg`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              {t.title && <p className="text-sm font-semibold">{t.title}</p>}
              <p className="text-sm text-white/90">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded-xl p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
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