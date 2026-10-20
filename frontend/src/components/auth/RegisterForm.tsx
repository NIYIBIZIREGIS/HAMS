import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { getErrorMessage } from '../../services/client';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import {
  CheckCircle2, Lock, Mail, Phone, Hash,
  User as UserIcon, Check, ArrowRight, ArrowLeft, MessageSquareHeart,
} from 'lucide-react';

/** The sign-up form itself. `AuthCentered` supplies the page around it. */

/**
 * Mirrors `personName` in `backend/src/validators/schemas.ts`.
 *
 * The two must agree. If this form is stricter than the API, a legitimate name is rejected
 * before it is ever sent; if it is looser, the user fills the whole form in and is then told
 * the name is invalid by a message they cannot act on. So a change here is a change there too.
 *
 * A title, a hyphen or an apostrophe are all part of how these names are written in practice,
 * and `fr`/`rw` rosters carry accents, so Unicode letters are allowed deliberately.
 */
const PERSON_NAME = /^[\p{L}][\p{L}\s'’. -]*$/u;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const NAME_MESSAGE = 'Full name may only contain letters, spaces, hyphens, apostrophes and periods';

export function RegisterForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (fullName.trim().length < 5) { setError('Full name must be at least 5 characters'); return; }
    if (!PERSON_NAME.test(fullName.trim())) { setError(NAME_MESSAGE); return; }
    if (!EMAIL.test(email.trim())) { setError('Enter a valid email address'); return; }
    if (phone && !/^0\d{9}$/.test(phone)) { setError('Phone number must be 10 digits starting with 0 (e.g. 0781234567)'); return; }
    if (nationalId && !/^1\d{15}$/.test(nationalId)) { setError('National ID must be exactly 16 digits starting with 1'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!/[a-zA-Z]/.test(password)) { setError('Password must contain at least one letter'); return; }
    if (!/[0-9]/.test(password)) { setError('Password must contain at least one digit'); return; }
    if (!/[^a-zA-Z0-9]/.test(password)) { setError('Password must contain at least one symbol'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        nationalId: nationalId.trim(),
      });
      navigate('/dashboard');
    }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  };

  const nameValid = fullName.trim().length >= 5 && PERSON_NAME.test(fullName.trim());
  const emailValid = EMAIL.test(email.trim());
  const phoneValid = !phone || /^0\d{9}$/.test(phone);
  const idValid = !nationalId || /^1\d{15}$/.test(nationalId);
  const stepOneValid = nameValid && emailValid && phoneValid && idValid;

  const goNext = () => {
    setTouched({ fullName: true, email: true, phone: true, nationalId: true });
    if (!stepOneValid) return;
    setError('');
    setStep(2);
  };

  /**
   * Reveals a field's problem once it has been visited — but only if it actually has one.
   * Keying off `touched` alone paints a perfectly valid field red the moment it loses focus,
   * which is how a correctly filled form ends up covered in errors it cannot fix.
   */
  const inlineError = (key: string, valid: boolean, message: string) =>
    touched[key] && !valid ? message : undefined;
  const validRing = (valid: boolean, value: string) =>
    valid && value ? 'border-emerald-500 dark:border-emerald-500' : '';

  const rules = [
    { ok: password.length >= 6, label: t('auth.ruleLength') },
    { ok: /[a-zA-Z]/.test(password), label: t('auth.ruleLetter') },
    { ok: /[0-9]/.test(password), label: t('auth.ruleDigit') },
    { ok: /[^a-zA-Z0-9]/.test(password), label: t('auth.ruleSymbol') },
  ];

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t('auth.registerTitle')}
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
          {t('auth.registerSubtitle')}
        </p>
      </div>

      <ol className="mb-4 flex items-center gap-3">
        {[1, 2].map((n) => (
          <li key={n} className="flex flex-1 items-center gap-2.5">
            <span
              aria-current={step === n ? 'step' : undefined}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                step >= n
                  ? 'bg-primary-700 text-white shadow-md shadow-primary-700/30 dark:bg-primary-600'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {step > n ? <Check className="h-4 w-4" aria-hidden="true" /> : n}
            </span>
            <span
              className={`text-sm font-bold leading-tight ${
                step >= n ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {n === 1 ? t('auth.stepPersonal') : t('auth.stepSecurity')}
            </span>
            {n === 1 && (
              <span
                aria-hidden="true"
                className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
                  step > 1
                    ? 'bg-primary-600 dark:bg-primary-500'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
            )}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit} className="auth-form space-y-3" noValidate>
        {step === 1 && (
          <div className="space-y-3">
            <Input
              tone="auth"
              label={t('auth.fullName')} name="fullName" icon={UserIcon}
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setError(''); }}
              onBlur={() => setTouched((s) => ({ ...s, fullName: true }))}
              required autoComplete="name"
              error={inlineError('fullName', nameValid, fullName.trim().length < 5
                ? 'Full name must be at least 5 characters'
                : NAME_MESSAGE)}
              className={validRing(nameValid, fullName)}
            />
            <Input
              tone="auth"
              label={t('auth.email')} name="email" type="email" icon={Mail}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              onBlur={() => setTouched((s) => ({ ...s, email: true }))}
              required autoComplete="email"
              error={inlineError('email', emailValid, 'Enter a valid email address')}
              className={validRing(emailValid, email)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                tone="auth"
                label={t('auth.phone')} name="phone" icon={Phone}
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(''); }}
                onBlur={() => setTouched((s) => ({ ...s, phone: true }))}
                autoComplete="tel"
                error={inlineError('phone', phoneValid, 'Phone number must be 10 digits starting with 0 (e.g. 0781234567)')}
                className={validRing(phoneValid, phone)}
              />
              <Input
                tone="auth"
                label={t('auth.nationalId')} name="nationalId" icon={Hash}
                value={nationalId}
                onChange={(e) => { setNationalId(e.target.value); setError(''); }}
                onBlur={() => setTouched((s) => ({ ...s, nationalId: true }))}
                autoComplete="off"
                error={inlineError('nationalId', idValid, 'National ID must be exactly 16 digits starting with 1')}
                className={validRing(idValid, nationalId)}
              />
            </div>
            <div className="auth-cta flex justify-end pt-1">
              <Button tone="auth" type="button" size="sm" onClick={goNext} className="px-6">
                {t('auth.nextStep')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Input
              tone="auth"
              label={t('auth.password')} name="password" type="password" icon={Lock}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              required minLength={6} autoComplete="new-password"
            />
            <ul className="grid gap-2 rounded-xl border border-slate-300 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-900">
              {rules.map(({ ok, label }) => (
                <li
                  key={label}
                  className={`flex items-center gap-2.5 text-sm font-bold ${
                    ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {ok
                    ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    : <span className="h-4 w-4 shrink-0 rounded-full border-2 border-current" aria-hidden="true" />}
                  {label}
                </li>
              ))}
            </ul>
            <Input
              tone="auth"
              label={t('auth.confirmPassword')} name="confirmPassword" type="password" icon={Lock}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(''); }}
              required minLength={6} autoComplete="new-password"
              error={confirm && confirm !== password ? t('auth.passwordsDoNotMatch') : undefined}
              className={validRing(confirm === password, confirm)}
            />
            <div className="auth-cta flex flex-wrap items-center justify-end gap-3 pt-1">
              <Button
                tone="auth" type="button" variant="outline" size="sm"
                onClick={() => { setError(''); setStep(1); }}
                className="px-5"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('auth.previousStep')}
              </Button>
              <Button tone="auth" type="submit" size="sm" loading={loading} className="px-6">
                {t('auth.register')}<CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p
            className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}
      </form>

      <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
        <MessageSquareHeart className="h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        {t('auth.haveAccount')}{' '}
        <Link
          to="/login"
          className="font-extrabold text-primary-700 underline-offset-4 transition-colors hover:text-primary-800 hover:underline dark:text-primary-300 dark:hover:text-primary-200"
        >
          {t('auth.login')}
        </Link>
      </p>
    </div>
  );
}