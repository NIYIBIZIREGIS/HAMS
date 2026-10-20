import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  listFacilities,
  listDepartments,
  listDoctors,
  getAvailability,
  bookAppointment,
  getErrorMessage,
  type Facility,
  type Department,
  type Doctor,
  type AvailableSlot,
} from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { PageSpinner } from '../../components/ui/Spinner';
import { SlotPicker } from '../../components/appointments/SlotPicker';
import {
  Building2,
  Stethoscope,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type StepId = 'facility' | 'doctor' | 'confirm';

const STEPS: { id: StepId; labelKey: string; icon: React.ElementType }[] = [
  { id: 'facility', labelKey: 'booking.stepFacility', icon: Building2 },
  { id: 'doctor', labelKey: 'booking.stepDoctor', icon: Stethoscope },
  { id: 'confirm', labelKey: 'booking.stepConfirm', icon: CalendarCheck },
];

interface BookingForm {
  facilityId: string;
  departmentId: string;
  doctorId: string;
  date: string;
  timeSlot: string;
  reason: string;
  visitType: string;
}

const INITIAL_FORM: BookingForm = {
  facilityId: '',
  departmentId: '',
  doctorId: '',
  date: '',
  timeSlot: '',
  reason: '',
  visitType: 'new',
};

export function BookingWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<BookingForm>(INITIAL_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [facs, depts] = await Promise.all([listFacilities(), listDepartments()]);
        setFacilities(facs);
        setDepartments(depts);
      } catch {
        // silent
      } finally {
        setLoadingData(false);
      }
    }
    load();
  }, []);

  const facilityDepartments = useMemo(
    () => departments.filter((d) => d.facilityId === form.facilityId),
    [departments, form.facilityId],
  );

  const facilityDoctors = useMemo(
    () =>
      doctors.filter((d) =>
        (Array.isArray(d.departmentId) ? d.departmentId : []).some((dep) =>
          typeof dep === 'string' ? dep === form.departmentId : dep._id === form.departmentId,
        ),
      ),
    [doctors, form.departmentId],
  );

  useEffect(() => {
    if (!form.departmentId) return;
    let cancelled = false;
    async function loadDoctors() {
      try {
        const docs = await listDoctors();
        if (!cancelled) setDoctors(docs);
      } catch {
        // silent
      }
    }
    loadDoctors();
    return () => { cancelled = true; };
  }, [form.departmentId]);

  useEffect(() => {
    if (!form.doctorId || !form.date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    async function loadSlots() {
      setLoadingSlots(true);
      try {
        const s = await getAvailability(form.doctorId, form.date);
        if (!cancelled) setSlots(s);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    loadSlots();
    return () => { cancelled = true; };
  }, [form.doctorId, form.date]);

  useEffect(() => {
    setForm((f) => ({ ...f, timeSlot: '' }));
  }, [form.date, form.doctorId]);

  const update = (field: keyof BookingForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const resetCascade = (field: 'facilityId' | 'departmentId') => {
    if (field === 'facilityId') {
      setForm((f) => ({ ...f, departmentId: '', doctorId: '', date: '', timeSlot: '' }));
      setDoctors([]);
    } else if (field === 'departmentId') {
      setForm((f) => ({ ...f, doctorId: '', date: '', timeSlot: '' }));
      setDoctors([]);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const selectedFacility = facilities.find((f) => f._id === form.facilityId);
  const selectedDepartment = facilityDepartments.find((d) => d._id === form.departmentId);
  const selectedDoctor = facilityDoctors.find((d) => d._id === form.doctorId);
  const doctorName =
    selectedDoctor && typeof selectedDoctor.userId === 'object'
      ? selectedDoctor.userId.fullName
      : '';

  const canNext = () => {
    if (step === 0) return !!form.facilityId && !!form.departmentId;
    if (step === 1) return !!form.doctorId && !!form.date && !!form.timeSlot;
    return true;
  };

  const goNext = () => {
    setError('');
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const goBack = () => {
    setError('');
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await bookAppointment({
        facilityId: form.facilityId,
        doctorId: form.doctorId,
        departmentId: form.departmentId,
        appointmentDate: new Date(form.date).toISOString(),
        timeSlot: form.timeSlot,
        reason: form.reason,
        visitType: form.visitType,
      });
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) return <PageSpinner />;

  if (success) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-status-confirmed-bg">
            <Check className="h-8 w-8 text-status-confirmed-text" />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-text-main">{t('booking.success')}</h2>
          <p className="mt-2 text-sm text-text-muted">
            {t('booking.date')}: {new Date(form.date).toLocaleDateString()} · {form.timeSlot}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/patient/dashboard')}>
              {t('nav.dashboard')}
            </Button>
            <Button onClick={() => { setSuccess(false); setForm(INITIAL_FORM); setStep(0); }}>
              {t('dashboard.quickBook')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-main">{t('booking.title')}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t('booking.stepFacility')} → {t('booking.stepDoctor')} → {t('booking.stepConfirm')}
        </p>
      </div>

      <nav aria-label="Progress" className="flex items-center justify-center gap-0">
        {STEPS.map((s, i) => {
          const isCompleted = i < step;
          const isCurrent = i === step;
          const StepIcon = s.icon;
          return (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    isCompleted
                      ? 'bg-status-confirmed-text text-white'
                      : isCurrent
                        ? 'bg-primary text-white ring-4 ring-primary-100'
                        : 'bg-slate-200 text-text-muted'
                  }`}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </span>
                <span
                  className={`mt-2 text-xs font-medium ${isCurrent ? 'text-primary' : isCompleted ? 'text-status-confirmed-text' : 'text-text-muted'}`}
                >
                  {t(s.labelKey)}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-3 mb-6 h-0.5 w-16 sm:w-24 ${i < step ? 'bg-status-confirmed-text' : 'bg-slate-200'}`}
                />
              )}
            </div>
          );
        })}
      </nav>

      <Card className="p-6">
        <div className="space-y-5">
          {step === 0 && (
            <>
              <Select
                label={t('booking.stepFacility')}
                placeholder={t('booking.selectFacility')}
                options={facilities.filter((f) => f.isActive).map((f) => ({ value: f._id, label: f.name }))}
                value={form.facilityId}
                onChange={(e) => {
                  update('facilityId', e.target.value);
                  resetCascade('facilityId');
                }}
              />
              <Select
                label={t('booking.stepDepartment')}
                placeholder={form.facilityId ? t('booking.stepDepartment') : t('booking.selectFacility')}
                options={facilityDepartments.map((d) => ({ value: d._id, label: d.name }))}
                value={form.departmentId}
                onChange={(e) => {
                  update('departmentId', e.target.value);
                  resetCascade('departmentId');
                }}
                disabled={!form.facilityId}
              />
            </>
          )}

          {step === 1 && (
            <>
              <Select
                label={t('booking.stepDoctor')}
                placeholder={form.departmentId ? t('booking.stepDoctor') : t('booking.selectFacility')}
                options={facilityDoctors.map((d) => ({
                  value: d._id,
                  label:
                    (typeof d.userId === 'object' ? d.userId.fullName : 'Doctor') +
                    (d.specialization?.length ? ` — ${d.specialization.join(', ')}` : ''),
                }))}
                value={form.doctorId}
                onChange={(e) => update('doctorId', e.target.value)}
                disabled={!form.departmentId}
              />
              <Input
                label={t('booking.date')}
                type="date"
                min={today}
                value={form.date}
                onChange={(e) => update('date', e.target.value)}
              />
              {form.date && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-main">
                    {t('booking.time')}
                  </label>
                  {loadingSlots ? (
                    <div className="py-8 text-center">
                      <PageSpinner />
                    </div>
                  ) : (
                    <SlotPicker
                      slots={slots}
                      selected={form.timeSlot}
                      onSelect={(time) => update('timeSlot', time)}
                    />
                  )}
                </div>
              )}
              <Select
                label={t('booking.visitType')}
                value={form.visitType}
                onChange={(e) => update('visitType', e.target.value)}
                options={[
                  { value: 'new', label: t('booking.visitNew') },
                  { value: 'follow-up', label: t('booking.visitFollowUp') },
                  { value: 'referral', label: t('booking.visitReferral') },
                ]}
              />
              <Input
                label={t('booking.reason')}
                hint={t('common.optional')}
                value={form.reason}
                onChange={(e) => update('reason', e.target.value)}
                maxLength={500}
              />
            </>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-text-main">{t('booking.stepConfirm')}</p>
              <div className="rounded-xl border border-slate-200 bg-surface p-4">
                <dl className="space-y-3 text-sm">
                  <Row label={t('booking.stepFacility')} value={selectedFacility?.name ?? ''} />
                  <Row label={t('booking.stepDepartment')} value={selectedDepartment?.name ?? ''} />
                  <Row label={t('booking.stepDoctor')} value={doctorName} />
                  <Row label={t('booking.date')} value={form.date ? new Date(form.date).toLocaleDateString() : ''} />
                  <Row label={t('booking.time')} value={form.timeSlot} />
                  <Row label={t('booking.visitType')} value={t(`booking.visit${form.visitType.charAt(0).toUpperCase() + form.visitType.slice(1).replace('-', '')}`)} />
                  {form.reason && <Row label={t('booking.reason')} value={form.reason} />}
                </dl>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-status-cancelled-bg bg-status-cancelled-bg p-3 text-sm text-status-cancelled-text" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={goBack} disabled={step === 0} icon={ChevronLeft}>
              <ChevronLeft className="h-4 w-4" />
              {t('booking.back')}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={goNext} disabled={!canNext()}>
                {t('booking.next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} loading={submitting} disabled={submitting}>
                {t('booking.confirm')}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium text-text-main">{value}</dd>
    </div>
  );
}
