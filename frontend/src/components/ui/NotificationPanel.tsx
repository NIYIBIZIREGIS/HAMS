import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../../store/notificationStore';
import { Bell, CalendarDays, CheckCheck, Pill, Mail, X, FlaskConical, ReceiptText, Info } from 'lucide-react';

const TYPE_ICONS = {
  appointment: CalendarDays,
  prescription: Pill,
  message: Mail,
  system: Bell,
  lab_result: FlaskConical,
  billing: ReceiptText,
  general: Info,
} as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Notifications live in a panel that slides in from the right edge of the screen rather than in a
 * dropdown anchored to the bell.
 *
 * A dropdown had two problems on a phone: it was 320px wide (most of a 375px viewport) and it was
 * positioned relative to the bell, so it hung off the edge of the screen and its lower half ran
 * past the fold. A right-edge panel is always fully on screen and its own scroll area keeps the
 * list independent of the page.
 */
export function NotificationPanel({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { notifications, markAllRead, markRead } = useNotificationStore();
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Portalled to <body>: the header this panel is triggered from carries `backdrop-blur` and a
  // z-index, which create a stacking context and a containing block for fixed descendants — so a
  // plain `fixed` overlay rendered inside the header gets clipped to the header's own box.
  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t('portal.header.notifications')}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <aside className="absolute right-2 top-2 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[20rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-2xl animate-slide-in-right dark:border-slate-800 dark:bg-slate-900">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-3 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-bold text-text-main dark:text-white">
              {t('portal.header.notifications')}
            </p>
            {unread > 0 && (
              <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <CheckCheck className="h-3.5 w-3.5" /> {t('portal.header.markAllRead')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto overscroll-contain dark:divide-slate-800">
          {notifications.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-text-muted">{t('portal.header.noNotifications')}</li>
          ) : (
            notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <Link
                    to={n.to ?? '#'}
                    onClick={() => {
                      markRead(n.id);
                      onClose();
                    }}
                    className={`flex items-start gap-2 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                      <Icon className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-text-main dark:text-white">{n.title}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-text-muted dark:text-slate-400">{n.message}</p>
                      <p className="mt-1 text-[10px] text-text-muted dark:text-slate-500">{n.time}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </aside>
    </div>,
    document.body,
  );
}
