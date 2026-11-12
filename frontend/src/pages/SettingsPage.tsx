import { useTranslation } from 'react-i18next';
import { useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { setLanguage } from '../i18n';
import { getErrorMessage, setTokens } from '../services/client';
import { changePassword } from '../services/auth';
import { toast } from '../store/toastStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { UserAvatar } from '../components/ui/UserAvatar';
import {
  UserRound, Languages, LockKeyhole, Mail, Phone, IdCard, ShieldCheck, Save, HeartPulse, BadgeCheck,
  KeyRound, Camera, Trash2, Pencil, ChevronRight, CheckCircle2, Clock3, Info,
} from 'lucide-react';

const MAX_PHOTO_BYTES = 512 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Kinyarwanda' },
];

type SettingsTab = 'profile' | 'preferences' | 'verification' | 'security';

const NAV_ITEMS: {
  id: SettingsTab;
  icon: ComponentType<{ className?: string }>;
  labelKey: string;
  subtitleKey: string;
}[] = [
  { id: 'profile', icon: UserRound, labelKey: 'portal.settings.profileTitle', subtitleKey: 'portal.settings.profileSubtitle' },
  { id: 'preferences', icon: Languages, labelKey: 'portal.settings.preferencesTitle', subtitleKey: 'portal.settings.preferencesSubtitle' },
  { id: 'verification', icon: BadgeCheck, labelKey: 'portal.settings.verification.title', subtitleKey: 'portal.settings.verification.shortSubtitle' },
  { id: 'security', icon: LockKeyhole, labelKey: 'portal.settings.securityTitle', subtitleKey: 'portal.settings.securitySubtitle' },
];

