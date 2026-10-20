import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import {
  getPatientTimelinePage,
  getPrescriptionPdfUrl,
  type MedicalRecord,
  type Prescription,
  type LaboratoryTest,
  type TimelineEntry as TimelineEntryDto,
} from '../../services/api';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import {
  Stethoscope,
  FlaskConical,
  Pill,
  ChevronDown,
  ChevronUp,
  Download,
  Calendar,
  Search,
  Inbox,
} from 'lucide-react';

const PAGE_SIZE = 10;

type FilterType = 'all' | 'consultation' | 'lab' | 'prescription';

/** The portal's consultation tab is the timeline's `record` branch. */
const FILTER_TO_TYPE: Record<FilterType, TimelineEntryDto['type'] | 'all'> = {
  all: 'all',
  consultation: 'record',
  lab: 'lab',
  prescription: 'prescription',
};

interface TimelineEntry {
  id: string;
  type: 'consultation' | 'lab' | 'prescription';
  date: string;
  title: string;
  doctor?: string;
  facility?: string;
  diagnosis?: string;
  status?: string;
  abnormal?: boolean;
  raw: MedicalRecord | Prescription | LaboratoryTest;
}

function StatusBadge({ status, abnormal }: { status: string; abnormal?: boolean }) {
  let classes = '';
  if (abnormal || ['Cancelled', 'Rejected', 'Missed'].includes(status)) {
    classes = 'bg-status-cancelled-bg text-status-cancelled-text border-status-cancelled-bg';
  } else if (['Completed', 'active', 'approved'].includes(status)) {
    classes = 'bg-status-confirmed-bg text-status-confirmed-text border-status-confirmed-bg';
  } else if (['In Progress', 'Requested', 'Pending', 'info'].includes(status)) {
    classes = 'bg-status-pending-bg text-status-pending-text border-status-pending-bg';
  } else {
    classes = 'bg-primary-50 text-primary-700 border-primary-50';
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {status}{abnormal && ' · Abnormal'}
    </span>
  );
}

