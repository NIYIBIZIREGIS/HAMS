import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getRecordByAppointment,
  createMedicalRecord,
  createPrescription,
  createLabTest,
  updateAppointmentStatus,
  listLabTests,
  listPrescriptions,
  getPrescriptionPdfUrl,
  type PrescriptionMedicine,
  type Patient,
  type Appointment,
} from '../../services/api';
import { client } from '../../services/client';
import { getErrorMessage } from '../../services/client';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageSpinner } from '../../components/ui/Spinner';
import { AllergyWarningBanner } from '../../components/clinical/AllergyWarningBanner';
import { VitalsForm, VitalsDisplay } from '../../components/clinical/VitalsForm';
import { MedicineList } from '../../components/clinical/MedicineList';
import {
  User,
  FileText,
  Pill,
  FlaskConical,
  Save,
  CheckCircle,
  HeartPulse,
  Stethoscope,
  StickyNote,
  Plus,
  X,
  ChevronRight,
} from 'lucide-react';

type ConsultationStep = 'vitals' | 'record' | 'prescription' | 'labs' | 'done';

export function ConsultationScreen() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<ConsultationStep>('vitals');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [allergyWarnings, setAllergyWarnings] = useState<string[]>([]);

  const [vitals, setVitals] = useState({
    bloodPressure: '',
    temperature: '',
    weight: '',
    height: '',
    pulse: '',
    oxygenSaturation: '',
  });

  const [symptoms, setSymptoms] = useState('');
  const [treatment, setTreatment] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [recordId, setRecordId] = useState('');
  const [diagnoses, setDiagnoses] = useState<string[]>(['']);

  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>([
    { name: '', dosage: '', frequency: '', durationDays: 1, instructions: '' },
  ]);
  const [prescriptionInstructions, setPrescriptionInstructions] = useState('');
  const [prescriptionId, setPrescriptionId] = useState('');
  const [skipPrescription, setSkipPrescription] = useState(false);

  const [labTestName, setLabTestName] = useState('');
  const [labTests, setLabTests] = useState<string[]>([]);

  const { data: appointment, isLoading: loadingAppointment } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async () => {
      const res = await client.get(`/appointments/${appointmentId}`);
      return res.data.data as Appointment;
    },
    enabled: !!appointmentId,
  });

  const patientId =
    appointment && typeof appointment.patientId === 'object'
      ? appointment.patientId._id
      : typeof appointment?.patientId === 'string'
        ? appointment.patientId
        : null;

  const { data: patient, isLoading: loadingPatient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const res = await client.get(`/patients/${patientId}`);
      return res.data.data as Patient;
    },
    enabled: !!patientId,
  });

  const patientName =
    patient && typeof patient.userId === 'object'
      ? patient.userId.fullName
      : 'Patient';
  const patientAllergies = patient?.allergies ?? [];
  const patientConditions = patient?.chronicConditions ?? [];
  const patientAge = patient?.dob
    ? Math.floor(
        (Date.now() - new Date(patient.dob).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  const { data: existingRecord, isLoading: checkingRecord } = useQuery({
    queryKey: ['record-by-appointment', appointmentId],
    queryFn: () => getRecordByAppointment(appointmentId!),
    enabled: !!appointmentId,
    retry: false,
  });

  const recordMutation = useMutation({
    mutationFn: () =>
      createMedicalRecord({
        appointmentId: appointmentId!,
        vitals: {
          bloodPressure: vitals.bloodPressure || undefined,
          temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
          weight: vitals.weight ? parseFloat(vitals.weight) : undefined,
          height: vitals.height ? parseFloat(vitals.height) : undefined,
          pulse: vitals.pulse ? parseFloat(vitals.pulse) : undefined,
          oxygenSaturation: vitals.oxygenSaturation
            ? parseFloat(vitals.oxygenSaturation)
            : undefined,
        },
        symptoms: symptoms.split(',').map((s) => s.trim()).filter(Boolean),
        diagnosis: diagnoses.filter((d) => d.trim()).join('; '),
        treatment: treatment || undefined,
        notes: notes || undefined,
        followUpDate: followUpDate ? new Date(followUpDate).toISOString() : undefined,
      }),
    onSuccess: (data) => {
      setRecordId(data._id);
      setError('');
      setStep('prescription');
      queryClient.invalidateQueries({ queryKey: ['record-by-appointment', appointmentId] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const prescriptionMutation = useMutation({
    mutationFn: () =>
      createPrescription({
        medicalRecordId: recordId,
        medicines: medicines.filter((m) => m.name.trim()),
        instructions: prescriptionInstructions || undefined,
      }),
    onSuccess: (data) => {
      setPrescriptionId(data.prescription._id);
      setAllergyWarnings(data.allergyWarnings);
      setError('');
      setStep('labs');
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const labMutation = useMutation({
    mutationFn: (testName: string) =>
      createLabTest({
        appointmentId: appointmentId!,
        medicalRecordId: recordId || undefined,
        testName,
      }),
    onSuccess: (data) => {
      setLabTests((prev) => [...prev, data.testName]);
      setLabTestName('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['lab-tests'] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const completeMutation = useMutation({
    mutationFn: () => updateAppointmentStatus(appointmentId!, 'Completed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      navigate('/dashboard');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const draftMutation = useMutation({
    mutationFn: () =>
      createMedicalRecord({
        appointmentId: appointmentId!,
        vitals: {
          bloodPressure: vitals.bloodPressure || undefined,
          temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
          weight: vitals.weight ? parseFloat(vitals.weight) : undefined,
          height: vitals.height ? parseFloat(vitals.height) : undefined,
          pulse: vitals.pulse ? parseFloat(vitals.pulse) : undefined,
          oxygenSaturation: vitals.oxygenSaturation
            ? parseFloat(vitals.oxygenSaturation)
            : undefined,
        },
        symptoms: symptoms.split(',').map((s) => s.trim()).filter(Boolean),
        diagnosis: diagnoses.filter((d) => d.trim()).join('; ') || 'Draft - pending',
        treatment: treatment || undefined,
        notes: notes || undefined,
        followUpDate: followUpDate ? new Date(followUpDate).toISOString() : undefined,
      }),
    onSuccess: () => {
      setInfo(t('consultation.draftSaved', 'Draft saved'));
      queryClient.invalidateQueries({ queryKey: ['record-by-appointment', appointmentId] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const addDiagnosis = () => setDiagnoses([...diagnoses.filter((d) => d.trim()), '']);
  const removeDiagnosis = (index: number) => setDiagnoses(diagnoses.filter((_, i) => i !== index));

  if (loadingAppointment || loadingPatient || checkingRecord) return <PageSpinner />;

  if (existingRecord) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            {t('consultation.title', 'Consultation')}
          </h1>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            {t('common.back', 'Back')}
          </Button>
        </div>
        <ExistingRecordView record={existingRecord} appointmentId={appointmentId!} />
      </div>
    );
  }

  const steps: { key: ConsultationStep; label: string; icon: typeof HeartPulse }[] = [
    { key: 'vitals', label: t('consultation.stepVitals', 'Vitals'), icon: HeartPulse },
    { key: 'record', label: t('consultation.stepRecord', 'Diagnosis'), icon: Stethoscope },
    { key: 'prescription', label: t('consultation.stepPrescription', 'Rx'), icon: Pill },
    { key: 'labs', label: t('consultation.stepLabs', 'Labs'), icon: FlaskConical },
    { key: 'done', label: t('consultation.stepDone', 'Done'), icon: CheckCircle },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            {t('consultation.title', 'Consultation')}
          </h1>
          {appointment && (
            <p className="mt-1 text-sm text-slate-500">
              {appointment.timeSlot} · {appointment.appointmentDate}
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          {t('common.back', 'Back')}
        </Button>
      </div>

      {patient && (
        <Card className="border-l-4 border-l-primary-500">
          <CardBody className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                <User className="h-6 w-6 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-900">{patientName}</h2>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {patient.patientNumber}
                  </span>
                  {patientAge && (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {patientAge} {t('common.years', 'yrs')}
                    </span>
                  )}
                  {patient.gender && (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {patient.gender}
                    </span>
                  )}
                  {patient.bloodGroup && (
                    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      {patient.bloodGroup}
                    </span>
                  )}
                </div>
                {patientConditions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {patientConditions.map((c, i) => (
                      <span key={i} className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {patientAllergies.length > 0 && (
        <AllergyWarningBanner warnings={patientAllergies} onDismiss={() => {}} />
      )}

      {allergyWarnings.length > 0 && (
        <AllergyWarningBanner warnings={allergyWarnings} onDismiss={() => setAllergyWarnings([])} />
      )}

      <nav aria-label="consultation progress" className="rounded-xl border border-slate-200 bg-white shadow-card p-3">
        <ol className="flex items-center gap-1">
          {steps.map((s, i) => {
            const isActive = i === stepIndex;
            const isCompleted = i < stepIndex;
            return (
              <li key={s.key} className="flex items-center flex-1">
                <button
                  onClick={() => { if (isCompleted) setStep(s.key); }}
                  disabled={!isCompleted && !isActive}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors w-full ${
                    isActive ? 'bg-primary-50 text-primary-700'
                    : isCompleted ? 'text-emerald-600 hover:bg-emerald-50 cursor-pointer'
                    : 'text-slate-400 cursor-default'
                  }`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isCompleted ? 'bg-emerald-100 text-emerald-700'
                    : isActive ? 'bg-primary-100 text-primary-700'
                    : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isCompleted ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < steps.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300 mx-1" />}
              </li>
            );
          })}
        </ol>
      </nav>

      {step === 'vitals' && (
        <Card>
          <CardHeader title={t('consultation.vitals', 'Patient Vitals')} subtitle={t('consultation.vitalsHint', 'Record vital signs')} />
          <CardBody className="space-y-4">
            <VitalsForm vitals={vitals} onChange={setVitals} />
            {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{error}</div>}
            {info && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">{info}</div>}
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setStep('record')}>{t('common.skip', 'Skip')}</Button>
              <div className="flex gap-2">
                <Button variant="secondary" icon={Save} onClick={() => draftMutation.mutate()} loading={draftMutation.isPending}>
                  {t('consultation.saveDraft', 'Save Draft')}
                </Button>
                <Button onClick={() => { setError(''); setStep('record'); }}>{t('common.next', 'Next')}</Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 'record' && (
        <Card>
          <CardHeader title={t('consultation.diagnosis', 'Diagnosis & Notes')} subtitle={t('consultation.diagnosisHint', 'Record symptoms and diagnosis')} />
          <CardBody className="space-y-5">
            <Input label={t('consultation.symptoms', 'Symptoms')} hint={t('consultation.commaSeparated', 'Separate with commas')} placeholder="Fever, headache, cough" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} icon={Stethoscope} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('consultation.diagnosis', 'Diagnosis')} <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {diagnoses.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      value={d}
                      onChange={(e) => { const u = [...diagnoses]; u[i] = e.target.value; setDiagnoses(u); }}
                      placeholder={t('consultation.diagnosisPlaceholder', 'Enter diagnosis...')}
                    />
                    {diagnoses.length > 1 && (
                      <button type="button" onClick={() => removeDiagnosis(i)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addDiagnosis} className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:border-primary-300 hover:text-primary-600 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  {t('consultation.addDiagnosis', 'Add another diagnosis')}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="treatment">
                {t('consultation.treatment', 'Treatment Plan')}
              </label>
              <textarea id="treatment" rows={3} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder={t('consultation.treatmentPlaceholder', 'Describe treatment plan...')} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="notes">
                <StickyNote className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                {t('consultation.notes', 'Clinical Notes')}
              </label>
              <textarea id="notes" rows={4} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('consultation.notesPlaceholder', 'Additional observations...')} />
            </div>
            <Input label={t('consultation.followUpDate', 'Follow-up Date')} type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{error}</div>}
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setStep('vitals')}>{t('common.back', 'Back')}</Button>
              <div className="flex gap-2">
                <Button variant="secondary" icon={Save} onClick={() => draftMutation.mutate()} loading={draftMutation.isPending}>
                  {t('consultation.saveDraft', 'Save Draft')}
                </Button>
                <Button
                  onClick={() => {
                    setError('');
                    if (diagnoses.filter((d) => d.trim()).length === 0) {
                      setError(t('consultation.diagnosisRequired', 'At least one diagnosis is required'));
                      return;
                    }
                    recordMutation.mutate();
                  }}
                  loading={recordMutation.isPending}
                  disabled={diagnoses.filter((d) => d.trim()).length === 0}
                >
                  {t('consultation.saveRecord', 'Save & Continue')}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 'prescription' && (
        <Card>
          <CardHeader title={t('consultation.prescription', 'Prescription')} subtitle={t('consultation.prescriptionHint', 'Add medications')} />
          <CardBody className="space-y-4">
            {!skipPrescription ? (
              <>
                <MedicineList medicines={medicines} onChange={setMedicines} />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    {t('consultation.prescriptionInstructions', 'General Instructions')}
                  </label>
                  <textarea rows={3} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" value={prescriptionInstructions} onChange={(e) => setPrescriptionInstructions(e.target.value)} placeholder={t('consultation.prescriptionInstructionsHint', 'e.g. Take after meals...')} />
                </div>
                {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{error}</div>}
                <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
                  <Button variant="ghost" onClick={() => setStep('record')}>{t('common.back', 'Back')}</Button>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setSkipPrescription(true)}>
                      {t('consultation.skipPrescription', 'Skip')}
                    </Button>
                    <Button onClick={() => { setError(''); prescriptionMutation.mutate(); }} loading={prescriptionMutation.isPending} disabled={!medicines.some((m) => m.name.trim())}>
                      {t('consultation.issuePrescription', 'Issue Prescription')}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <Pill className="h-6 w-6 text-slate-400" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-900">
                  {t('consultation.prescriptionSkipped', 'Prescription skipped')}
                </p>
                <Button onClick={() => setStep('labs')} className="mt-4">
                  {t('common.next', 'Continue')}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {step === 'labs' && (
        <Card>
          <CardHeader title={t('consultation.labTests', 'Laboratory Tests')} subtitle={t('consultation.labHint', 'Order lab tests')} />
          <CardBody className="space-y-4">
            {labTests.length > 0 && (
              <div className="space-y-2">
                {labTests.map((name, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    </span>
                    <span className="text-sm font-medium text-emerald-800">{name}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input placeholder={t('consultation.labTestName', 'Enter test name...')} value={labTestName} onChange={(e) => setLabTestName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && labTestName.trim()) { setError(''); labMutation.mutate(labTestName.trim()); } }} icon={FlaskConical} className="flex-1" />
              <Button variant="secondary" onClick={() => { if (labTestName.trim()) { setError(''); labMutation.mutate(labTestName.trim()); } }} loading={labMutation.isPending} disabled={!labTestName.trim()} icon={Plus}>
                {t('consultation.addTest', 'Add')}
              </Button>
            </div>
            {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{error}</div>}
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setStep('prescription')}>{t('common.back', 'Back')}</Button>
              <Button onClick={() => setStep('done')}>{t('consultation.proceedComplete', 'Proceed to Complete')}</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 'done' && (
        <Card>
          <CardHeader title={t('consultation.complete', 'Complete Consultation')} />
          <CardBody className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-sm text-slate-600">
              {t('consultation.completeHint', 'Review and complete this consultation.')}
            </p>
            {prescriptionId && (
              <a href={getPrescriptionPdfUrl(prescriptionId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700">
                <FileText className="h-4 w-4" />
                {t('consultation.downloadPrescription', 'Download Prescription PDF')}
              </a>
            )}
            {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{error}</div>}
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="secondary" onClick={() => setStep('labs')}>{t('common.back', 'Back')}</Button>
              <Button onClick={() => completeMutation.mutate()} loading={completeMutation.isPending} icon={CheckCircle} className="min-w-[200px]">
                {t('consultation.markCompleted', 'Mark as Completed')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function ExistingRecordView({ record, appointmentId }: { record: import('../../services/api').MedicalRecord; appointmentId: string }) {
  const { t } = useTranslation();
  const { data: prescriptions } = useQuery({ queryKey: ['prescriptions', appointmentId], queryFn: () => listPrescriptions({ appointmentId }) });
  const { data: labTests } = useQuery({ queryKey: ['lab-tests', appointmentId], queryFn: () => listLabTests({ appointmentId }) });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('consultation.diagnosis', 'Diagnosis')} />
        <CardBody>
          <dl className="space-y-3 text-sm">
            {record.vitals && Object.keys(record.vitals).length > 0 && (
              <div>
                <dt className="font-medium text-slate-500">{t('consultation.vitals', 'Vitals')}</dt>
                <dd className="mt-1"><VitalsDisplay vitals={record.vitals as Record<string, unknown>} /></dd>
              </div>
            )}
            {record.symptoms.length > 0 && (
              <div>
                <dt className="font-medium text-slate-500">{t('consultation.symptoms', 'Symptoms')}</dt>
                <dd className="text-slate-700">{record.symptoms.join(', ')}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-slate-500">{t('consultation.diagnosis', 'Diagnosis')}</dt>
              <dd className="text-slate-700">{record.diagnosis}</dd>
            </div>
            {record.treatment && (
              <div>
                <dt className="font-medium text-slate-500">{t('consultation.treatment', 'Treatment')}</dt>
                <dd className="text-slate-700">{record.treatment}</dd>
              </div>
            )}
            {record.notes && (
              <div>
                <dt className="font-medium text-slate-500">{t('consultation.notes', 'Notes')}</dt>
                <dd className="text-slate-700">{record.notes}</dd>
              </div>
            )}
            {record.followUpDate && (
              <div>
                <dt className="font-medium text-slate-500">{t('consultation.followUpDate', 'Follow-up')}</dt>
                <dd className="text-slate-700">{new Date(record.followUpDate).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {prescriptions && prescriptions.length > 0 && (
        <Card>
          <CardHeader title={t('consultation.prescription', 'Prescription')} />
          <CardBody>
            {prescriptions.map((p) => (
              <div key={p._id}>
                <ul className="divide-y divide-slate-100 text-sm">
                  {p.medicines.map((m, i) => (
                    <li key={i} className="py-2">
                      <p className="font-medium text-slate-800">{m.name} — {m.dosage}</p>
                      <p className="text-slate-500">{m.frequency} for {m.durationDays} day(s){m.instructions ? ` · ${m.instructions}` : ''}</p>
                    </li>
                  ))}
                </ul>
                <a href={getPrescriptionPdfUrl(p._id)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-primary-600 underline">
                  <FileText className="h-3.5 w-3.5" />
                  {t('consultation.downloadPrescription', 'Download PDF')}
                </a>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {labTests && labTests.length > 0 && (
        <Card>
          <CardHeader title={t('consultation.labTests', 'Lab Tests')} />
          <CardBody>
            <ul className="divide-y divide-slate-100 text-sm">
              {labTests.map((lt) => (
                <li key={lt._id} className="flex items-center justify-between py-2">
                  <span className="font-medium text-slate-800">{lt.testName}</span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    lt.status === 'Completed' ? (lt.isAbnormal ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200') :
                    lt.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {lt.status}{lt.isAbnormal ? ' ⚠' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
