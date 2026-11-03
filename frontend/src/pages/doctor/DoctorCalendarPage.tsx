import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import {
  getDoctorSchedule,
  getErrorMessage,
  getMyDoctorProfile,
  listAppointmentsPage,
  type Appointment,
  type DoctorScheduleEntry,
} from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageSpinner } from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/appointments/StatusBadge';

type CalendarView = 'day' | 'week' | 'month';

const STATUS_TONES: Record<string, string> = {
  Pending: 'border-amber-200 bg-amber-50 text-amber-800',
  Confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Checked In': 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'In Progress': 'border-purple-200 bg-purple-50 text-purple-800',
  Completed: 'border-blue-200 bg-blue-50 text-blue-800',
  Missed: 'border-orange-200 bg-orange-50 text-orange-800',
  'No Show': 'border-orange-200 bg-orange-50 text-orange-800',
  Cancelled: 'border-slate-200 bg-slate-100 text-slate-600',
  Declined: 'border-slate-200 bg-slate-100 text-slate-600',
  Rejected: 'border-slate-200 bg-slate-100 text-slate-600',
  'Reschedule Proposed': 'border-amber-200 bg-amber-50 text-amber-800',
};

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function fromIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  start.setHours(12, 0, 0, 0);
  return start;
}

function rangeForView(view: CalendarView, cursor: Date): { from: Date; to: Date } {
  if (view === 'day') return { from: cursor, to: cursor };
  if (view === 'week') {
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 6) };
  }
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12);
  const from = startOfWeek(first);
  return { from, to: addDays(from, 41) };
}

function patientName(appointment: Appointment): string {
  return typeof appointment.patientId === 'object'
    ? (appointment.patientId.userId?.fullName ?? appointment.patientId.patientNumber ?? 'Patient')
    : 'Patient';
}

function availabilityLabel(entries: DoctorScheduleEntry[]): string {
  return entries.map((entry) => `${entry.startTime}-${entry.endTime}`).join(', ');
}

