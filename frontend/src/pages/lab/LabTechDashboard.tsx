import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { getErrorMessage } from '../../services/client';
import { MetricCard } from '../../components/ui/MetricCard';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import {
  TestTube,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  X,
} from 'lucide-react';

type LabStatus = 'Requested' | 'In Progress' | 'Completed';

interface LabTest {
  _id: string;
  testName: string;
  result?: string;
  referenceRange?: string;
  isAbnormal: boolean;
  status: LabStatus;
  requestedAt: string;
  completedAt?: string;
  patientId:
    | { _id: string; patientNumber?: string; userId?: { fullName?: string } }
    | string;
  requestedBy: { _id: string; userId?: { fullName?: string } } | string;
}

function getPatientName(test: LabTest): string {
  const pid = test.patientId;
  if (typeof pid === 'object') {
    return pid.userId?.fullName ?? 'Patient';
  }
  return 'Patient';
}

function getRequestedByName(test: LabTest): string {
  const req = test.requestedBy;
  if (typeof req === 'object') {
    return req.userId?.fullName ?? 'Doctor';
  }
  return 'Doctor';
}

function isCritical(test: LabTest): boolean {
  const name = (test.testName ?? '').toLowerCase();
  return test.isAbnormal || name.includes('critical') || name.includes('stat');
}

function PriorityBadge({ test }: { test: LabTest }) {
  if (isCritical(test)) {
    return (
      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
        Critical
      </span>
    );
  }
  if ((test.testName ?? '').toLowerCase().includes('urgent')) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        High
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
      Normal
    </span>
  );
}

function StatusBadge({ status, isAbnormal }: { status: LabStatus; isAbnormal: boolean }) {
  const className =
    status === 'Completed'
      ? isAbnormal
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'In Progress'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-blue-200 bg-blue-50 text-blue-700';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {status === 'Requested' ? 'Pending' : status}
    </span>
  );
}

