import { useTranslation } from 'react-i18next';
import type { PrescriptionMedicine } from '../../services/api';
import { Button } from '../ui/Button';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  medicines: PrescriptionMedicine[];
  onChange: (medicines: PrescriptionMedicine[]) => void;
  readOnly?: boolean;
}

const EMPTY_MEDICINE: PrescriptionMedicine = {
  name: '',
  dosage: '',
  frequency: '',
  durationDays: 1,
  instructions: '',
};

export function MedicineList({ medicines, onChange, readOnly = false }: Props) {
  const { t } = useTranslation();

  const update = (index: number, field: keyof PrescriptionMedicine, value: string | number) => {
    const updated = medicines.map((m, i) => (i === index ? { ...m, [field]: value } : m));
    onChange(updated);
  };

  const addRow = () => onChange([...medicines, { ...EMPTY_MEDICINE }]);
  const removeRow = (index: number) => onChange(medicines.filter((_, i) => i !== index));

  return (
    <div className="space-y-3" role="list" aria-label={t('consultation.medicines')}>
      {medicines.map((med, i) => (
        <div
          key={i}
          role="listitem"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('consultation.medicine')} {i + 1}</span>
            {!readOnly && medicines.length > 1 && (
              <button
                onClick={() => removeRow(i)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                aria-label={`Remove medicine ${i + 1}`}
              >
                <Trash2 className="h-3 w-3" />
                {t('common.remove')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor={`med-name-${i}`}>
                {t('consultation.medicineName')} <span className="text-red-500">*</span>
              </label>
              <input
                id={`med-name-${i}`}
                type="text"
                readOnly={readOnly}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[1rem] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:text-sm"
                value={med.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                placeholder="e.g. Amoxicillin"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor={`med-dosage-${i}`}>
                {t('consultation.dosage')} <span className="text-red-500">*</span>
              </label>
              <input
                id={`med-dosage-${i}`}
                type="text"
                readOnly={readOnly}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[1rem] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:text-sm"
                value={med.dosage}
                onChange={(e) => update(i, 'dosage', e.target.value)}
                placeholder="500mg"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor={`med-freq-${i}`}>
                {t('consultation.frequency')} <span className="text-red-500">*</span>
              </label>
              <input
                id={`med-freq-${i}`}
                type="text"
                readOnly={readOnly}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[1rem] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:text-sm"
                value={med.frequency}
                onChange={(e) => update(i, 'frequency', e.target.value)}
                placeholder="Twice daily"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor={`med-dur-${i}`}>
                {t('consultation.duration')} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`med-dur-${i}`}
                  type="number"
                  min={1}
                  max={365}
                  readOnly={readOnly}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[1rem] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:text-sm"
                  value={med.durationDays}
                  onChange={(e) => update(i, 'durationDays', parseInt(e.target.value, 10) || 1)}
                />
                <span className="shrink-0 text-xs text-slate-400">{t('consultation.days')}</span>
              </div>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor={`med-instr-${i}`}>
                {t('consultation.medicineInstructions')}
              </label>
              <input
                id={`med-instr-${i}`}
                type="text"
                readOnly={readOnly}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[1rem] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:text-sm"
                value={med.instructions ?? ''}
                onChange={(e) => update(i, 'instructions', e.target.value)}
                placeholder="e.g. Take with food"
              />
            </div>
          </div>
        </div>
      ))}
      {!readOnly && (
        <Button variant="secondary" onClick={addRow} className="w-full text-sm">
          <Plus className="h-4 w-4" />
          {t('consultation.addMedicine')}
        </Button>
      )}
    </div>
  );
}