function Section({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-card">
      <header className="border-b border-slate-100 bg-white px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary ring-1 ring-primary-100">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-text-main">{title}</h2>
              <p className="mt-0.5 text-sm leading-relaxed text-text-muted">{subtitle}</p>
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </header>
      <div className="p-5 sm:p-7">{children}</div>
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
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const verifiedContacts = Number(Boolean(user?.emailVerifiedAt)) + Number(Boolean(user?.phoneVerifiedAt));
  const codeInputClass =
    'w-32 rounded-xl border border-slate-300 bg-white px-3 py-2 text-center font-mono text-sm tracking-widest text-text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

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
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            <ShieldCheck className="h-4 w-4" />
            {t('portal.settings.accountSettings')}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-main">{t('portal.settings.title')}</h1>
          <p className="mt-1.5 max-w-2xl text-base text-text-muted">{t('portal.settings.subtitle')}</p>
        </div>
        <div className="flex w-fit items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-status-confirmed-text shadow-sm ring-1 ring-emerald-100">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-status-confirmed-text">
              {t('portal.settings.accountProtected')}
            </p>
            <p className="text-xs text-slate-600">{t('portal.settings.accountProtectedHint')}</p>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-card">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={user?.fullName}
                  imageUrl={user?.profileImageUrl}
                  size="lg"
                  className="ring-2 ring-primary-50"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-text-main">{user?.fullName}</p>
                  <p className="truncate text-xs text-text-muted">{user?.email}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                {statusLabel(user?.status)}
                <span className="truncate text-xs font-medium capitalize text-text-muted">
                  {user?.role?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <nav aria-label={t('portal.settings.title')} className="grid gap-1 p-2 sm:grid-cols-2 lg:grid-cols-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      active ? 'bg-primary-50 text-primary-900' : 'text-text-muted hover:bg-slate-50 hover:text-text-main'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        active
                          ? 'bg-white text-primary shadow-sm ring-1 ring-primary-100'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t(item.labelKey)}</span>
                      <span className="block truncate text-[11px] text-text-muted">{t(item.subtitleKey)}</span>
                    </span>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 transition-transform ${
                        active ? 'text-primary' : 'text-slate-300 group-hover:translate-x-0.5'
                      }`}
                    />
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          {activeTab === 'profile' && (
            <Section
              icon={UserRound}
              title={t('portal.settings.profileTitle')}
              subtitle={t('portal.settings.profileSubtitle')}
              action={
                <Button variant="outline" size="sm" icon={Pencil} onClick={openEditProfile}>
                  {t('portal.settings.editProfile')}
                </Button>
              }
            >
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="relative shrink-0">
                    <UserAvatar
                      name={user?.fullName}
                      imageUrl={preview ?? user?.profileImageUrl}
                      size="xl"
                      className="ring-4 ring-white shadow-sm"
                    />
                    {preview && (
                      <span className="absolute -bottom-1 right-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                        {t('portal.settings.preview')}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text-main">{t('portal.settings.profilePhoto')}</p>
                    <p className="mt-1 text-xs text-text-muted">{t('portal.settings.photoHelp')}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept={ALLOWED_TYPES.join(',')}
                        className="sr-only"
                        aria-label={t('portal.settings.profilePhoto')}
                        onChange={handleFileChange}
                      />
                      <Button type="button" variant="secondary" size="sm" icon={Camera} loading={photoBusy} onClick={() => fileRef.current?.click()}>
                        {user?.profileImageUrl || preview ? t('portal.settings.changePhoto') : t('portal.settings.uploadPhoto')}
                      </Button>
                      {preview && (
                        <Button type="button" variant="primary" size="sm" icon={Save} loading={photoBusy} onClick={() => void handleSavePhoto()}>
                          {t('portal.settings.savePhoto')}
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
                          {t('portal.settings.removePhoto')}
                        </Button>
                      )}
                      {preview && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(null)}>
                          {t('common.cancel')}
                        </Button>
                      )}
                    </div>
                    {photoError && (
                      <p className="mt-2 text-xs font-medium text-status-cancelled-text" role="alert">
                        {photoError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-bold text-text-main">{t('portal.settings.personalInformation')}</h3>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-100">
                      <Mail className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-text-muted">{t('portal.settings.email')}</dt>
                      <dd className="mt-0.5 truncate text-sm font-semibold text-text-main">{user?.email ?? '—'}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-100">
                      <Phone className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-text-muted">{t('portal.settings.phone')}</dt>
                      <dd className="mt-0.5 truncate text-sm font-semibold text-text-main">{user?.phone ?? '—'}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-100">
                      <IdCard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-text-muted">{t('portal.settings.nationalId')}</dt>
                      <dd className="mt-0.5 truncate text-sm font-semibold text-text-main">{user?.nationalId ?? '—'}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-100">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-text-muted">{t('portal.settings.role')}</dt>
                      <dd className="mt-0.5 truncate text-sm font-semibold capitalize text-text-main">{user?.role?.replace(/_/g, ' ')}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-100">
                      <HeartPulse className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-text-muted">{t('portal.settings.accountStatus')}</dt>
                      <dd className="mt-0.5 truncate text-sm font-semibold capitalize text-text-main">{user?.status ?? 'Active'}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-100">
                      <Clock3 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-text-muted">{t('portal.settings.memberSince')}</dt>
                      <dd className="mt-0.5 truncate text-sm font-semibold text-text-main">
                        {user?.createdAt
                          ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
                          : '—'}
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>
            </Section>
          )}

          {activeTab === 'preferences' && (
            <Section
              icon={Languages}
              title={t('portal.settings.preferencesTitle')}
              subtitle={t('portal.settings.preferencesSubtitle')}
            >
              <div className="max-w-3xl">
                <h3 className="text-sm font-bold text-text-main">{t('portal.settings.language')}</h3>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{t('portal.settings.languageHelp')}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {LANGS.map((lang) => {
                    const active = i18n.language?.startsWith(lang.code);
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setLanguage(lang.code)}
                        aria-pressed={active}
                        className={`flex flex-col gap-4 rounded-xl border p-4 text-left transition-all ${
                          active
                            ? 'border-primary-300 bg-primary-50/60 ring-1 ring-primary-200'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex w-full items-center justify-between">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold ${
                              active
                                ? 'bg-white text-primary shadow-sm ring-1 ring-primary-100'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {lang.code.toUpperCase()}
                          </span>
                          {active ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : (
                            <span className="h-5 w-5 rounded-full border-2 border-slate-300" />
                          )}
                        </span>
                        <span className="text-sm font-bold text-text-main">{lang.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 flex gap-3 rounded-xl border border-primary-100 bg-primary-25 p-4">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm leading-relaxed text-primary-900">{t('portal.settings.languageNote')}</p>
                </div>
              </div>
            </Section>
          )}

          {activeTab === 'verification' && (
            <Section
              icon={BadgeCheck}
              title={t(`${v}.title`)}
              subtitle={t(`${v}.subtitle`)}
              action={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-text-main">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  {t('portal.settings.verificationProgress', { verified: verifiedContacts, total: 2 })}
                </span>
              }
            >
              <div className="space-y-4">
                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${
                        user?.emailVerifiedAt
                          ? 'bg-emerald-50 text-status-confirmed-text ring-emerald-100'
                          : 'bg-slate-50 text-slate-500 ring-slate-100'
                      }`}
                    >
                      <Mail className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-text-main">{user?.email || '—'}</p>
                        {user?.emailVerifiedAt && (
                          <CheckCircle2 className="h-4 w-4 text-status-confirmed-text" aria-label={t(`${v}.verified`)} />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {user?.emailVerifiedAt ? t(`${v}.verified`) : t(`${v}.notVerified`)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 sm:text-right">
                    {user?.emailVerifiedAt ? (
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-status-confirmed-bg px-3 py-1.5 text-xs font-semibold text-status-confirmed-text">
                        <BadgeCheck className="h-4 w-4" /> {t(`${v}.verified`)}
                      </span>
                    ) : (
                      <div className="flex flex-col gap-2 sm:items-end">
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
                              className={codeInputClass}
                              autoFocus
                            />
                            <Button type="button" loading={emailBusy} onClick={handleVerifyEmail}>{t(`${v}.verify`)}</Button>
                          </div>
                        )}
                        {emailInfo && <p className="text-xs text-text-muted">{emailInfo}</p>}
                        {emailError && <p className="text-xs font-medium text-status-cancelled-text">{emailError}</p>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${
                        user?.phoneVerifiedAt
                          ? 'bg-emerald-50 text-status-confirmed-text ring-emerald-100'
                          : 'bg-slate-50 text-slate-500 ring-slate-100'
                      }`}
                    >
                      <Phone className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-text-main">{user?.phone || '—'}</p>
                        {user?.phoneVerifiedAt && (
                          <CheckCircle2 className="h-4 w-4 text-status-confirmed-text" aria-label={t(`${v}.verified`)} />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {user?.phoneVerifiedAt ? t(`${v}.verified`) : t(`${v}.notVerified`)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 sm:text-right">
                    {user?.phoneVerifiedAt ? (
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-status-confirmed-bg px-3 py-1.5 text-xs font-semibold text-status-confirmed-text">
                        <BadgeCheck className="h-4 w-4" /> {t(`${v}.verified`)}
                      </span>
                    ) : (
                      <div className="flex flex-col gap-2 sm:items-end">
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
                              className={codeInputClass}
                              autoFocus
                            />
                            <Button type="button" loading={phoneBusy} onClick={handleVerifyPhone}>{t(`${v}.verify`)}</Button>
                          </div>
                        )}
                        {phoneInfo && <p className="text-xs text-text-muted">{phoneInfo}</p>}
                        {phoneError && <p className="text-xs font-medium text-status-cancelled-text">{phoneError}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Section>
          )}

          {activeTab === 'security' && (
            <Section
              icon={LockKeyhole}
              title={t('portal.settings.securityTitle')}
              subtitle={t('portal.settings.securitySubtitle')}
            >
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_250px]">
                <div className="space-y-4">
                  <div className="grid gap-4">
                    <Input
                      label={t('portal.settings.currentPassword')}
                      name="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <Input
                      label={t('portal.settings.newPassword')}
                      name="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      hint={t('portal.settings.passwordHint')}
                    />
                    <Input
                      label={t('portal.settings.confirmNewPassword')}
                      name="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                  {pwdError && (
                    <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                      {pwdError}
                    </p>
                  )}
                  <div className="flex justify-end border-t border-slate-100 pt-4">
                    <Button type="button" loading={pwdBusy} onClick={handleChangePassword} icon={Save}>
                      {t('portal.settings.changePassword')}
                    </Button>
                  </div>
                </div>

                <aside className="h-fit rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="text-xs font-bold uppercase tracking-wide text-text-main">
                      {t('portal.settings.passwordTips')}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {[
                      t('portal.settings.passwordTipLength'),
                      t('portal.settings.passwordTipMix'),
                      t('portal.settings.passwordTipUnique'),
                    ].map((tip) => (
                      <li key={tip} className="flex items-start gap-2 text-xs leading-relaxed text-text-muted">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-confirmed-text" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </aside>
              </div>
            </Section>
          )}
        </div>
      </div>

      <Modal
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        title={t('portal.settings.editProfile')}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditProfileOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void handleSaveProfile()} loading={editBusy}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label={t('portal.settings.fullName')} value={editFullName} onChange={(e) => setEditFullName(e.target.value)} placeholder={t('portal.settings.fullName')} />
          <Input label={t('portal.settings.phone')} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+250..." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={t('portal.settings.email')} value={user?.email ?? '—'} disabled />
            <Input label={t('portal.settings.nationalId')} value={user?.nationalId ?? '—'} disabled />
            <Input label={t('portal.settings.role')} value={user?.role?.replace(/_/g, ' ') ?? '—'} disabled className="capitalize" />
            <Input label={t('portal.settings.accountStatus')} value={user?.status ?? 'Active'} disabled className="capitalize" />
          </div>
          <p className="text-xs text-text-muted">
            {t('portal.settings.managedByAdmin')}
          </p>
          {editError && <p className="text-xs font-medium text-red-600" role="alert">{editError}</p>}
        </div>
      </Modal>
    </div>
  );
}