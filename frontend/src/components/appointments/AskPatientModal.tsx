import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface AskPatientModalProps {
  open: boolean;
  patientName: string;
  defaultSubject: string;
  onClose: () => void;
  onSend: (subject: string, body: string) => void;
  loading?: boolean;
}

export function AskPatientModal({
  open,
  patientName,
  defaultSubject,
  onClose,
  onSend,
  loading = false,
}: AskPatientModalProps) {
  const { t } = useTranslation();
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!open) return;
    setSubject(defaultSubject);
    setBody('');
  }, [open, defaultSubject]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('askPatient.title', 'Ask the patient for more information')}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            icon={MessageSquare}
            loading={loading}
            disabled={!subject.trim() || !body.trim()}
            onClick={() => onSend(subject.trim(), body.trim())}
          >
            {t('askPatient.send', 'Send message')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-text-muted dark:text-slate-400">
          {t('askPatient.message', 'Send a secure message to {{name}}.', { name: patientName })}
        </p>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-text-main dark:text-white">
            {t('askPatient.subject', 'Subject')}
          </span>
          <input
            type="text"
            value={subject}
            maxLength={150}
            onChange={(event) => setSubject(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-card px-3 py-2.5 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-text-main dark:text-white">
            {t('askPatient.body', 'Message')}
          </span>
          <textarea
            value={body}
            rows={5}
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t(
              'askPatient.placeholder',
              'Describe the information you need from the patient.',
            )}
            className="w-full resize-none rounded-xl border border-slate-200 bg-card px-3 py-2.5 text-sm text-text-main outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>
      </div>
    </Modal>
  );
}
