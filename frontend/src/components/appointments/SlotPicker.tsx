import { useTranslation } from 'react-i18next';
import { AvailableSlot } from '../../services/api';

interface SlotPickerProps {
  slots: AvailableSlot[];
  selected?: string;
  onSelect: (time: string) => void;
  disabled?: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_OPTIONS = WEEKDAYS.map((label, idx) => ({ value: String(idx === 6 ? 0 : idx + 1), label }));

export function SlotPicker({ slots, selected, onSelect, disabled }: SlotPickerProps) {
  const { t } = useTranslation();
  if (slots.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-text-muted">{t('booking.noSlots')}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5" role="listbox" aria-label="Available slots">
      {slots.map((slot) => {
        const taken = slot.available <= 0;
        const isSelected = selected === slot.time;
        return (
          <button
            key={slot.time}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={taken || disabled}
            onClick={() => onSelect(slot.time)}
            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              taken
                ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-text-muted/50'
                : isSelected
                  ? 'border-primary bg-primary text-white shadow'
                  : 'border-slate-200 bg-card text-text-main shadow hover:border-primary/40 hover:bg-primary-50 hover:text-primary'
            }`}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
}
