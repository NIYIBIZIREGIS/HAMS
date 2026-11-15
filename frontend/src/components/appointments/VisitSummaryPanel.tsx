import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Download, FileText, FlaskConical, Pill, Printer, Stethoscope } from 'lucide-react';
import {
  getErrorMessage,
  getPrescriptionPdfUrl,
  getVisitSummary,
  type MedicalRecord,
  type VisitSummary,
} from '../../services/api';
import { Card, CardHeader } from '../ui/Card';
import { Spinner } from '../ui/Spinner';

function Detail({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-text-main dark:text-slate-200">{value}</dd>
    </div>
  );
}

function labStatusKey(status: string): string {
  if (status === 'Completed') return 'lab.statusCompleted';
  if (status === 'In Progress') return 'lab.statusInProgress';
  return 'lab.statusRequested';
}

function ClinicalRecord({ record }: { record: MedicalRecord }) {
  const { t } = useTranslation();
  const vitals = [
    record.vitals?.bloodPressure && {
      label: t('consultation.vitalsBloodPressure'),
      value: record.vitals.bloodPressure,
    },
    record.vitals?.temperature && {
      label: t('consultation.vitalsTemperature'),
      value: `${record.vitals.temperature}\u00b0C`,
    },
    record.vitals?.pulse && {
      label: t('consultation.vitalsPulse'),
      value: `${record.vitals.pulse} bpm`,
    },
    record.vitals?.oxygenSaturation && {
      label: t('consultation.vitalsOxygen'),
      value: `${record.vitals.oxygenSaturation}%`,
    },
    record.vitals?.weight && {
      label: t('consultation.vitalsWeight'),
      value: `${record.vitals.weight} kg`,
    },
    record.vitals?.height && {
      label: t('consultation.vitalsHeight'),
      value: `${record.vitals.height} cm`,
    },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label={t('consultation.chiefComplaint')} value={record.chiefComplaint} />
        <Detail label={t('consultation.symptoms')} value={record.symptoms?.join(', ')} />
        <Detail label={t('consultation.diagnosis')} value={record.diagnosis} />
        <Detail label={t('consultation.treatment')} value={record.treatment} />
      </dl>

      {record.notes && (
        <div>
          <p className="text-xs font-medium text-text-muted">{t('consultation.notes')}</p>
          <p className="mt-1 rounded-xl border border-slate-200 bg-surface p-3 text-sm leading-relaxed text-text-muted dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            {record.notes}
          </p>
        </div>
      )}

      {vitals.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-muted">{t('consultation.vitals')}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {vitals.map((vital) => (
              <div key={vital.label} className="rounded-lg border border-slate-200 bg-surface p-2.5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs text-text-muted">{vital.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-text-main dark:text-slate-200">{vital.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {record.followUpDate && (
        <div className="flex items-center gap-2 rounded-xl border border-status-pending-bg bg-status-pending-bg px-3 py-2 text-sm text-status-pending-text">
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span>
            {t('consultation.followUpDate')}: {new Date(record.followUpDate).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
}

export function VisitSummaryPanel({ appointmentId }: { appointmentId: string }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getVisitSummary(appointmentId)
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err) || t('visitSummary.unavailable'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appointmentId, t]);

  return (
    <Card id="visit-summary" className="mt-6 border-primary/30">
      <CardHeader
        icon={Stethoscope}
        title={t('visitSummary.title')}
        subtitle={t('visitSummary.subtitle')}
      />

      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-text-muted">
          <Spinner size="sm" />
          <span>{t('common.loading')}</span>
        </div>
      )}

      {!loading && error && (
        <p className="rounded-xl border border-status-cancelled-bg bg-status-cancelled-bg p-3 text-sm text-status-cancelled-text">
          {error}
        </p>
      )}

      {!loading && !error && summary && (
        <div className="space-y-5">
          {summary.record ? (
            <ClinicalRecord record={summary.record} />
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-text-muted dark:border-slate-700">
              {t('visitSummary.noRecord')}
            </p>
          )}

          {summary.prescriptions.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-main dark:text-white">
                <Pill className="h-4 w-4 text-primary" />
                {t('medicalHistory.prescriptions')}
              </h3>
              <div className="mt-2 space-y-3">
                {summary.prescriptions.map((prescription) => (
                  <div key={prescription._id} className="rounded-xl border border-slate-200 bg-surface p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="space-y-2">
                      {prescription.medicines.map((medicine, index) => (
                        <div key={`${prescription._id}-${index}`} className="text-sm">
                          <p className="font-semibold text-text-main dark:text-slate-200">{medicine.name}</p>
                          <p className="text-xs text-text-muted">
                            {medicine.dosage} · {medicine.frequency} · {medicine.durationDays} {t('consultation.days')}
                          </p>
                          {medicine.instructions && (
                            <p className="mt-1 text-xs text-text-muted">{medicine.instructions}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {prescription.instructions && (
                      <p className="mt-3 rounded-lg border border-status-confirmed-bg bg-status-confirmed-bg px-3 py-2 text-xs text-status-confirmed-text">
                        {prescription.instructions}
                      </p>
                    )}
                    <a
                      href={getPrescriptionPdfUrl(prescription._id)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
                    >
                      <Download className="h-4 w-4" />
                      {t('medicalHistory.downloadPrescription')}
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}

          {summary.labTests.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-main dark:text-white">
                <FlaskConical className="h-4 w-4 text-primary" />
                {t('medicalHistory.labTests')}
              </h3>
              <div className="mt-2 space-y-2">
                {summary.labTests.map((test) => (
                  <div key={test._id} className="rounded-xl border border-slate-200 bg-surface p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-main dark:text-slate-200">{test.testName}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          {test.result || t('lab.awaitingResult')}
                          {test.referenceRange && ` · ${t('lab.referenceRange')}: ${test.referenceRange}`}
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-card px-2.5 py-0.5 text-xs font-medium text-text-muted dark:border-slate-700 dark:bg-slate-900">
                        {t(labStatusKey(test.status))}
                      </span>
                    </div>
                    {test.isAbnormal && (
                      <p className="mt-2 text-xs font-semibold text-status-cancelled-text">
                        {t('lab.abnormalWarning')}
                      </p>
                    )}
                    {test.resultFileUrl && (
                      <a
                        href={test.resultFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t('lab.downloadResult')}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Link
              to="/medical-history"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover"
            >
              <FileText className="h-4 w-4" />
              {t('visitSummary.viewHistory')}
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted transition-colors hover:text-text-main dark:text-slate-400 dark:hover:text-white"
            >
              <Printer className="h-4 w-4" />
              {t('visitSummary.print')}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
