import { Check } from 'lucide-react';

interface Props {
  /** 1-based index of the step currently shown. */
  current: number;
  steps: string[];
  /**
   * Called when an earlier step is clicked. Implementations should refuse to move forward,
   * so a half-filled step cannot be skipped past.
   */
  onSelect?: (step: number) => void;
}

/**
 * The numbered progress row used by the multi-step creation forms.
 *
 * Modelled on the public register page's stepper so the two-step registration flows feel like
 * the same product rather than three different ones. Completed steps are clickable to go back,
 * which matters most on a long form: being unable to correct a name on step one without
 * starting over is worse than the extra click of a Back button.
 */
export function StepIndicator({ current, steps, onSelect }: Props) {
  return (
    <ol className="mb-1 flex items-center gap-2" aria-label="Progress">
      {steps.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        const reachable = done && Boolean(onSelect);

        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onSelect?.(step)}
              aria-current={active ? 'step' : undefined}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                done || active
                  ? 'bg-primary text-white'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              } ${reachable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
            >
              {done ? <Check className="h-4 w-4" aria-hidden="true" /> : step}
              {!done && <span className="sr-only">{`Step ${step}`}</span>}
            </button>
            <span
              className={`text-xs font-semibold leading-tight ${
                active ? 'text-text-main dark:text-white' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {label}
            </span>
            {step < steps.length && (
              <span
                aria-hidden="true"
                className={`h-0.5 flex-1 rounded-full transition-colors ${
                  done ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}