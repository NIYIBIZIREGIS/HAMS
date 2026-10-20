import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
  UserRound,
  Phone,
  Calendar,
  CreditCard,
  Droplet,
  RotateCcw,
  X,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Spinner } from '../../components/ui/Spinner';
import { pageWindow } from '../../components/ui/Pagination';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ZoomableImage } from '../../components/ui/ImageLightbox';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import {
  listPatients,
  listFacilities,
  getPatient,
  registerPatient,
  updatePatientRecord,
  deletePatient,
  type Patient,
  type Facility,
} from '../../services/api';
import { getErrorMessage } from '../../services/client';

const ITEMS_PER_PAGE = 10;

const EMPTY_REGISTER = {
  fullName: '',
  email: '',
  phone: '',
  nationalId: '',
  password: '',
  preferredLanguage: 'en',
  dob: '',
  gender: '',
  bloodGroup: '',
  allergies: '',
  facilityId: '',
};

// Mirrors the backend `registerPatientSchema` so a patient never pays for invalid input with
// an opaque server-side "Validation failed".
const namePattern = /^[\p{L}][\p{L}\s'’.\u00A0-]*$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^0\d{9}$/;
const nationalIdPattern = /^1\d{15}$/;
const passwordPattern = /(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z0-9])/;

const genderOptions = [
  { value: '', label: '— Not specified —' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const bloodGroupOptions = [
  { value: '', label: '— Not specified —' },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

function nameOf(patient: Patient): string {
  if (typeof patient.userId === 'object' && patient.userId?.fullName) return patient.userId.fullName;
  return 'Unknown patient';
}

function emailOf(patient: Patient): string {
  if (typeof patient.userId === 'object' && patient.userId?.email) return patient.userId.email;
  return '—';
}

function phoneOf(patient: Patient): string {
  if (typeof patient.userId === 'object' && patient.userId?.phone) return patient.userId.phone;
  return '—';
}

function nationalIdOf(patient: Patient): string {
  if (typeof patient.userId === 'object' && (patient.userId as any).nationalId) {
    return (patient.userId as any).nationalId;
  }
  return '—';
}

function avatarOf(patient: Patient): string | null {
  if (typeof patient.userId === 'object') {
    return (patient.userId as { profileImageUrl?: string }).profileImageUrl ?? null;
  }
  return null;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const BADGE_BASE =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium';

const genderClasses: Record<string, string> = {
  male: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
  female:
    'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-500/30 dark:bg-pink-500/10 dark:text-pink-300',
  other:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300',
};

const neutralClasses =
  'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';

const skeletonCell = 'h-3 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800';

function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-1.5">
                <div className="h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-2.5 w-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          </td>
          {[0, 1, 2, 3, 4, 5].map((j) => (
            <td key={j} className="px-5 py-3.5">
              <div className={skeletonCell} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function PatientManagement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showRegister, setShowRegister] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [detail, setDetail] = useState<Patient | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_REGISTER);

  const { data: patients, isLoading } = useQuery<Patient[]>({
    queryKey: ['patients', search],
    queryFn: () => listPatients(search || undefined),
  });

  // A platform admin must name the hospital the patient is registered into; hospital-scoped
  // accounts are pinned to their own facility and never see this selector.
  const { data: facilities } = useQuery<Facility[]>({
    queryKey: ['facilities'],
    queryFn: listFacilities,
    enabled: isSuperAdmin,
  });

  const filtered = useMemo(() => {
    if (!search) return patients ?? [];
    const q = search.toLowerCase();
    return (patients ?? []).filter(
      (p) =>
        nameOf(p).toLowerCase().includes(q) ||
        emailOf(p).toLowerCase().includes(q) ||
        phoneOf(p).includes(q) ||
        nationalIdOf(p).toLowerCase().includes(q) ||
        p.patientNumber.toLowerCase().includes(q),
    );
  }, [patients, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(currentPage * ITEMS_PER_PAGE, filtered.length);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['patients'] });
  };

  const registerMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      registerPatient({
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        nationalId: payload.nationalId,
        password: payload.password,
        preferredLanguage: payload.preferredLanguage,
        dob: payload.dob ? new Date(payload.dob).toISOString() : undefined,
        gender: payload.gender || undefined,
        bloodGroup: payload.bloodGroup || undefined,
        allergies: payload.allergies
          ? payload.allergies.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        ...(isSuperAdmin && payload.facilityId ? { facilityId: payload.facilityId } : {}),
      }),
    onSuccess: () => {
      toast.success('Patient registered successfully.', 'Patient created');
      setShowRegister(false);
      setForm(EMPTY_REGISTER);
      invalidate();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updatePatientRecord(id, payload),
    onSuccess: () => {
      toast.success('Patient record updated successfully.', 'Patient updated');
      setShowEdit(false);
      setDetail(null);
      invalidate();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePatient(id),
    onSuccess: () => {
      toast.success('Patient deactivated successfully.', 'Patient removed');
      setShowDelete(false);
      setSelected(null);
      invalidate();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const openDetail = async (patientId: string) => {
    try {
      setDetailLoading(true);
      setShowView(true);
      const res = await getPatient(patientId);
      setDetail(res);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const openEdit = async (patient: Patient) => {
    try {
      setDetailLoading(true);
      const res = await getPatient(patient._id);
      setDetail(res);
      setSelected(res);
      setShowEdit(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const openDelete = (patient: Patient) => {
    setSelected(patient);
    setShowDelete(true);
  };

  const canSubmitRegister =
    form.fullName.trim().length >= 5 &&
    namePattern.test(form.fullName.trim()) &&
    emailPattern.test(form.email.trim()) &&
    phonePattern.test(form.phone.trim()) &&
    nationalIdPattern.test(form.nationalId.trim()) &&
    form.password.length >= 6 &&
    passwordPattern.test(form.password) &&
    (!isSuperAdmin || Boolean(form.facilityId));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 dark:text-white">
            Patients
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Register, view, update and manage patient records
          </p>
        </div>
        <Button onClick={() => setShowRegister(true)} icon={Plus}>
          Register Patient
        </Button>
      </div>

      <Card padding={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search by name, email, phone, national ID or patient number..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-text-main placeholder:text-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-primary/30"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <p className="shrink-0 text-xs text-text-muted dark:text-slate-400">
            <span className="font-semibold text-text-main dark:text-slate-200">
              {filtered.length}
            </span>{' '}
            {filtered.length === 1 ? 'patient' : 'patients'}
            {search && <span className="ml-1">matching “{search}”</span>}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left dark:border-slate-800 dark:bg-slate-900/40">
                <th
                  scope="col"
                  className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Patient
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Patient No.
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Contact
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  National ID
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Gender
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Blood Group
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {isLoading ? (
                <SkeletonRows />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14">
                    <div className="mx-auto flex max-w-md flex-col items-center text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                        <Users className="h-7 w-7 text-slate-400 dark:text-slate-500" />
                      </div>
                      <p className="text-sm font-semibold text-text-main dark:text-slate-200">
                        {search ? 'No patients match your search' : 'No patients yet'}
                      </p>
                      <p className="mt-1 max-w-sm text-xs text-text-muted dark:text-slate-400">
                        {search ? (
                          <>
                            Nothing found for “{search}”. Try a full name, phone number, email
                            or patient number.
                          </>
                        ) : (
                          'Register your first patient and their portal account will be created automatically.'
                        )}
                      </p>
                      <div className="mt-5">
                        {search ? (
                          <Button
                            variant="outline"
                            size="sm"
                            icon={RotateCcw}
                            onClick={() => {
                              setSearch('');
                              setCurrentPage(1);
                            }}
                          >
                            Show all patients
                          </Button>
                        ) : (
                          <Button size="sm" icon={Plus} onClick={() => setShowRegister(true)}>
                            Register Patient
                          </Button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((patient) => (
                  <tr
                    key={patient._id}
                    className="group cursor-pointer transition-colors hover:bg-primary-25/70 dark:hover:bg-slate-800/50"
                    onClick={() => openDetail(patient._id)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={nameOf(patient)}
                          imageUrl={avatarOf(patient)}
                          size="md"
                          className="ring-2 ring-white shadow-sm dark:ring-slate-900"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-text-main dark:text-slate-100">
                            {nameOf(patient)}
                          </p>
                          <p className="truncate text-xs text-text-muted dark:text-slate-400">
                            {emailOf(patient)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-lg border border-primary-100 bg-primary-50 px-2 py-0.5 font-mono text-xs font-semibold text-primary-700 dark:border-primary-500/25 dark:bg-primary-500/10 dark:text-primary-300">
                        {patient.patientNumber}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 tabular-nums text-slate-600 dark:text-slate-300">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                        {phoneOf(patient)}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {nationalIdOf(patient)}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`capitalize ${BADGE_BASE} ${
                          genderClasses[(patient.gender ?? '').toLowerCase()] ?? neutralClasses
                        }`}
                      >
                        {patient.gender || '—'}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      {patient.bloodGroup ? (
                        <span
                          className={`${BADGE_BASE} border-red-100 bg-red-50 font-semibold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300`}
                        >
                          <Droplet className="h-3 w-3" />
                          {patient.bloodGroup}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title="View patient"
                          aria-label={`View ${nameOf(patient)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(patient._id);
                          }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-primary-300"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Edit patient"
                          aria-label={`Edit ${nameOf(patient)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(patient);
                          }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete patient"
                          aria-label={`Delete ${nameOf(patient)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDelete(patient);
                          }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 dark:text-slate-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-muted dark:text-slate-400">
            {filtered.length === 0 ? (
              'No patients to show'
            ) : (
              <>
                Showing{' '}
                <span className="font-semibold text-text-main dark:text-slate-200">
                  {rangeStart}–{rangeEnd}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-text-main dark:text-slate-200">
                  {filtered.length}
                </span>{' '}
                {filtered.length === 1 ? 'patient' : 'patients'}
              </>
            )}
          </p>

          {totalPages > 1 && (
            <nav aria-label="Patient list pages" className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-card text-text-muted transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {pageWindow(currentPage, totalPages).map((item, i) =>
                item === 'gap' ? (
                  <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    aria-current={item === currentPage ? 'page' : undefined}
                    aria-label={`Page ${item}`}
                    className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-xl px-2 text-xs font-semibold transition-colors ${
                      item === currentPage
                        ? 'bg-primary text-white shadow-sm'
                        : 'border border-slate-200 bg-card text-text-muted hover:bg-slate-100 hover:text-text-main dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-card text-text-muted transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </div>
      </Card>

      {/* Register Patient Modal */}
      <Modal
        open={showRegister}
        onClose={() => {
          setShowRegister(false);
          setForm(EMPTY_REGISTER);
        }}
        title="Register Patient"
        width="lg"
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={() => setForm(EMPTY_REGISTER)}>
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowRegister(false);
                setForm(EMPTY_REGISTER);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              icon={Plus}
              loading={registerMutation.isPending}
              disabled={!canSubmitRegister}
              onClick={() => registerMutation.mutate(form)}
            >
              Register Patient
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Create a new patient account. The patient will receive full portal access with
            these credentials.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Full name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="e.g. Jean Mugisha"
              required
              autoComplete="off"
              hint="At least 5 characters: letters, spaces, hyphens, apostrophes and periods."
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              placeholder="e.g. 0788123456"
              hint="Rwandan mobile format: 10 digits starting with 0."
            />
            <Input
              label="National ID"
              value={form.nationalId}
              onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
              required
              placeholder="e.g. 1198800123456789"
              hint="16 digits starting with 1."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              hint="At least 6 chars with a letter, number and symbol."
            />
            <Input
              label="Allergies (comma separated)"
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              placeholder="e.g. Penicillin, Peanuts"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Date of birth"
              type="date"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
            <Select
              label="Gender"
              options={genderOptions}
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            />
            <Select
              label="Blood group"
              options={bloodGroupOptions}
              value={form.bloodGroup}
              onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
            />
          </div>

          {isSuperAdmin && (
            <Select
              label="Hospital"
              options={[
                { value: '', label: '— Select a hospital —' },
                ...(facilities ?? []).map((f) => ({ value: f._id, label: f.name })),
              ]}
              value={form.facilityId}
              onChange={(e) => setForm({ ...form, facilityId: e.target.value })}
            />
          )}
        </div>
      </Modal>

      {/* View Patient Modal */}
      <Modal
        open={showView}
        onClose={() => {
          setShowView(false);
          setDetail(null);
        }}
        title="Patient Details"
        width="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner label="Loading patient..." />
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <ZoomableImage src={avatarOf(detail)} alt={`${nameOf(detail)}'s photo`}>
                <UserAvatar name={nameOf(detail)} imageUrl={avatarOf(detail)} size="lg" />
              </ZoomableImage>
              <div>
                <h3 className="text-lg font-bold text-text-main dark:text-white">
                  {nameOf(detail)}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {detail.patientNumber} · {emailOf(detail)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                {phoneOf(detail)}
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <CreditCard className="h-4 w-4 shrink-0 text-slate-400" />
                {nationalIdOf(detail)}
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                DOB: {formatDate(detail.dob)}
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm capitalize text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                Gender: {detail.gender || 'Not specified'}
              </div>
              {detail.bloodGroup && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                  <Droplet className="h-4 w-4 shrink-0 text-slate-400" />
                  Blood group: {detail.bloodGroup}
                </div>
              )}
            </div>

            {detail.allergies && detail.allergies.length > 0 && (
              <div className="rounded-xl border border-status-pending-bg bg-status-pending-bg/50 p-4">
                <h4 className="mb-2 text-sm font-semibold text-status-pending-text">Allergies</h4>
                <div className="flex flex-wrap gap-2">
                  {detail.allergies.map((allergy, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full border border-status-pending-bg bg-white px-2.5 py-0.5 text-xs font-medium text-status-pending-text"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {detail.emergencyContact?.name && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <h4 className="mb-2 text-sm font-semibold text-text-main dark:text-white">
                  Emergency Contact
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {detail.emergencyContact.name}
                  {detail.emergencyContact.relation && ` (${detail.emergencyContact.relation})`}
                  {detail.emergencyContact.phone && ` — ${detail.emergencyContact.phone}`}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button
                variant="outline"
                icon={Pencil}
                onClick={() => {
                  setShowView(false);
                  setSelected(detail);
                  openEdit(detail);
                }}
              >
                Edit Patient
              </Button>
              <Button variant="ghost" onClick={() => setShowView(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">Patient not found</div>
        )}
      </Modal>

      {/* Edit Patient Modal */}
      <Modal
        open={showEdit}
        onClose={() => {
          setShowEdit(false);
          setDetail(null);
        }}
        title="Edit Patient"
        width="lg"
        density="compact"
        footer={
          detail ? (
            <>
              <Button
                variant="ghost"
                icon={RotateCcw}
                onClick={() => selected && setDetail(selected)}
              >
                Clear
              </Button>
              <Button variant="outline" onClick={() => setShowEdit(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                icon={Pencil}
                loading={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: detail._id,
                    payload: {
                      dob: detail.dob,
                      gender: detail.gender,
                      bloodGroup: detail.bloodGroup,
                      allergies: detail.allergies,
                      emergencyContact: detail.emergencyContact,
                    },
                  })
                }
              >
                Save Changes
              </Button>
            </>
          ) : undefined
        }
      >
        {detail ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Updates apply to the patient's medical profile for {nameOf(detail)} (
              {detail.patientNumber}).
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Date of birth"
                type="date"
                value={
                  detail.dob ? new Date(detail.dob).toISOString().slice(0, 10) : ''
                }
                onChange={(e) =>
                  setDetail({ ...detail, dob: e.target.value ? new Date(e.target.value).toISOString() : undefined })
                }
              />
              <Select
                label="Gender"
                options={genderOptions}
                value={detail.gender ?? ''}
                onChange={(e) => setDetail({ ...detail, gender: e.target.value || undefined })}
              />
              <Select
                label="Blood group"
                options={bloodGroupOptions}
                value={detail.bloodGroup ?? ''}
                onChange={(e) =>
                  setDetail({ ...detail, bloodGroup: e.target.value || undefined })
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Emergency contact name"
                value={detail.emergencyContact?.name ?? ''}
                onChange={(e) =>
                  setDetail({
                    ...detail,
                    emergencyContact: { ...detail.emergencyContact, name: e.target.value },
                  })
                }
              />
              <Input
                label="Relation"
                value={detail.emergencyContact?.relation ?? ''}
                onChange={(e) =>
                  setDetail({
                    ...detail,
                    emergencyContact: { ...detail.emergencyContact, relation: e.target.value },
                  })
                }
              />
              <Input
                label="Emergency phone"
                value={detail.emergencyContact?.phone ?? ''}
                onChange={(e) =>
                  setDetail({
                    ...detail,
                    emergencyContact: { ...detail.emergencyContact, phone: e.target.value },
                  })
                }
              />
            </div>
            <Input
              label="Allergies (comma separated)"
              value={(detail.allergies ?? []).join(', ')}
              onChange={(e) =>
                setDetail({
                  ...detail,
                  allergies: e.target.value
                    ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    : [],
                })
              }
            />
          </div>
        ) : (
          <div className="flex items-center justify-center py-16">
            <Spinner label="Loading patient..." />
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => {
          setShowDelete(false);
          setSelected(null);
        }}
        onConfirm={() => selected && deleteMutation.mutate(selected._id)}
        title="Deactivate patient?"
        message={
          selected
            ? `${nameOf(selected)} (${selected.patientNumber}) will be deactivated and lose portal access. This can be reversed later.`
            : ''
        }
        confirmLabel="Deactivate"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}