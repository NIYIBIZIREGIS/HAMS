import { InputHTMLAttributes, forwardRef, type ElementType } from 'react';
import { AlertCircle } from 'lucide-react';
import { useDensity } from './density';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ElementType;
  /**
   * `default` keeps the app-wide look. `auth` is the high-contrast treatment used by the
   * sign-in screens: larger type, a heavier border, and colours that are explicit about
   * light vs dark so text stays legible in both themes.
   */
  tone?: 'default' | 'auth';
  /**
   * Normally inherited from the surrounding `Modal`, so a form modal opts all of its fields into
   * the dense treatment at once. Set it on a single field only to override that.
   */
  density?: 'default' | 'compact';
  /**
   * Applied to the wrapping element rather than the `<input>`, so grid placement utilities such
   * as `col-span-2` work when a form field is laid out inside a `grid`.
   */
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  (
    {
      label,
      error,
      hint,
      icon: Icon,
      tone = 'default',
      density: densityProp,
      className = '',
      wrapperClassName = '',
      id,
      ...props
    },
    ref,
  ) => {
    const inherited = useDensity();
    const density = densityProp ?? inherited;
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const auth = tone === 'auth';
    const dense = density === 'compact' && !auth;

    return (
      <div className={`w-full ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className={
              auth
                ? 'mb-1.5 block text-base font-bold text-slate-700 dark:text-slate-200'
                : dense
                  ? 'mb-1 block text-xs font-medium text-text-main'
                  : 'mb-1.5 block text-sm font-medium text-text-main'
            }
          >
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <Icon
              className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${
                auth ? 'left-4 h-5 w-5' : 'left-3 h-4 w-4'
              } ${auth ? 'text-slate-500 dark:text-slate-400' : 'text-text-muted'}`}
              aria-hidden="true"
            />
          )}
          <input
            ref={ref}
            id={inputId}
className={
              auth
                ? [
                        'w-full rounded-xl border-2 bg-white py-3 text-[1rem] font-bold text-slate-900',
                        'placeholder:font-normal placeholder:text-slate-400',
                        'focus:outline-none focus:ring-4',
                        // Lift on focus is what makes the field feel alive; the transform is
                        // listed in the transition so it eases instead of snapping.
                        'transition-[border-color,box-shadow,transform] duration-200 ease-out',
                        'focus:-translate-y-0.5',
                        'dark:bg-slate-800 dark:text-slate-50 dark:placeholder:text-slate-500',
                    Icon ? 'pl-12 pr-4' : 'px-4',
                    error
                      ? 'border-red-600 focus:border-red-600 focus:ring-red-200 dark:border-red-500 dark:focus:ring-red-950'
                      : 'border-slate-300 hover:border-slate-400 focus:border-primary-600 focus:ring-primary-100 dark:border-slate-600 dark:hover:border-slate-500 dark:focus:border-primary-400 dark:focus:ring-primary-950',
                    className,
                  ].join(' ')
                : `w-full rounded-xl border bg-card text-[1rem] text-text-main placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm ${
                    dense ? 'py-2' : 'py-2.5'
                  } ${
                    dense ? (Icon ? 'pl-9 pr-3' : 'px-3') : Icon ? 'pl-10 pr-3.5' : 'px-3.5'
                  } ${
                    error
                      ? 'border-status-cancelled-text focus:border-status-cancelled-text focus:ring-status-cancelled-text'
                      : 'border-slate-200 hover:border-slate-300'
                  } ${className}`
            }
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className={`flex items-start gap-1.5 font-medium ${
              auth
                ? 'mt-2 text-sm text-red-700 dark:text-red-300'
                : dense
                  ? 'mt-1 text-xs text-status-cancelled-text'
                  : 'mt-2 text-xs text-status-cancelled-text'
            }`}
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p
            id={`${inputId}-hint`}
            className={
              auth
                ? 'mt-2 text-sm text-slate-600 dark:text-slate-400'
                : dense
                  ? 'mt-1 text-xs text-text-muted'
                  : 'mt-2 text-xs text-text-muted'
            }
          >
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
