import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { listNotificationsPage, markNotificationRead, markAllNotificationsRead, type Notification } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import { BellRing, CalendarClock, FlaskConical, Pill, ReceiptText, Info, Bell, CheckCheck, Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const PAGE_SIZE = 15;

const TYPE_META: Record<string, { icon: LucideIcon; tone: string }> = {
  appointment: { icon: CalendarClock, tone: 'bg-primary-50 text-primary' },
  lab_result: { icon: FlaskConical, tone: 'bg-primary-50 text-primary' },
  prescription: { icon: Pill, tone: 'bg-secondary-50 text-secondary' },
  billing: { icon: ReceiptText, tone: 'bg-status-pending-bg text-status-pending-text' },
  general: { icon: Info, tone: 'bg-surface text-text-muted' },
};

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listNotificationsPage({ page, limit: PAGE_SIZE })
      .then((result) => {
        if (!mounted) return;
        setNotifications(result.items);
        setPages(result.pages);
        setPage(result.page);
        setTotal(result.total);
      })
      .catch(() => mounted && setNotifications([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [page]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
    } finally {
      setBusy(false);
    }
  };

  const handleClick = async (n: Notification) => {
    if (!n.isRead) {
      try {
        await markNotificationRead(n._id);
        setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, isRead: true, readAt: new Date().toISOString() } : x)));
      } catch {
        // keep local state unchanged
      }
    }
    if (n.link) navigate(n.link);
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-main">{t('notifications.title')}</h1>
          <p className="mt-1 text-sm text-text-muted">{t('notifications.subtitle')}</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t('notifications.markAllRead')}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="mx-auto h-12 w-12 text-text-muted/40" />
          <h3 className="mt-4 text-base font-semibold text-text-main">{t('notifications.noNotifications')}</h3>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.general;
            const Icon = meta.icon;
            return (
              <button
                key={n._id}
                type="button"
                onClick={() => handleClick(n)}
                className={`flex w-full items-start gap-4 rounded-xl border p-5 text-left transition-colors ${
                  n.isRead
                    ? 'border-slate-200 bg-card shadow'
                    : 'border-primary/40 bg-primary-50/60 hover:bg-primary-50'
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
                  {n.isRead ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    <span className="truncate text-sm font-semibold text-text-main">
                      {n.title}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-text-muted">{n.body}</span>
                  <span className="mt-1.5 flex items-center gap-2 text-xs text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      {t(`notifications.types.${n.type}`)}
                    </span>
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        total={total}
        itemLabel="pagination.notifications"
        disabled={loading}
        onChange={setPage}
      />
    </div>
  );
}