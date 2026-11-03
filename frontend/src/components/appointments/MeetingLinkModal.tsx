import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Video } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface MeetingLinkModalProps {
  open: boolean;
  initialLink?: string | null;
  patientName: string;
  onClose: () => void;
  onSave: (meetingLink: string | null) => void;
  loading?: boolean;
}

function isValidMeetingLink(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function MeetingLinkModal({
  open,
  initialLink,
  patientName,
  onClose,
  onSave,
  loading = false,
}: MeetingLinkModalProps) {
  const { t } = useTranslation();
  const [link, setLink] = useState(initialLink ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLink(initialLink ?? '');
    setError('');
  }, [open, initialLink]);

  const handleSave = () => {
    const value = link.trim();
    if (!isValidMeetingLink(value)) {
      setError(t('teleconsultation.invalid', 'Enter a valid http(s) meeting link.'));
      return;
    }
    onSave(value || null);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        initialLink
          ? t('teleconsultation.editTitle', 'Edit meeting link')
          : t('teleconsultation.addTitle', 'Add meeting link')
      }
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          {initialLink && (
            <Button variant="danger" onClick={() => onSave(null)} disabled={loading}>
              {t('teleconsultation.removeLink', 'Remove link')}
            </Button>
          )}
          <Button
            icon={Video}
            loading={loading}
            disabled={!link.trim()}
            onClick={handleSave}
          >
            {t('teleconsultation.save', 'Save link')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-text-muted dark:text-slate-400">
          {t(
            'teleconsultation.doctorHint',
            'Add an optional video meeting link for this online appointment with {{name}}.',
            { name: patientName }
          )}
        </p>

        <Input
          type="url"
          label={t('teleconsultation.linkLabel', 'Meeting link')}
          placeholder={t(
            'teleconsultation.linkPlaceholder',
            'https://meet.example.com/consultation-room'
          )}
          value={link}
          maxLength={2048}
          error={error || undefined}
          icon={Video}
          onChange={(event) => {
            setLink(event.target.value);
            if (error) setError('');
          }}
        />
      </div>
    </Modal>
  );
}
