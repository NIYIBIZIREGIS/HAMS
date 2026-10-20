import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { forgotPassword } from '../../services/auth';
import { getErrorMessage } from '../../services/client';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { HeartPulse, ArrowLeft, Mail } from 'lucide-react';

export function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      setInfo(res.otp && import.meta.env.DEV ? `Dev OTP: ${res.otp} — use it on the reset page.` : (res.message ?? 'OTP sent'));
      setLoading(false);
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-md">
      <div className="mb-6 flex items-center justify-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
          <HeartPulse className="h-5 w-5" />
        </span>
        <span className="text-lg font-bold text-primary">HAS</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-card p-6 shadow">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-confirmed-bg text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-main">{t('auth.resetPassword')}</h1>
            <p className="text-sm text-text-muted">Enter your email to receive an OTP</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label={t('auth.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" loading={loading} className="w-full">
            {t('auth.requestReset')}
          </Button>
        </form>
        {info && <p className="mt-4 rounded-xl border border-status-confirmed-bg bg-status-confirmed-bg p-3 text-sm text-status-confirmed-text">{info}</p>}
        {error && <p className="mt-4 rounded-xl border border-status-cancelled-bg bg-status-cancelled-bg p-3 text-sm text-status-cancelled-text" role="alert">{error}</p>}
      </div>

      <div className="mt-4 text-center">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('auth.backToLogin')}
        </Link>
      </div>
    </div>
  );
}
