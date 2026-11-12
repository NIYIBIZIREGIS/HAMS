import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { getErrorMessage } from '../../services/client';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Mail, Lock, ArrowRight, ShieldCheck, LockKeyhole } from 'lucide-react';

/** The login form itself. `AuthCentered` supplies the card and the page around it. */
export function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { push: pushToast } = useToastStore();

  const from = (location.state as { from?: string })?.from ?? '/dashboard';

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      pushToast('error', getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary-800">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {t('auth.loginEyebrow')}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          {t('auth.loginTitle')}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          {t('auth.loginSubtitle')}
        </p>
      </div>

      <form onSubmit={handleLogin} className="auth-form space-y-4">
        <div className="flex gap-2.5 rounded-xl border border-primary-100 bg-primary-25 p-3.5">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-primary-900">{t('auth.loginMethodHint')}</p>
        </div>

        <Input
          tone="auth"
          label={t('auth.email')}
          name="email"
          type="email"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
        />

        <div>
          <Input
            tone="auth"
            label={t('auth.password')}
            name="password"
            type="password"
            icon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <div className="mt-2 flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-bold text-primary-700 underline-offset-4 transition-colors hover:text-primary-800 hover:underline"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
        </div>

        <Button tone="auth" type="submit" size="lg" loading={loading} className="w-full">
          {t('auth.login')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500">
        <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
        {t('auth.secureSignInHint')}
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center text-sm font-semibold text-slate-700">
        {t('auth.noAccount')}{' '}
        <Link
          to="/register"
          className="font-extrabold text-primary-700 underline-offset-4 transition-colors hover:text-primary-800 hover:underline"
        >
          {t('auth.registerTitle')}
        </Link>
      </div>
    </div>
  );
}
