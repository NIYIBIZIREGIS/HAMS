import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { requestOtp } from '../../services/auth';
import { getErrorMessage } from '../../services/client';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Mail, Lock, Hash, Handshake, ArrowRight } from 'lucide-react';

type Mode = 'email' | 'nationalId' | 'otp';

/** The login form itself. `AuthCentered` supplies the card and the page around it. */
export function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const loginWithNationalId = useAuthStore((s) => s.loginWithNationalId);
  const verifyOtpLogin = useAuthStore((s) => s.verifyOtpLogin);

  const [mode, setMode] = useState<Mode>('email');
  const [email, setEmail] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string })?.from ?? '/dashboard';
  const redirectToDashboard = () => navigate(from, { replace: true });

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(email, password); redirectToDashboard(); }
    catch (err) { setError(getErrorMessage(err)); setLoading(false); }
  };

  const handleNationalIdLogin = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await loginWithNationalId(nationalId, password); redirectToDashboard(); }
    catch (err) { setError(getErrorMessage(err)); setLoading(false); }
  };

  const handleSendOtp = async () => {
    setError(''); setInfo('');
    try {
      const res = await requestOtp(email); setOtpSent(true);
      if (res.otp && import.meta.env.DEV) setInfo(`Dev OTP: ${res.otp}`);
      else setInfo(res.message ?? t('auth.sendOtp'));
    } catch (err) { setError(getErrorMessage(err)); }
  };

  const handleOtpVerify = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await verifyOtpLogin(email, otp); redirectToDashboard(); }
    catch (err) { setError(getErrorMessage(err)); setLoading(false); }
  };

  const tabs: { id: Mode; label: string }[] = [
    { id: 'email', label: t('auth.loginWithEmail') },
    { id: 'nationalId', label: t('auth.loginWithNationalId') },
    { id: 'otp', label: t('auth.loginWithOtp') },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-700 text-white shadow-lg shadow-primary-700/30 dark:bg-primary-600">
          <Handshake className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('auth.loginTitle')}
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t('auth.loginSubtitle')}
          </p>
        </div>
      </div>

      <div
        role="group"
        aria-label={t('auth.loginTitle')}
        className="mb-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-300 bg-slate-100 p-1.5 dark:border-slate-700 dark:bg-slate-900"
      >
        {tabs.map((tab) => {
          const selected = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={selected}
              onClick={() => { setMode(tab.id); setError(''); setInfo(''); }}
              className={`rounded-xl px-2 py-2 text-sm font-bold leading-tight transition-all duration-200 ${
                selected
                  ? 'bg-white text-primary-800 shadow-md ring-1 ring-slate-300 dark:bg-slate-700 dark:text-white dark:ring-slate-600'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {mode === 'email' && (
        <form onSubmit={handleEmailLogin} className="auth-form space-y-3">
          <Input
            tone="auth"
            label={t('auth.email')} name="email" type="email" icon={Mail}
            value={email} onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email"
          />
          <Input
            tone="auth"
            label={t('auth.password')} name="password" type="password" icon={Lock}
            value={password} onChange={(e) => setPassword(e.target.value)}
            required autoComplete="current-password"
          />
          {/* Forgot password and the submit action share one row instead of stacking. */}
          <div className="auth-cta flex items-center justify-between gap-4 pt-1">
            <Link
              to="/forgot-password"
              className="text-sm font-bold text-primary-700 underline-offset-4 transition-colors hover:text-primary-800 hover:underline dark:text-primary-300 dark:hover:text-primary-200"
            >
              {t('auth.forgotPassword')}
            </Link>
            <Button tone="auth" type="submit" size="sm" loading={loading} className="px-6">
              {t('auth.login')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </form>
      )}

      {mode === 'nationalId' && (
        <form onSubmit={handleNationalIdLogin} className="auth-form space-y-3">
          <Input
            tone="auth"
            label={t('auth.nationalId')} name="nationalId" icon={Hash}
            value={nationalId} onChange={(e) => setNationalId(e.target.value)}
            required autoComplete="off"
          />
          <Input
            tone="auth"
            label={t('auth.password')} name="password" type="password" icon={Lock}
            value={password} onChange={(e) => setPassword(e.target.value)}
            required autoComplete="current-password"
          />
          <div className="auth-cta flex justify-end pt-1">
            <Button tone="auth" type="submit" size="sm" loading={loading} className="px-6">
              {t('auth.login')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </form>
      )}

      {mode === 'otp' && (
        <form onSubmit={handleOtpVerify} className="auth-form space-y-3">
          <Input
            tone="auth"
            label={t('auth.email')} name="email" type="email" icon={Mail}
            value={email} onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email"
          />
          {!otpSent ? (
            <div className="auth-cta flex justify-end pt-1">
              <Button tone="auth" type="button" variant="outline" size="sm" onClick={handleSendOtp} className="px-6">
                {t('auth.sendOtp')}
              </Button>
            </div>
          ) : (
            <>
              <Input
                tone="auth"
                label={t('auth.otp')} name="otp" icon={Hash}
                value={otp} onChange={(e) => setOtp(e.target.value)}
                required inputMode="numeric" maxLength={6} autoComplete="one-time-code"
              />
              <div className="auth-cta flex justify-end pt-1">
                <Button tone="auth" type="submit" size="sm" loading={loading} className="px-6">
                  {t('auth.verifyOtp')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </>
          )}
        </form>
      )}

      {error && (
        <p
          className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      )}
      {info && (
        <p className="mt-4 rounded-xl border-2 border-primary-200 bg-primary-50 p-3 text-sm font-bold text-primary-900 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-100">
          {info}
        </p>
      )}

      <p className="mt-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
        {t('auth.noAccount')}{' '}
        <Link
          to="/register"
          className="font-extrabold text-primary-700 underline-offset-4 transition-colors hover:text-primary-800 hover:underline dark:text-primary-300 dark:hover:text-primary-200"
        >
          {t('auth.registerTitle')}
        </Link>
      </p>
    </div>
  );
}