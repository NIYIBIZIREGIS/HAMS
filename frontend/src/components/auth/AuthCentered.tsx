import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

/**
 * Centres a single auth form inside a plain card. The card is one step brighter than the page
 * surface (`#f8fafc` behind `#ffffff`, slate-800 behind slate-900 in dark mode) with a hairline
 * border and a soft shadow to lift it — nothing else is added around the form.
 * `auth-stack` restores the staggered reveal, `auth-reveal` the card's own entrance.
 */
export function AuthCentered({ children }: { children: ReactNode }) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  const from = (location.state as { from?: string })?.from ?? '/dashboard';
  if (user) return <Navigate to={from} replace />;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-6 sm:py-8">
      <div className="auth-stack auth-reveal w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-7 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/20">
        {children}
      </div>
    </div>
  );
}