import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send } from 'lucide-react';
import {
  getAppointmentChat,
  sendAppointmentChatMessage,
  type Message,
} from '../../services/api';
import { getErrorMessage } from '../../services/client';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ConsultationChatModalProps {
  open: boolean;
  appointmentId: string;
  patientName: string;
  onClose: () => void;
}

export function ConsultationChatModal({
  open,
  appointmentId,
  patientName,
  onClose,
}: ConsultationChatModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatQuery = useQuery({
    queryKey: ['appointment-chat', appointmentId],
    queryFn: () => getAppointmentChat(appointmentId),
    enabled: open && Boolean(appointmentId),
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => sendAppointmentChatMessage(appointmentId, text),
    onSuccess: async () => {
      setBody('');
      await queryClient.invalidateQueries({
        queryKey: ['appointment-chat', appointmentId],
      });
    },
  });

  const messages = chatQuery.data?.messages ?? [];
  const error = chatQuery.isError
    ? getErrorMessage(chatQuery.error)
    : sendMutation.isError
      ? getErrorMessage(sendMutation.error)
      : '';

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [open, messages.length]);

  const handleSend = () => {
    const text = body.trim();
    if (!text) return;
    sendMutation.mutate(text);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('consultation.chatTitle', 'Consultation chat')}
      width="lg"
    >
      <div className="flex min-h-[45vh] flex-col gap-4">
        <p className="text-sm leading-relaxed text-text-muted dark:text-slate-400">
          {t(
            'consultation.chatHint',
            'Send secure messages to {{name}} while the consultation is in progress.',
            { name: patientName },
          )}
        </p>

        <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          {chatQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-text-muted">{t('common.loading')}</p>
          ) : messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              {t('consultation.chatEmpty', 'No messages yet. Start the conversation below.')}
            </p>
          ) : (
            messages.map((message: Message) => {
              const own = message.direction === 'to_patient';
              return (
                <div key={message._id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      own ? 'bg-primary text-white' : 'bg-white text-text-main'
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
            })
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="space-y-2">
          <textarea
            value={body}
            rows={3}
            maxLength={5000}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t(
              'consultation.chatPlaceholder',
              'Type a message for the patient...',
            )}
            className="w-full resize-none rounded-xl border border-slate-200 bg-card px-3 py-2.5 text-sm text-text-main outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              icon={sendMutation.isPending ? undefined : Send}
              loading={sendMutation.isPending}
              disabled={!body.trim() || sendMutation.isPending}
              onClick={handleSend}
            >
              {sendMutation.isPending
                ? t('common.sending', 'Sending...')
                : t('consultation.chatSend', 'Send message')}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <MessageSquare className="h-3.5 w-3.5" />
          {t(
            'consultation.chatFooter',
            'The patient can read and reply from their Messages page.',
          )}
        </div>
      </div>
    </Modal>
  );
}