function ExpandableCard({ entry, t }: { entry: TimelineEntry; t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false);

  const typeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
    consultation: { icon: Stethoscope, color: 'text-primary', bgColor: 'bg-primary-50' },
    lab: { icon: FlaskConical, color: 'text-primary', bgColor: 'bg-primary-50' },
    prescription: { icon: Pill, color: 'text-secondary', bgColor: 'bg-secondary-50' },
  };

  const config = typeConfig[entry.type] ?? typeConfig.consultation;
  const TypeIcon = config.icon;
  const record = entry.raw;

  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.bgColor} ring-4 ring-white`}>
          <TypeIcon className={`h-5 w-5 ${config.color}`} />
        </div>
      </div>

      <div className="min-w-0 flex-1 pb-6">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left"
          aria-expanded={expanded}
        >
          <div className="rounded-xl border border-slate-200 bg-card p-4 shadow transition-colors hover:border-slate-300">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-text-main">{entry.title}</p>
                  {entry.status && (
                    <StatusBadge status={entry.status} abnormal={entry.abnormal} />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(entry.date).toLocaleDateString()}
                  {entry.doctor && (
                    <>
                      <span className="text-slate-300">·</span>
                      {entry.doctor}
                    </>
                  )}
                </div>
                {entry.facility && (
                  <p className="mt-1 text-xs text-text-muted">{entry.facility}</p>
                )}
                {!expanded && entry.diagnosis && (
                  <p className="mt-1.5 truncate text-xs text-text-main">{entry.diagnosis}</p>
                )}
              </div>
              <div className="shrink-0 text-text-muted">
                {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </div>
          </div>
        </button>

        {expanded && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-surface p-4">
            {entry.type === 'consultation' && <ConsultationDetails record={record as MedicalRecord} t={t} />}
            {entry.type === 'prescription' && <PrescriptionDetails record={record as Prescription} t={t} />}
            {entry.type === 'lab' && <LabDetails record={record as LaboratoryTest} t={t} />}
          </div>
        )}
      </div>
    </div>
  );
}

function ConsultationDetails({ record, t }: { record: MedicalRecord; t: (key: string) => string }) {
  return (
    <div className="space-y-3 text-sm">
      {record.symptoms?.length > 0 && (
        <div>
          <p className="font-medium text-text-main">{t('consultation.symptoms')}</p>
          <p className="text-text-muted">{record.symptoms.join(', ')}</p>
        </div>
      )}
      <div>
        <p className="font-medium text-text-main">{t('consultation.diagnosis')}</p>
        <p className="text-text-main">{record.diagnosis}</p>
      </div>
      {record.treatment && (
        <div>
          <p className="font-medium text-text-main">{t('consultation.treatment')}</p>
          <p className="text-text-muted">{record.treatment}</p>
        </div>
      )}
      {record.notes && (
        <div>
          <p className="font-medium text-text-main">{t('consultation.notes')}</p>
          <p className="text-text-muted">{record.notes}</p>
        </div>
      )}
      {record.vitals && (
        <div>
          <p className="font-medium text-text-main">{t('consultation.vitals')}</p>
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
            {record.vitals.bloodPressure && (
              <span className="text-text-muted">BP: {record.vitals.bloodPressure}</span>
            )}
            {record.vitals.temperature && (
              <span className="text-text-muted">Temp: {record.vitals.temperature}°C</span>
            )}
            {record.vitals.pulse && (
              <span className="text-text-muted">Pulse: {record.vitals.pulse} bpm</span>
            )}
            {record.vitals.oxygenSaturation && (
              <span className="text-text-muted">SpO₂: {record.vitals.oxygenSaturation}%</span>
            )}
            {record.vitals.weight && (
              <span className="text-text-muted">Weight: {record.vitals.weight} kg</span>
            )}
            {record.vitals.height && (
              <span className="text-text-muted">Height: {record.vitals.height} cm</span>
            )}
          </div>
        </div>
      )}
      {record.followUpDate && (
        <div className="rounded-xl border border-status-pending-bg bg-status-pending-bg p-2 text-xs text-status-pending-text">
          {t('consultation.followUpDate')}: {new Date(record.followUpDate).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

function PrescriptionDetails({ record, t }: { record: Prescription; t: (key: string) => string }) {
  return (
    <div className="space-y-3 text-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium text-text-muted">
            <th className="pb-2 pr-3">{t('consultation.medicineName')}</th>
            <th className="pb-2 pr-3">{t('consultation.dosage')}</th>
            <th className="pb-2 pr-3">{t('consultation.frequency')}</th>
            <th className="pb-2">{t('consultation.duration')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {record.medicines.map((m, i) => (
            <tr key={i}>
              <td className="py-2 pr-3 font-medium text-text-main">{m.name}</td>
              <td className="py-2 pr-3 text-text-muted">{m.dosage}</td>
              <td className="py-2 pr-3 text-text-muted">{m.frequency}</td>
              <td className="py-2 text-text-muted">{m.durationDays} {t('consultation.days')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {record.instructions && (
        <p className="rounded-xl border border-status-confirmed-bg bg-status-confirmed-bg px-3 py-2 text-xs text-status-confirmed-text">
          {record.instructions}
        </p>
      )}
      <a
        href={getPrescriptionPdfUrl(record._id)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
      >
        <Download className="h-4 w-4" />
        {t('medicalHistory.downloadPrescription')}
      </a>
    </div>
  );
}

function LabDetails({ record, t }: { record: LaboratoryTest; t: (key: string) => string }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <StatusBadge status={record.status} abnormal={record.isAbnormal} />
      </div>
      {record.result ? (
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-text-muted">{t('lab.result')}</dt>
            <dd className={`font-medium ${record.isAbnormal ? 'text-status-cancelled-text' : 'text-text-main'}`}>
              {record.result}
            </dd>
          </div>
          {record.referenceRange && (
            <div className="flex justify-between">
              <dt className="text-text-muted">{t('lab.referenceRange')}</dt>
              <dd className="text-text-muted">{record.referenceRange}</dd>
            </div>
          )}
          {record.completedAt && (
            <div className="flex justify-between">
              <dt className="text-text-muted">{t('lab.completedAt')}</dt>
              <dd className="text-text-muted">{new Date(record.completedAt).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-text-muted">{t('lab.awaitingResult')}</p>
      )}
      {record.resultFileUrl && (
        <a
          href={record.resultFileUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
        >
          <Download className="h-4 w-4" />
          {t('lab.downloadResult')}
        </a>
      )}
    </div>
  );
}

export function MedicalHistoryPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);

  // Typing should not fire a request per keystroke, so the query is debounced and only
  // committed to `deferredSearch` once typing settles.
  const [deferredSearch, setDeferredSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDeferredSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setLoading(true);
    getPatientTimelinePage(user.id, {
      page,
      limit: PAGE_SIZE,
      type: FILTER_TO_TYPE[filter],
      ...(deferredSearch ? { search: deferredSearch } : {}),
    })
      .then((result) => {
        if (!mounted) return;
        setPages(result.pages);
        setPage(result.page);
        setTotal(result.total);
        setEntries(
          result.items.map((dto) => ({
            id: dto.id,
            type: dto.type === 'record' ? ('consultation' as const) : dto.type,
            date: dto.date,
            title: dto.title,
            status: dto.status ?? undefined,
            doctor: dto.doctorName ?? undefined,
            facility: dto.facilityName ?? undefined,
            diagnosis:
              typeof dto.payload.diagnosis === 'string' ? dto.payload.diagnosis : undefined,
            abnormal: dto.payload.isAbnormal === true ? true : undefined,
            raw: dto.payload as unknown as MedicalRecord | Prescription | LaboratoryTest,
          })),
        );
      })
      .catch(() => {
        if (mounted) setEntries([]);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [user, page, filter, deferredSearch]);

  if (loading && entries.length === 0) return <PageSpinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-main">{t('medicalHistory.title')}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {t('pagination.showing', { count: total, label: t('pagination.historyEntries') })}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder={t('common.search') + '...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-card py-2.5 pl-10 pr-4 text-sm text-text-main placeholder-slate-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {([
            { value: 'all', label: t('appointments.all') },
            { value: 'consultation', label: t('consultation.title') },
            { value: 'lab', label: t('medicalHistory.labTests') },
            { value: 'prescription', label: t('medicalHistory.prescriptions') },
          ] as { value: FilterType; label: string }[]).map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setFilter(f.value);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.value
                  ? 'bg-card text-text-main shadow'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="mx-auto h-12 w-12 text-text-muted/40" />
          <h3 className="mt-3 font-display text-lg font-semibold text-text-main">
            {t('medicalHistory.title')}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {filter === 'prescription'
              ? t('medicalHistory.noPrescriptions')
              : filter === 'lab'
                ? t('medicalHistory.noLabTests')
                : t('appointments.noAppointments')}
          </p>
        </Card>
      ) : (
        <>
          {loading && <PageSpinner />}
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
            <div className="space-y-0">
              {entries.map((entry) => (
                <ExpandableCard key={`${entry.type}-${entry.id}`} entry={entry} t={t} />
              ))}
            </div>
          </div>
        </>
      )}

      <Pagination
        page={page}
        pages={pages}
        total={total}
        itemLabel="pagination.historyEntries"
        disabled={loading}
        onChange={setPage}
      />
    </div>
  );
}
