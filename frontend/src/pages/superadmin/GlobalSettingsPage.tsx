import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Mail,
  Bell,
  Shield,
  Clock,
  Save,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'rw', label: 'Kinyarwanda' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Africa/Kigali', label: '(GMT+2) Africa/Kigali' },
  { value: 'UTC', label: '(GMT+0) UTC' },
  { value: 'Europe/Paris', label: '(GMT+1) Europe/Paris' },
  { value: 'Europe/London', label: '(GMT+0) Europe/London' },
  { value: 'Africa/Nairobi', label: '(GMT+3) Africa/Nairobi' },
];

interface GeneralSettings {
  systemName: string;
  supportEmail: string;
  defaultLanguage: string;
  timezone: string;
}

interface AppointmentSettings {
  slotDuration: number;
  maxAdvanceBooking: number;
  cancellationPolicy: number;
}

interface NotificationSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  reminderHours: number;
}

interface SecuritySettings {
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
        checked ? 'bg-primary-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </div>
  );
}

export function GlobalSettingsPage() {
  const { t } = useTranslation();

  const [general, setGeneral] = useState<GeneralSettings>({
    systemName: 'HAS',
    supportEmail: 'support@has.gov.rw',
    defaultLanguage: 'en',
    timezone: 'Africa/Kigali',
  });

  const [appointments, setAppointments] = useState<AppointmentSettings>({
    slotDuration: 30,
    maxAdvanceBooking: 60,
    cancellationPolicy: 24,
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailEnabled: true,
    smsEnabled: true,
    reminderHours: 24,
  });

  const [security, setSecurity] = useState<SecuritySettings>({
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const handleSave = () => {
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {t('admin.settings.title')}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t('admin.settings.subtitle')}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700">
            <Globe className="h-3.5 w-3.5" />
            {t('app.name')}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              icon={Settings}
              title={t('admin.settings.general')}
              subtitle={t('admin.settings.generalSubtitle')}
            />
            <div className="space-y-4">
              <Input
                label={t('admin.settings.systemName')}
                type="text"
                value={general.systemName}
                onChange={(e) =>
                  setGeneral({ ...general, systemName: e.target.value })
                }
                required
              />
              <Input
                label={t('admin.settings.supportEmail')}
                type="email"
                icon={Mail}
                value={general.supportEmail}
                onChange={(e) =>
                  setGeneral({ ...general, supportEmail: e.target.value })
                }
                required
              />
              <Select
                label={t('admin.settings.defaultLanguage')}
                options={LANGUAGE_OPTIONS}
                value={general.defaultLanguage}
                onChange={(e) =>
                  setGeneral({ ...general, defaultLanguage: e.target.value })
                }
              />
              <Select
                label={t('admin.settings.timezone')}
                options={TIMEZONE_OPTIONS}
                value={general.timezone}
                onChange={(e) =>
                  setGeneral({ ...general, timezone: e.target.value })
                }
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={Clock}
              title={t('admin.settings.appointmentSettings')}
              subtitle={t('admin.settings.appointmentSubtitle')}
            />
            <div className="space-y-4">
              <Input
                label={t('admin.settings.slotDuration')}
                hint={t('admin.settings.slotDurationHint')}
                type="number"
                min={5}
                max={120}
                value={appointments.slotDuration}
                onChange={(e) =>
                  setAppointments({
                    ...appointments,
                    slotDuration: Number(e.target.value),
                  })
                }
                required
              />
              <Input
                label={t('admin.settings.maxAdvanceBooking')}
                hint={t('admin.settings.maxAdvanceBookingHint')}
                type="number"
                min={1}
                max={365}
                value={appointments.maxAdvanceBooking}
                onChange={(e) =>
                  setAppointments({
                    ...appointments,
                    maxAdvanceBooking: Number(e.target.value),
                  })
                }
                required
              />
              <Input
                label={t('admin.settings.cancellationPolicy')}
                hint={t('admin.settings.cancellationPolicyHint')}
                type="number"
                min={0}
                max={168}
                value={appointments.cancellationPolicy}
                onChange={(e) =>
                  setAppointments({
                    ...appointments,
                    cancellationPolicy: Number(e.target.value),
                  })
                }
                required
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={Bell}
              title={t('admin.settings.notificationSettings')}
              subtitle={t('admin.settings.notificationSubtitle')}
            />
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {t('admin.settings.emailNotifications')}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t('admin.settings.emailNotificationsDesc')}
                  </p>
                </div>
                <ToggleSwitch
                  checked={notifications.emailEnabled}
                  onChange={(v) =>
                    setNotifications({ ...notifications, emailEnabled: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {t('admin.settings.smsNotifications')}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t('admin.settings.smsNotificationsDesc')}
                  </p>
                </div>
                <ToggleSwitch
                  checked={notifications.smsEnabled}
                  onChange={(v) =>
                    setNotifications({ ...notifications, smsEnabled: v })
                  }
                />
              </div>
              <Input
                label={t('admin.settings.reminderHours')}
                hint={t('admin.settings.reminderHoursHint')}
                type="number"
                min={1}
                max={72}
                value={notifications.reminderHours}
                onChange={(e) =>
                  setNotifications({
                    ...notifications,
                    reminderHours: Number(e.target.value),
                  })
                }
                required
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={Shield}
              title={t('admin.settings.securitySettings')}
              subtitle={t('admin.settings.securitySubtitle')}
            />
            <div className="space-y-4">
              <Input
                label={t('admin.settings.sessionTimeout')}
                hint={t('admin.settings.sessionTimeoutHint')}
                type="number"
                min={5}
                max={480}
                value={security.sessionTimeout}
                onChange={(e) =>
                  setSecurity({
                    ...security,
                    sessionTimeout: Number(e.target.value),
                  })
                }
                required
              />
              <Input
                label={t('admin.settings.maxLoginAttempts')}
                hint={t('admin.settings.maxLoginAttemptsHint')}
                type="number"
                min={3}
                max={10}
                value={security.maxLoginAttempts}
                onChange={(e) =>
                  setSecurity({
                    ...security,
                    maxLoginAttempts: Number(e.target.value),
                  })
                }
                required
              />
              <Input
                label={t('admin.settings.passwordMinLength')}
                hint={t('admin.settings.passwordMinLengthHint')}
                type="number"
                min={6}
                max={64}
                value={security.passwordMinLength}
                onChange={(e) =>
                  setSecurity({
                    ...security,
                    passwordMinLength: Number(e.target.value),
                  })
                }
                required
              />
            </div>
          </Card>
        </div>

        <Card className="sticky bottom-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {saved && (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-700">
                    {t('admin.settings.savedMessage')}
                  </p>
                </>
              )}
            </div>
            <Button
              variant="primary"
              size="lg"
              icon={Save}
              loading={saving}
              onClick={handleSave}
              className="sm:min-w-[160px]"
            >
              {t('admin.settings.saveChanges')}
            </Button>
          </div>
        </Card>
    </div>
  );
}
