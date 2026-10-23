import { useTranslation } from 'react-i18next';
import { useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { setLanguage } from '../i18n';
import { getErrorMessage, setTokens } from '../services/client';
import { changePassword } from '../services/auth';
import { toast } from '../store/toastStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { UserAvatar } from '../components/ui/UserAvatar';
import {
  User, Palette, Lock, Sun, Moon, Mail, Phone, IdCard, ShieldCheck, Save, HeartPulse, BadgeCheck, KeyRound,
  Camera, Trash2, Pencil,
} from 'lucide-react';

const MAX_PHOTO_BYTES = 512 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Kinyarwanda' },
];

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-card shadow dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-text-main dark:text-white">{title}</h2>
          <p className="text-sm text-text-muted dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateProfileImage = useAuthStore((s) => s.updateProfileImage);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const sendEmailCode = useAuthStore((s) => s.sendEmailCode);
  const verifyEmailCode = useAuthStore((s) => s.verifyEmailCode);
  const sendPhoneCode = useAuthStore((s) => s.sendPhoneCode);
  const verifyPhoneCode = useAuthStore((s) => s.verifyPhoneCode);
  const { theme, setTheme } = useThemeStore();

  const [emailSent, setEmailSent] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailInfo, setEmailInfo] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneInfo, setPhoneInfo] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState('');

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(user?.fullName ?? '');
  const [editPhone, setEditPhone] = useState(user?.phone ?? '');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  const openEditProfile = () => {
    setEditFullName(user?.fullName ?? '');
    setEditPhone(user?.phone ?? '');
    setEditError('');
    setEditProfileOpen(true);
  };

  const handleSaveProfile = async () => {
    if (editFullName.trim().length < 2) {
      setEditError('Please enter your full name.');
      return;
    }
    setEditBusy(true);
    setEditError('');
    try {
      await updateProfile({ fullName: editFullName.trim(), phone: editPhone.trim() });
      toast.success('Your profile has been updated.', 'Profile');
      setEditProfileOpen(false);
    } catch (err) {
      setEditError(getErrorMessage(err));
    } finally {
      setEditBusy(false);
    }
  };

  const currentLang = LANGS.find((l) => i18n.language?.startsWith(l.code)) ?? LANGS[0];
  void currentLang;
  const v = 'portal.settings.verification';

  const statusLabel = (status?: string) => {
    if (!status) return null;
    const map: Record<string, string> = {
      active: 'border-status-confirmed-bg bg-status-confirmed-bg text-status-confirmed-text',
      inactive: 'border-status-cancelled-bg bg-status-cancelled-bg text-status-cancelled-text',
      suspended: 'border-status-pending-bg bg-status-pending-bg text-status-pending-text',
    };
    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
        {status}
      </span>
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setPhotoError('Unsupported format. Please choose a JPG, PNG or WebP image.');
      setPreview(null);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('Image is too large. Maximum size is 512 KB.');
      setPreview(null);
      return;
    }
    setPhotoError('');
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async () => {
    if (!preview) return;
    setPhotoBusy(true);
    setPhotoError('');
    try {
      await updateProfileImage(preview);
      setPreview(null);
      toast.success('Your profile photo has been updated.', 'Photo updated');
    } catch (err) {
      setPhotoError(getErrorMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoBusy(true);
    setPhotoError('');
    try {
      await updateProfileImage(null);
      setPreview(null);
      toast.success('Your profile photo has been removed.', 'Photo removed');
    } catch (err) {
      setPhotoError(getErrorMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSendEmail = async () => {
    setEmailBusy(true); setEmailError(''); setEmailInfo('');
    try {
      const r = await sendEmailCode();
      setEmailSent(true);
      setEmailInfo(r.otp ? `${r.message ?? ''}  (Dev code: ${r.otp})` : (r.message ?? t(`${v}.emailSent`)));
    } catch (err) { setEmailError(getErrorMessage(err)); }
    finally { setEmailBusy(false); }
  };

  const handleVerifyEmail = async () => {
    setEmailBusy(true); setEmailError('');
    try {
      await verifyEmailCode(emailCode);
      setEmailCode(''); setEmailSent(false);
      setEmailInfo(t(`${v}.successEmail`));
    } catch (err) { setEmailError(getErrorMessage(err)); }
    finally { setEmailBusy(false); }
  };

  const handleSendPhone = async () => {
    setPhoneBusy(true); setPhoneError(''); setPhoneInfo('');
    try {
      const r = await sendPhoneCode();
      setPhoneSent(true);
      setPhoneInfo(r.otp ? `${r.message ?? ''}  (Dev code: ${r.otp})` : (r.message ?? t(`${v}.phoneSent`)));
    } catch (err) { setPhoneError(getErrorMessage(err)); }
    finally { setPhoneBusy(false); }
  };

  const handleVerifyPhone = async () => {
    setPhoneBusy(true); setPhoneError('');
    try {
      await verifyPhoneCode(phoneCode);
      setPhoneCode(''); setPhoneSent(false);
      setPhoneInfo(t(`${v}.successPhone`));
    } catch (err) { setPhoneError(getErrorMessage(err)); }
    finally { setPhoneBusy(false); }
  };

  const handleChangePassword = async () => {
    setPwdBusy(true); setPwdError('');
    if (newPassword.length < 6) { setPwdError('Password must be at least 6 characters'); setPwdBusy(false); return; }
    if (!/[a-zA-Z]/.test(newPassword)) { setPwdError('Password must contain at least one letter'); setPwdBusy(false); return; }
    if (!/[0-9]/.test(newPassword)) { setPwdError('Password must contain at least one digit'); setPwdBusy(false); return; }
    if (!/[^a-zA-Z0-9]/.test(newPassword)) { setPwdError('Password must contain at least one symbol'); setPwdBusy(false); return; }
    if (newPassword !== confirmPassword) { setPwdError('Passwords do not match'); setPwdBusy(false); return; }
    try {
      const res = await changePassword(currentPassword, newPassword);
      setTokens(res.tokens);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast.success('Your password has been updated.', 'Password changed');
    } catch (err) { setPwdError(getErrorMessage(err)); }
    finally { setPwdBusy(false); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold text-text-main dark:text-white md:text-3xl">{t('portal.settings.title')}</h1>
        <p className="text-base text-text-muted dark:text-slate-400">{t('portal.settings.subtitle')}</p>
      </div>

      <Section icon={User} title={t('portal.settings.profileTitle')} subtitle={t('portal.settings.profileSubtitle')}>
        <div className="rounded-2xl border border-slate-200 bg-surface p-5 dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <UserAvatar
                name={user?.fullName}
                imageUrl={preview ?? user?.profileImageUrl}
                size="xl"
                className="ring-4 ring-card dark:ring-slate-800"
              />
              {preview && (
                <span className="absolute -bottom-1 right-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                  Preview
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-bold text-text-main dark:text-white">{user?.fullName}</p>
                {statusLabel(user?.status)}
              </div>
              <p className="mt-0.5 text-sm capitalize text-text-muted dark:text-slate-400">
                {user?.role?.replace(/_/g, ' ')}
              </p>
              <p className="mt-0.5 truncate text-sm text-text-muted dark:text-slate-400">{user?.email}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              className="sr-only"
              aria-label="Choose profile photo"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={Camera}
              loading={photoBusy}
              onClick={() => fileRef.current?.click()}
            >
              {user?.profileImageUrl || preview ? 'Change Photo' : 'Upload Photo'}
            </Button>
            {preview && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={Save}
                loading={photoBusy}
                onClick={() => void handleSavePhoto()}
              >
                Save Photo
              </Button>
            )}
            {(user?.profileImageUrl || preview) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Trash2}
                loading={photoBusy}
                disabled={!preview && !user?.profileImageUrl}
                onClick={() => void handleRemovePhoto()}
              >
                Remove
              </Button>
            )}
            {preview && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(null)}>
                Cancel
              </Button>
            )}
            <p className="ml-auto text-xs text-text-muted dark:text-slate-400">
              JPG, PNG or WebP · max 512 KB
            </p>
          </div>
          {photoError && (
            <p className="mt-2 text-xs font-medium text-status-cancelled-text dark:text-red-400" role="alert">
              {photoError}
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950">
            <Mail className="h-5 w-5 shrink-0 text-text-muted" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-text-muted">{t('portal.settings.email')}</dt>
              <dd className="truncate text-sm font-semibold text-text-main dark:text-slate-200">{user?.email ?? '—'}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950">
            <Phone className="h-5 w-5 shrink-0 text-text-muted" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-text-muted">{t('portal.settings.phone')}</dt>
              <dd className="truncate text-sm font-semibold text-text-main dark:text-slate-200">{user?.phone ?? '—'}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950">
            <IdCard className="h-5 w-5 shrink-0 text-text-muted" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-text-muted">{t('portal.settings.nationalId')}</dt>
              <dd className="truncate text-sm font-semibold text-text-main dark:text-slate-200">{user?.nationalId ?? '—'}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950">
            <ShieldCheck className="h-5 w-5 shrink-0 text-text-muted" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-text-muted">{t('portal.settings.role')}</dt>
              <dd className="truncate text-sm font-semibold capitalize text-text-main dark:text-slate-200">{user?.role?.replace(/_/g, ' ')}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950">
            <HeartPulse className="h-5 w-5 shrink-0 text-text-muted" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-text-muted">Account status</dt>
              <dd className="truncate text-sm font-semibold capitalize text-text-main dark:text-slate-200">{user?.status ?? 'Active'}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950">
            <HeartPulse className="h-5 w-5 shrink-0 text-text-muted" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-text-muted">Member since</dt>
              <dd className="truncate text-sm font-semibold text-text-main dark:text-slate-200">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
                  : '—'}
              </dd>
            </div>
          </div>
        </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" icon={Pencil} onClick={openEditProfile}>
              Edit profile
            </Button>
          </div>
        </Section>

        <Section icon={Palette} title={t('portal.settings.preferencesTitle')} subtitle={t('portal.settings.preferencesSubtitle')}>
          <div className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-semibold text-text-main dark:text-slate-300">{t('portal.settings.theme')}</p>
            <div className="flex gap-2">
              {([
                { value: 'light', icon: Sun, label: t('portal.settings.light') },
                { value: 'dark', icon: Moon, label: t('portal.settings.dark') },
              ] as const).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    theme === value
                      ? 'border-primary bg-primary text-white dark:border-primary dark:bg-primary dark:text-white'
                      : 'border-slate-200 bg-surface text-text-muted hover:border-primary/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-text-main dark:text-slate-300">{t('portal.settings.language')}</p>
            <div className="flex flex-wrap gap-2">
              {LANGS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    i18n.language?.startsWith(lang.code)
                      ? 'border-primary bg-primary text-white dark:border-primary dark:bg-primary dark:text-white'
                      : 'border-slate-200 bg-surface text-text-muted hover:border-primary/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section icon={BadgeCheck} title={t(`${v}.title`)} subtitle={t(`${v}.subtitle`)}>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Mail className="h-5 w-5 shrink-0 text-text-muted" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-main dark:text-slate-200">{user?.email || '—'}</p>
                <p className="text-xs text-text-muted">{user?.emailVerifiedAt ? t(`${v}.verified`) : t(`${v}.notVerified`)}</p>
              </div>
            </div>
            {user?.emailVerifiedAt ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-status-confirmed-bg px-3 py-1.5 text-xs font-semibold text-status-confirmed-text">
                <BadgeCheck className="h-4 w-4" /> {t(`${v}.verified`)}
              </span>
            ) : (
              <div className="flex flex-col gap-2 lg:items-end">
                {!emailSent ? (
                  <Button type="button" variant="secondary" className="w-fit" loading={emailBusy} onClick={handleSendEmail}>
                    <KeyRound className="h-4 w-4" /> {t(`${v}.sendCode`)}
                  </Button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t(`${v}.codePlaceholder`)}
                      inputMode="numeric"
                      aria-label={t(`${v}.codePlaceholder`)}
                      className="w-28 rounded-xl border border-slate-300 bg-card px-3 py-2 text-center font-mono text-sm tracking-widest text-text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      autoFocus
                    />
                    <Button type="button" loading={emailBusy} onClick={handleVerifyEmail}>{t(`${v}.verify`)}</Button>
                  </div>
                )}
                {emailInfo && <p className="text-xs text-text-muted dark:text-slate-400">{emailInfo}</p>}
                {emailError && <p className="text-xs font-medium text-status-cancelled-text dark:text-red-400">{emailError}</p>}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Phone className="h-5 w-5 shrink-0 text-text-muted" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-main dark:text-slate-200">{user?.phone || '—'}</p>
                <p className="text-xs text-text-muted">{user?.phoneVerifiedAt ? t(`${v}.verified`) : t(`${v}.notVerified`)}</p>
              </div>
            </div>
            {user?.phoneVerifiedAt ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-status-confirmed-bg px-3 py-1.5 text-xs font-semibold text-status-confirmed-text">
                <BadgeCheck className="h-4 w-4" /> {t(`${v}.verified`)}
              </span>
            ) : (
              <div className="flex flex-col gap-2 lg:items-end">
                {!phoneSent ? (
                  <Button type="button" variant="secondary" className="w-fit" loading={phoneBusy} onClick={handleSendPhone}>
                    <KeyRound className="h-4 w-4" /> {t(`${v}.sendCode`)}
                  </Button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t(`${v}.codePlaceholder`)}
                      inputMode="numeric"
                      aria-label={t(`${v}.codePlaceholder`)}
                      className="w-28 rounded-xl border border-slate-300 bg-card px-3 py-2 text-center font-mono text-sm tracking-widest text-text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      autoFocus
                    />
                    <Button type="button" loading={phoneBusy} onClick={handleVerifyPhone}>{t(`${v}.verify`)}</Button>
                  </div>
                )}
                {phoneInfo && <p className="text-xs text-text-muted dark:text-slate-400">{phoneInfo}</p>}
                {phoneError && <p className="text-xs font-medium text-status-cancelled-text dark:text-red-400">{phoneError}</p>}
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section icon={Lock} title={t('portal.settings.securityTitle')} subtitle={t('portal.settings.securitySubtitle')}>
        <div className="max-w-md space-y-4">
          <div className="grid gap-3 sm:grid-cols-1">
            <Input
              label="Current password"
              name="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Input
              label="New password"
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              hint="At least 6 characters with a letter, a number and a symbol."
            />
            <Input
              label="Confirm new password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          {pwdError && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" role="alert">{pwdError}</p>}
          <div className="flex justify-end">
            <Button type="button" loading={pwdBusy} onClick={handleChangePassword} icon={Save}>
              {t('portal.settings.changePassword')}
            </Button>
          </div>
        </div>
      </Section>

      <Modal
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        title="Edit Profile"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditProfileOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSaveProfile()} loading={editBusy}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Full name" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} placeholder="Your full name" />
          <Input label="Phone number" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+250..." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Email" value={user?.email ?? '—'} disabled />
            <Input label="National ID" value={user?.nationalId ?? '—'} disabled />
            <Input label="Role" value={user?.role?.replace(/_/g, ' ') ?? '—'} disabled className="capitalize" />
            <Input label="Account status" value={user?.status ?? 'Active'} disabled className="capitalize" />
          </div>
          <p className="text-xs text-text-muted dark:text-slate-400">
            Email, national ID and role are managed by your facility administrator.
          </p>
          {editError && <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">{editError}</p>}
        </div>
      </Modal>
    </div>
  );
}