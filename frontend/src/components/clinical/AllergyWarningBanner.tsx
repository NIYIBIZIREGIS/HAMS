import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  warnings: string[];
  onDismiss: () => void;
}

export function AllergyWarningBanner({ warnings, onDismiss }: Props) {
  const { t } = useTranslation();
  if (warnings.length === 0) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{t('consultation.allergyWarning', 'Allergy warning')}</p>
        <ul className="mt-1 list-disc pl-4 text-sm text-amber-700">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>
      <button
        onClick={onDismiss}
        className="rounded-lg p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-800"
        aria-label={t('consultation.dismissAllergyWarning', 'Dismiss allergy warning')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
