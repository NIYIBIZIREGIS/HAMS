import { useTranslation } from 'react-i18next';

export interface VitalsState {
  bloodPressure: string;
  temperature: string;
  weight: string;
  height: string;
  pulse: string;
  oxygenSaturation: string;
}

interface Props {
  vitals: VitalsState;
  onChange: (vitals: VitalsState) => void;
  readOnly?: boolean;
}

interface VitalField {
  key: keyof VitalsState;
  labelKey: string;
  unit: string;
  placeholder: string;
  type: 'text' | 'number';
}

const FIELDS: VitalField[] = [
  { key: 'bloodPressure', labelKey: 'consultation.vitalsBloodPressure', unit: 'mmHg', placeholder: '120/80', type: 'text' },
  { key: 'temperature', labelKey: 'consultation.vitalsTemperature', unit: '\u00B0C', placeholder: '36.6', type: 'number' },
  { key: 'pulse', labelKey: 'consultation.vitalsPulse', unit: 'bpm', placeholder: '72', type: 'number' },
  { key: 'oxygenSaturation', labelKey: 'consultation.vitalsOxygen', unit: '%', placeholder: '98', type: 'number' },
  { key: 'weight', labelKey: 'consultation.vitalsWeight', unit: 'kg', placeholder: '70', type: 'number' },
  { key: 'height', labelKey: 'consultation.vitalsHeight', unit: 'cm', placeholder: '175', type: 'number' },
];

export function VitalsForm({ vitals, onChange, readOnly = false }: Props) {
  const { t } = useTranslation();

  const update = (key: keyof VitalsState, value: string) => {
    onChange({ ...vitals, [key]: value });
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="group" aria-label="Patient vitals">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={f.key} className="mb-1 block text-xs font-medium text-slate-700">
            {t(f.labelKey)}
          </label>
          <div className="relative">
            <input
              id={f.key}
              type={f.type}
              readOnly={readOnly}
              placeholder={f.placeholder}
              value={vitals[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-10 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-slate-50"
              min={f.type === 'number' ? '0' : undefined}
              step={f.type === 'number' ? '0.1' : undefined}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400" aria-hidden="true">
              {f.unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function VitalsDisplay({ vitals }: { vitals: Record<string, unknown> }) {
  const { t } = useTranslation();
  const entries = FIELDS.map((f) => ({
    label: t(f.labelKey),
    value: vitals[f.key] as string | number | undefined,
    unit: f.unit,
  })).filter((e) => e.value !== undefined && e.value !== '');

  if (entries.length === 0) return <p className="text-sm text-slate-400">{t('consultation.noVitals')}</p>;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {entries.map((e) => (
        <div key={e.label} className="rounded-lg border border-slate-200 bg-primary-25 px-3 py-2">
          <p className="text-xs text-slate-500">{e.label}</p>
          <p className="text-sm font-semibold text-slate-800">{e.value} <span className="text-xs font-normal text-slate-400">{e.unit}</span></p>
        </div>
      ))}
    </div>
  );
}
