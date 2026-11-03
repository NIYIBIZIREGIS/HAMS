import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CalendarDays,
  FileText,
  FlaskConical,
  HeartPulse,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import {
  getAppointmentPatientSummary,
  getErrorMessage,
  type DoctorPatientSummary as Summary,
} from '../../services/api';
import { Card } from '../ui/Card';
import { StatusBadge, formatDate } from './StatusBadge';

function doctorName(value: unknown): string {
  const doctor = value as { userId?: { fullName?: string } } | null;
  return doctor?.userId?.fullName ?? '—';
}

function departmentName(value: unknown): string {
  const department = value as { name?: string } | null;
  return department?.name ?? '—';
}

function ageFromDob(dob?: string): string {
  if (!dob) return '—';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return String(Math.max(0, age));
}

export function DoctorPatientSummary({ appointmentId }: { appointmentId: string }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getAppointmentPatientSummary(appointmentId)
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appointmentId]);

  if (loading) {
    return (
      <Card className="py-10 text-center text-sm text-text-muted">
        {t('common.loading')}
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Card className="border-status-cancelled-bg bg-status-cancelled-bg">
        <p className="text-sm font-medium text-status-cancelled-text">
          {error ?? t('common.error')}
        </p>
      </Card>
    );
  }

  const { patient, medicalHistory, previousVisits, labResults, documents } = summary;
  const user = typeof patient.userId === 'object' ? patient.userId : null;
  const allergies = patient.allergies ?? [];
  const chronicConditions = patient.chronicConditions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-text-main dark:text-white">
          {t('doctorAppointments.patientOverview')}
        </h2>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-bold text-text-main dark:text-white">
                {user?.fullName ?? patient.patientNumber}
              </p>
              <p className="text-xs text-text-muted">{patient.patientNumber}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                <span>{t('doctorAppointments.age')}: {ageFromDob(patient.dob)}</span>
                <span>{t('doctorAppointments.gender')}: {patient.gender ?? '—'}</span>
                <span>{t('doctorAppointments.bloodGroup')}: {patient.bloodGroup ?? '—'}</span>
                {user?.phone && <span>{t('booking.phone')}: {user.phone}</span>}
                {user?.email && <span>{t('auth.email')}: {user.email}</span>}
              </div>
            </div>
          </div>

          <div className="flex max-w-md flex-wrap gap-2">
            {allergies.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-cancelled-bg px-2.5 py-1 text-xs font-semibold text-status-cancelled-text">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('doctorAppointments.allergies')}: {allergies.join(', ')}
              </span>
            )}
            {chronicConditions.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-pending-bg px-2.5 py-1 text-xs font-semibold text-status-pending-text">
                {t('doctorAppointments.chronicConditions')}: {chronicConditions.join(', ')}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="flex items-center gap-2 text-sm font-bold text-text-main dark:text-white">
          <CalendarDays className="h-4 w-4 text-primary" />
          {t('doctorAppointments.previousVisits')}
        </h3>
        {previousVisits.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">{t('doctorAppointments.noPreviousVisits')}</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {previousVisits.map((visit) => (
              <div key={visit._id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold text-text-main dark:text-white">
                    {formatDate(visit.appointmentDate)} · {visit.timeSlot}
                  </p>
                  <p className="text-xs text-text-muted">
                    {doctorName(visit.doctorId)} · {departmentName(visit.departmentId)}
                  </p>
                  {visit.reason && <p className="mt-1 text-xs text-text-muted">{visit.reason}</p>}
                </div>
                <StatusBadge status={visit.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="flex items-center gap-2 text-sm font-bold text-text-main dark:text-white">
            <Stethoscope className="h-4 w-4 text-primary" />
            {t('doctorAppointments.medicalHistory')}
          </h3>
          {medicalHistory.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">{t('doctorAppointments.noMedicalHistory')}</p>
          ) : (
            <div className="mt-3 space-y-3">
              {medicalHistory.map((record) => (
                <div key={record._id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="text-sm font-semibold text-text-main dark:text-white">{record.diagnosis}</p>
                    <span className="text-xs text-text-muted">{formatDate(record.createdAt)}</span>
                  </div>
                  {record.symptoms.length > 0 && (
                    <p className="mt-1 text-xs text-text-muted">
                      {t('consultation.symptoms')}: {record.symptoms.join(', ')}
                    </p>
                  )}
                  {record.treatment && (
                    <p className="mt-1 text-xs text-text-muted">
                      {t('consultation.treatment')}: {record.treatment}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-text-muted">{doctorName(record.doctorId)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="flex items-center gap-2 text-sm font-bold text-text-main dark:text-white">
            <FlaskConical className="h-4 w-4 text-primary" />
            {t('doctorAppointments.labResults')}
          </h3>
          {labResults.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">{t('doctorAppointments.noLabResults')}</p>
          ) : (
            <div className="mt-3 space-y-3">
              {labResults.map((lab) => (
                <div key={lab._id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="text-sm font-semibold text-text-main dark:text-white">{lab.testName}</p>
                    <span className="text-xs font-medium text-text-muted">{lab.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{formatDate(lab.requestedAt)}</p>
                  {lab.result && (
                    <p className={`mt-1 text-xs ${lab.isAbnormal ? 'font-semibold text-status-cancelled-text' : 'text-text-muted'}`}>
                      {lab.result}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="flex items-center gap-2 text-sm font-bold text-text-main dark:text-white">
          <FileText className="h-4 w-4 text-primary" />
          {t('doctorAppointments.documents')}
        </h3>
        {documents.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">{t('doctorAppointments.noDocuments')}</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {documents.map((document) => (
              <a
                key={document._id}
                href={document.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-text-main dark:text-white">
                    {document.title}
                  </span>
                  <span className="text-xs capitalize text-text-muted">
                    {document.category.replace(/_/g, ' ')} · {formatDate(document.createdAt)}
                  </span>
                </span>
                <FileText className="h-4 w-4 shrink-0 text-text-muted" />
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
