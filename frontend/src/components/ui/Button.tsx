import { ButtonHTMLAttributes, forwardRef, type ElementType } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: ElementType;
  /**
   * `default` keeps the app-wide look. `auth` is the high-contrast treatment used by the
   * sign-in screens: larger text, a taller tap target, and a deeper primary fill, because
   * white on `primary` (#0284C7) only reaches 4.09:1 and fails WCAG AA for body text.
   */
  tone?: 'default' | 'auth';
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow',
  secondary: 'bg-secondary text-white hover:bg-secondary/90 shadow',
  danger: 'bg-status-cancelled-text text-white hover:opacity-90 shadow',
  ghost: 'text-text-muted hover:bg-slate-50 hover:text-text-main',
  outline: 'border border-slate-200 bg-card text-text-main hover:border-slate-300 hover:bg-slate-50',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

/** `auth` tone only overrides the variants that carry text on a coloured fill. */
const authVariantClasses: Record<Variant, string> = {
  primary:
    'bg-primary-700 text-white shadow-lg shadow-primary-700/25 hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-500',
  secondary:
    'bg-secondary-700 text-white shadow-lg shadow-secondary-700/25 hover:bg-secondary-800 dark:bg-secondary-600 dark:hover:bg-secondary-500',
  danger: 'bg-red-700 text-white shadow-lg shadow-red-700/25 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500',
  ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  outline:
    'border-2 border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  (
    { className = '', variant = 'primary', size = 'md', tone = 'default', loading, disabled, icon: Icon, children, ...props },
    ref,
  ) => {
    const auth = tone === 'auth';
    const variants = auth ? authVariantClasses : variantClasses;
    const sizes = auth
      ? { sm: 'px-4 py-2.5 text-sm', md: 'px-5 py-3 text-base', lg: 'px-6 py-4 text-lg' }
      : sizeClasses;

    // `auth` only: a highlight that sweeps across the button on hover. It is worth the extra
    // positioned box on a filled button, and only there.
    const sheen =
      auth && (variant === 'primary' || variant === 'secondary')
        ? 'relative overflow-hidden before:absolute before:inset-y-0 before:-left-full before:w-1/2 before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent before:transition-transform before:duration-700 before:ease-out hover:before:translate-x-[300%] motion-reduce:before:hidden'
        : '';

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none ${sheen} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {/* Positioned so the label and icon stay above the ::before highlight. */}
        <span className="relative inline-flex items-center justify-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {!loading && Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
          {children}
        </span>
      </button>
    );
  },
);

Button.displayName = 'Button';