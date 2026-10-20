import { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useDensity } from './density';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  /** Helper text below the field, hidden once an `error` replaces it — same contract as Input. */
  hint?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
  /**
   * Normally inherited from the surrounding `Modal`, so a form modal opts all of its fields into
   * the dense treatment at once. Set it on a single field only to override that.
   */
  density?: 'default' | 'compact';
}

export const Select = forwardRef<HTMLSelectElement, Props>(
  (
    {
      label,
      error,
      hint,
      placeholder,
      options,
      density: densityProp,
      className = '',
      id,
      ...props
    },
    ref,
  ) => {
    const inherited = useDensity();
    const density = densityProp ?? inherited;
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const dense = density === 'compact';
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className={
              dense
                ? 'mb-1 block text-xs font-medium text-text-main'
                : 'mb-1.5 block text-sm font-medium text-text-main'
            }
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`w-full appearance-none rounded-xl border bg-card pr-9 text-sm text-text-main transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
              dense ? 'px-3 py-2' : 'px-3.5 py-2.5'
            } ${
              error
                ? 'border-status-cancelled-text focus:border-status-cancelled-text focus:ring-status-cancelled-text'
                : 'border-slate-200 hover:border-slate-300'
            } ${className}`}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        </div>
        {error && (
          <p
            id={`${selectId}-error`}
            className="mt-1 flex items-center gap-1 text-xs text-status-cancelled-text"
            role="alert"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${selectId}-hint`} className={`text-text-muted ${dense ? 'mt-1 text-xs' : 'mt-1.5 text-xs'}`}>
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
