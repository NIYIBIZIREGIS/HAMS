import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listMessageThreads,
  getMessageThread,
  replyToThread,
  type Message,
  type MessageThread,
} from '../../services/api';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import {
  Search,
  Inbox,
  Mail,
  MailOpen,
  ChevronDown,
  ChevronUp,
  User2,
  Send,
  MessagesSquare,
} from 'lucide-react';

const PAGE_SIZE = 20;

export function MessagesPage() {
  const { t } = useTranslation();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const result = await listMessageThreads({ page: targetPage, limit: PAGE_SIZE });
      setThreads(result.items);
      setPages(result.pages);
      setPage(result.page);
      // The badge counts every unread message, not just the page on screen.
      setTotalUnread(result.items.reduce((sum, thread) => sum + thread.unreadCount, 0));
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads(1);
  }, [loadThreads]);

  // Opening a conversation loads it in full and clears its unread badge server-side.
  const openThread = useCallback(async (threadId: string) => {
    if (openThreadId === threadId) {
      setOpenThreadId(null);
      setMessages([]);
      return;
    }
    setOpenThreadId(threadId);
    setLoadingThread(true);
    setDraft('');
    setError(null);
    try {
      const conversation = await getMessageThread(threadId);
      setMessages(conversation);
      setTotalUnread((current) => Math.max(0, current - 1));
    } catch {
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, [openThreadId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return threads;
    const q = query.toLowerCase();
    return threads.filter(
      (thread) =>
        thread.subject.toLowerCase().includes(q) ||
        thread.lastBody.toLowerCase().includes(q) ||
        thread.lastSenderName.toLowerCase().includes(q)
    );
  }, [threads, query]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !openThreadId || sending) return;

    setSending(true);
    setError(null);
    try {
      await replyToThread(openThreadId, text);
      setDraft('');
      // Re-read the conversation so ordering and the server's timestamps are authoritative.
      const conversation = await getMessageThread(openThreadId);
      setMessages(conversation);
      loadThreads(page);
    } catch {
      setError(t('messages.replyFailed'));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-main">{t('messages.title')}</h1>
          <p className="mt-1 text-sm text-text-muted">{t('messages.subtitle')}</p>
        </div>
        {totalUnread > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary">
            <Mail className="h-3.5 w-3.5" />
            {t('messages.unreadCount', { count: totalUnread })}
          </span>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${t('common.search')}...`}
          className="w-full rounded-xl border border-slate-300 bg-card py-2 pl-9 pr-3 text-sm text-text-main placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="mx-auto h-12 w-12 text-text-muted/40" />
          <h3 className="mt-4 text-base font-semibold text-text-main">{t('messages.noMessages')}</h3>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((thread) => {
            const expanded = openThreadId === thread.threadId;
            const unread = thread.unreadCount > 0;
            return (
              <Card
                key={thread.threadId}
                className={`p-5 transition-colors ${unread ? 'border-primary/40 bg-primary-50/50' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => openThread(thread.threadId)}
                  className="flex w-full items-center gap-4 text-left"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      unread ? 'bg-primary-100 text-primary' : 'bg-surface text-text-muted'
                    }`}
                  >
                    {unread ? <Mail className="h-5 w-5" /> : <MailOpen className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      <span className="truncate text-sm font-semibold text-text-main">{thread.subject}</span>
                      {thread.messageCount > 1 && (
                        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-text-muted">
                          {t('messages.replyCount', { count: thread.messageCount })}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <User2 className="h-3 w-3" />
                        {thread.lastSenderName}
                      </span>
                      <span className="truncate">{thread.lastBody}</span>
                    </span>
                  </span>
                  {expanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-text-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
                  )}
                </button>

                {expanded && (
                  <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                    {loadingThread ? (
                      <p className="text-sm text-text-muted">{t('common.loading')}</p>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((message) => {
                          // Replies the patient wrote sit on the right, hospital mail on the left.
                          const own = message.direction === 'to_staff';
                          return (
                            <div
                              key={message._id}
                              className={`flex ${own ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                                  own ? 'bg-primary text-white' : 'bg-surface text-text-main'
                                }`}
                              >
                                <span
                                  className={`text-[11px] font-medium ${
                                    own ? 'text-primary-100' : 'text-text-muted'
                                  }`}
                                >
                                  {own ? t('messages.you') : message.senderName}
                                </span>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                                  {message.body}
                                </p>
                                <span
                                  className={`mt-1.5 block text-[11px] ${
                                    own ? 'text-primary-100' : 'text-text-muted'
                                  }`}
                                >
                                  {new Date(message.createdAt).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <label
                        htmlFor={`reply-${thread.threadId}`}
                        className="flex items-center gap-1.5 text-xs font-medium text-text-muted"
                      >
                        <MessagesSquare className="h-3.5 w-3.5" />
                        {t('messages.replyLabel')}
                      </label>
                      <textarea
                        id={`reply-${thread.threadId}`}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={3}
                        placeholder={t('messages.replyPlaceholder')}
                        className="w-full rounded-xl border border-slate-300 bg-card px-3 py-2 text-sm text-text-main placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {error && <p className="text-xs text-danger">{error}</p>}
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSend}
                          disabled={!draft.trim() || sending}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {sending ? t('common.sending') : t('messages.sendReply')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-text-muted">
            {t('common.pageOf', { page, pages })}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => loadThreads(page - 1)}
            >
              {t('common.previous')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= pages}
              onClick={() => loadThreads(page + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