export function DoctorCalendarPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || undefined;
  const [view, setView] = useState<CalendarView>('week');
  const [cursor, setCursor] = useState(() => new Date());

  const { data: doctor, isLoading: loadingDoctor } = useQuery({
    queryKey: ['my-doctor'],
    queryFn: getMyDoctorProfile,
  });

  const { data: schedule = [] } = useQuery({
    queryKey: ['schedule', doctor?._id],
    queryFn: () => getDoctorSchedule(doctor!._id),
    enabled: Boolean(doctor?._id),
  });

  const range = useMemo(() => rangeForView(view, cursor), [view, cursor]);
  const from = isoDate(range.from);
  const to = isoDate(range.to);

  const {
    data: appointments = [],
    isLoading: loadingAppointments,
    error,
    refetch,
  } = useQuery({
    queryKey: ['doctor-calendar', doctor?._id, from, to],
    queryFn: async () => {
      const all: Appointment[] = [];
      let page = 1;
      let pages = 1;
      do {
        const result = await listAppointmentsPage({
          dateFrom: from,
          dateTo: to,
          limit: 100,
          page,
        });
        all.push(...result.items);
        pages = result.pages;
        page += 1;
      } while (page <= pages && page <= 10);
      return all;
    },
    enabled: Boolean(doctor?._id),
  });

  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {};
    for (const appointment of appointments) {
      const key = appointment.appointmentDate.slice(0, 10);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(appointment);
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    }
    return grouped;
  }, [appointments]);

  const availableSchedule = schedule.filter((entry) => entry.isActive);
  const scheduleForDate = (date: Date) =>
    availableSchedule.filter((entry) => entry.dayOfWeek === date.getDay());

  const navigate = (direction: -1 | 1) => {
    if (view === 'day') {
      setCursor((current) => addDays(current, direction));
    } else if (view === 'week') {
      setCursor((current) => addDays(current, direction * 7));
    } else {
      setCursor(
        (current) => new Date(current.getFullYear(), current.getMonth() + direction, 1, 12),
      );
    }
  };

  const rangeTitle = useMemo(() => {
    if (view === 'day') {
      return cursor.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (view === 'month') {
      return cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    }
    return `${range.from.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
    })} - ${range.to.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }, [view, cursor, range, locale]);

  const weekdayLabels = useMemo(() => {
    const monday = new Date(2024, 0, 1, 12);
    return Array.from({ length: 7 }, (_, index) =>
      addDays(monday, index).toLocaleDateString(locale, { weekday: 'short' }),
    );
  }, [locale]);

  if (loadingDoctor) return <PageSpinner />;

  if (!doctor) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
        <AlertCircle className="mx-auto h-10 w-10 text-text-muted" />
        <p className="mt-3 text-sm text-text-muted">
          {t('doctor.calendar.profileMissing', 'Doctor profile not found.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-main dark:text-white">
            {t('doctor.calendar.title', 'My calendar')}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t('doctor.calendar.subtitle', 'Availability and appointments in one view')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-card p-1 dark:border-slate-700">
            {(['day', 'week', 'month'] as CalendarView[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  view === option
                    ? 'bg-primary text-white shadow'
                    : 'text-text-muted hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t(`doctor.calendar.${option}`, option)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} aria-label={t('common.previous')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
              {t('doctor.calendar.today', 'Today')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)} aria-label={t('common.next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-text-main dark:text-white">{rangeTitle}</h2>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {t('doctor.calendar.available', 'Available')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              {t('doctor.calendar.appointment', 'Appointment')}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span>{getErrorMessage(error)}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        )}

        {loadingAppointments && view !== 'month' ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-muted">
            <LoaderIcon />
            {t('common.loading')}
          </div>
        ) : view === 'day' ? (
          <DayView
            appointments={appointmentsByDate[isoDate(cursor)] ?? []}
            availability={scheduleForDate(cursor)}
          />
        ) : view === 'week' ? (
          <WeekView
            start={range.from}
            appointmentsByDate={appointmentsByDate}
            scheduleForDate={scheduleForDate}
            weekdayLabels={weekdayLabels}
            locale={locale}
          />
        ) : (
          <MonthView
            start={range.from}
            cursor={cursor}
            appointmentsByDate={appointmentsByDate}
            scheduleForDate={scheduleForDate}
            weekdayLabels={weekdayLabels}
            locale={locale}
            loading={loadingAppointments}
          />
        )}
      </Card>
    </div>
  );
}

function LoaderIcon() {
  return <Clock className="h-4 w-4 animate-pulse" />;
}

function DayView({
  appointments,
  availability,
}: {
  appointments: Appointment[];
  availability: DoctorScheduleEntry[];
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || undefined;

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-main dark:text-white">
          <CalendarDays className="h-4 w-4 text-emerald-600" />
          {t('doctor.calendar.availability', 'Availability')}
        </h3>
        {availability.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-text-muted dark:border-slate-700">
            {t('doctor.calendar.noAvailability', 'No availability configured for this day.')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availability.map((entry) => (
              <span
                key={entry._id}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
              >
                <Clock className="h-3 w-3" />
                {entry.startTime} - {entry.endTime}
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-text-main dark:text-white">
          {t('doctor.calendar.appointments', 'Appointments')}
        </h3>
        {appointments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-text-muted dark:border-slate-700">
            {t('doctor.calendar.noAppointmentsDay', 'No appointments on this day.')}
          </p>
        ) : (
          <ol className="relative space-y-3 border-l border-slate-200 pl-5 dark:border-slate-700">
            {appointments.map((appointment) => (
              <li key={appointment._id} className="relative">
                <span className="absolute -left-[1.35rem] top-5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-card" />
                <AppointmentCard appointment={appointment} locale={locale} compact={false} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function WeekView({
  start,
  appointmentsByDate,
  scheduleForDate,
  weekdayLabels,
  locale,
}: {
  start: Date;
  appointmentsByDate: Record<string, Appointment[]>;
  scheduleForDate: (date: Date) => DoctorScheduleEntry[];
  weekdayLabels: string[];
  locale?: string;
}) {
  const { t } = useTranslation();
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[780px] grid-cols-7 gap-2">
        {days.map((date, index) => {
          const key = isoDate(date);
          const appointments = appointmentsByDate[key] ?? [];
          const availability = scheduleForDate(date);
          const isToday = key === isoDate(new Date());

          return (
            <div
              key={key}
              className={`flex min-h-[26rem] flex-col rounded-xl border p-2 ${
                isToday
                  ? 'border-primary/40 bg-primary-50/40'
                  : 'border-slate-200 bg-surface dark:border-slate-700 dark:bg-slate-950'
              }`}
            >
              <div className="mb-2 border-b border-slate-200 pb-2 text-center dark:border-slate-700">
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  {weekdayLabels[index]}
                </p>
                <p className={`text-lg font-bold ${isToday ? 'text-primary' : 'text-text-main dark:text-white'}`}>
                  {date.getDate()}
                </p>
              </div>

              <div className="mb-2 space-y-1">
                {availability.length === 0 ? (
                  <p className="text-[10px] text-text-muted">
                    {t('doctor.calendar.unavailable', 'Unavailable')}
                  </p>
                ) : (
                  availability.map((entry) => (
                    <p
                      key={entry._id}
                      className="rounded-md bg-emerald-50 px-1.5 py-1 text-[10px] font-medium text-emerald-700"
                    >
                      {entry.startTime}-{entry.endTime}
                    </p>
                  ))
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                {appointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment._id}
                    appointment={appointment}
                    locale={locale}
                    compact
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({
  start,
  cursor,
  appointmentsByDate,
  scheduleForDate,
  weekdayLabels,
  locale,
  loading,
}: {
  start: Date;
  cursor: Date;
  appointmentsByDate: Record<string, Appointment[]>;
  scheduleForDate: (date: Date) => DoctorScheduleEntry[];
  weekdayLabels: string[];
  locale?: string;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const todayKey = isoDate(new Date());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="mb-1 grid grid-cols-7 gap-1">
          {weekdayLabels.map((label) => (
            <div
              key={label}
              className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const key = isoDate(date);
            const appointments = appointmentsByDate[key] ?? [];
            const availability = scheduleForDate(date);
            const outside = date.getMonth() !== cursor.getMonth();
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                className={`min-h-[7rem] rounded-lg border p-1.5 ${
                  outside
                    ? 'border-slate-100 bg-slate-50/50 opacity-60 dark:border-slate-800 dark:bg-slate-950/40'
                    : 'border-slate-200 bg-card dark:border-slate-700 dark:bg-slate-900'
                } ${isToday ? 'ring-2 ring-primary/40' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold ${
                      isToday ? 'bg-primary text-white' : 'text-text-main dark:text-slate-200'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {availability.length > 0 && (
                    <span
                      className="h-2 w-2 rounded-full bg-emerald-500"
                      title={availabilityLabel(availability)}
                    />
                  )}
                </div>

                <div className="mt-1 space-y-1">
                  {appointments.slice(0, 2).map((appointment) => (
                    <AppointmentCard
                      key={appointment._id}
                      appointment={appointment}
                      locale={locale}
                      compact
                    />
                  ))}
                  {appointments.length > 2 && (
                    <Link
                      to={`/doctor/appointments/${appointments[2]._id}`}
                      className="block px-1 text-[10px] font-medium text-primary hover:underline"
                    >
                      {t('doctor.calendar.more', '+{{count}} more', {
                        count: appointments.length - 2,
                      })}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {loading && (
          <p className="mt-2 text-center text-xs text-text-muted">{t('common.loading')}</p>
        )}
      </div>
    </div>
  );
}

function AppointmentCard({
  appointment,
  locale,
  compact,
}: {
  appointment: Appointment;
  locale?: string;
  compact: boolean;
}) {
  const tone = STATUS_TONES[appointment.status] ?? 'border-slate-200 bg-slate-50 text-slate-700';
  const patient = patientName(appointment);
  const date = fromIsoDate(appointment.appointmentDate.slice(0, 10));

  if (compact) {
    return (
      <Link
        to={`/doctor/appointments/${appointment._id}`}
        className={`block rounded-md border px-1.5 py-1 text-[10px] transition hover:shadow-sm ${tone}`}
        title={`${appointment.timeSlot} ${patient} - ${appointment.status}`}
      >
        <span className="block font-bold">{appointment.timeSlot}</span>
        <span className="block truncate">{patient}</span>
      </Link>
    );
  }

  const visitLabel =
    appointment.visitType === 'follow-up'
      ? 'Follow-up'
      : appointment.visitType === 'referral'
        ? 'Referral'
        : 'New visit';

  return (
    <Link
      to={`/doctor/appointments/${appointment._id}`}
      className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition hover:shadow-sm ${tone}`}
    >
      <span className="w-14 shrink-0 text-sm font-bold">{appointment.timeSlot}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{patient}</span>
        <span className="block text-xs opacity-75">
          {date.toLocaleDateString(locale, { weekday: 'short' })} - {visitLabel}
        </span>
      </span>
      <StatusBadge status={appointment.status} />
    </Link>
  );
}