export function LabTechDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [tests, setTests] = useState<LabTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null);
  const [result, setResult] = useState('');
  const [referenceRange, setReferenceRange] = useState('');
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await api.get<{ data: LabTest[] }>('/lab-tests');
      setTests(res.data.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  const pendingTests = tests.filter((lt) => lt.status === 'Requested').length;
  const inProgress = tests.filter((lt) => lt.status === 'In Progress').length;
  const completedToday = tests.filter((lt) => lt.status === 'Completed').length;
  const criticalResults = tests.filter((lt) => isCritical(lt)).length;

  function openResultModal(test: LabTest) {
    setSelectedTest(test);
    setResult(test.result ?? '');
    setReferenceRange(test.referenceRange ?? '');
    setIsAbnormal(test.isAbnormal);
  }

  function closeResultModal() {
    setSelectedTest(null);
    setResult('');
    setReferenceRange('');
    setIsAbnormal(false);
  }

  async function handleStartProcessing(id: string) {
    setStartingId(id);
    setError('');
    try {
      await api.put(`/lab-tests/${id}`, { status: 'In Progress' });
      await loadTests();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setStartingId(null);
    }
  }

  async function handleSaveResult() {
    if (!selectedTest) return;
    setIsSaving(true);
    setError('');
    try {
      await api.put(`/lab-tests/${selectedTest._id}`, {
        status: 'Completed',
        result: result || undefined,
        referenceRange: referenceRange || undefined,
        isAbnormal,
      });
      closeResultModal();
      await loadTests();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-display">
          {t('lab.title', 'Laboratory')}, {user?.fullName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('lab.subtitle', 'Lab Technician Dashboard')} ·{' '}
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Clock}
          label={t('lab.pendingTests', 'Pending Tests')}
          value={pendingTests}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <MetricCard
          icon={TestTube}
          label={t('lab.inProgress', 'In Progress')}
          value={inProgress}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <MetricCard
          icon={CheckCircle2}
          label={t('lab.completedToday', 'Completed Today')}
          value={completedToday}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <MetricCard
          icon={AlertTriangle}
          label={t('lab.criticalResults', 'Critical Results')}
          value={criticalResults}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
      </div>

      {/* Pending Tests Queue */}
      <Card>
        <CardHeader
          title={t('lab.testQueue', 'Pending Tests Queue')}
          subtitle={`${tests.length} ${t('lab.tests', 'tests assigned to the lab')}`}
          action={
            <Button variant="ghost" size="sm" onClick={() => loadTests()}>
              Refresh
            </Button>
          }
        />
        {tests.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <TestTube className="h-6 w-6 text-slate-400" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-900">
              {t('lab.noTests', 'No tests in the queue')}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t('lab.noTestsHint', 'New lab requests will appear here.')}
            </p>
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto pb-1 sm:-mx-5">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">{t('lab.patient', 'Patient')}</th>
                  <th className="px-5 py-3">{t('lab.testType', 'Test Type')}</th>
                  <th className="px-5 py-3">{t('lab.orderedBy', 'Ordered By')}</th>
                  <th className="px-5 py-3">{t('lab.date', 'Date')}</th>
                  <th className="px-5 py-3">{t('lab.priority', 'Priority')}</th>
                  <th className="px-5 py-3">{t('lab.status', 'Status')}</th>
                  <th className="px-5 py-3 text-right">{t('common.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tests.map((test) => (
                  <tr key={test._id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {getPatientName(test)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{test.testName}</td>
                    <td className="px-5 py-3.5 text-slate-600">{getRequestedByName(test)}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {new Date(test.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <PriorityBadge test={test} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={test.status} isAbnormal={test.isAbnormal} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {test.status === 'Requested' && (
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Clock}
                            loading={startingId === test._id}
                            onClick={() => handleStartProcessing(test._id)}
                          >
                            {t('lab.startProcessing', 'In Progress')}
                          </Button>
                        )}
                        {test.status !== 'Completed' && (
                          <Button
                            size="sm"
                            icon={FileText}
                            onClick={() => openResultModal(test)}
                          >
                            {t('lab.enterResult', 'Enter Result')}
                          </Button>
                        )}
                        {test.status === 'Completed' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('lab.done', 'Done')}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Result Entry Modal */}
      {selectedTest && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden px-4 pb-4 pt-10">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={closeResultModal}
            aria-hidden="true"
          />
          <Card className="relative z-10 flex max-h-[calc(100dvh-3.5rem)] w-full max-w-md flex-col overflow-hidden p-5">
            <CardHeader
              className="shrink-0"
              title={selectedTest.testName}
              subtitle={`${getPatientName(selectedTest)} · ${getRequestedByName(selectedTest)}`}
              action={
                <button
                  onClick={closeResultModal}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  aria-label={t('common.close', 'Close')}
                >
                  <X className="h-4 w-4" />
                </button>
              }
            />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
              <div>
                <label
                  htmlFor="lab-result-entry"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t('lab.result', 'Test Result')}
                </label>
                <textarea
                  id="lab-result-entry"
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder={t('lab.resultPlaceholder', 'Enter test result...')}
                />
              </div>

              <Input
                label={t('lab.referenceRange', 'Normal Range')}
                type="text"
                value={referenceRange}
                onChange={(e) => setReferenceRange(e.target.value)}
                placeholder="e.g. 4.0–11.0 × 10⁹/L"
              />

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  checked={isAbnormal}
                  onChange={(e) => setIsAbnormal(e.target.checked)}
                />
                <span className="text-sm font-medium text-red-600">
                  {t('lab.flagAbnormal', 'Flag as Abnormal')}
                </span>
              </label>

              {isAbnormal && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {t(
                    'lab.abnormalWarning',
                    'This result is outside normal range. The doctor will be notified.',
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 flex shrink-0 justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={closeResultModal}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                icon={CheckCircle2}
                loading={isSaving}
                onClick={handleSaveResult}
              >
                {t('lab.saveAndComplete', 'Save & Complete')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
