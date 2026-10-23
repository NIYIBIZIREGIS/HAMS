import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Building2,
  MapPin,
  Phone,
  Mail,
  MoreVertical,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  KeyRound,
  X,
  RotateCcw,
  Trash2,
  Image as ImageIcon,
  Copy,
  Check,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { client, getErrorMessage } from '../../services/client';
import { toast } from '../../store/toastStore';
import { pageWindow } from '../../components/ui/Pagination';
import { StepIndicator } from '../../components/ui/StepIndicator';
import {
  listUsers,
  type Facility,
  type FacilityOnboardingResult,
  type StaffUser,
  type SubscriptionStatus,
} from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';

const TYPE_OPTIONS = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'health_center', label: 'Health Center' },
  { value: 'district_office', label: 'District Office' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'trial', label: 'Trial' },
  { value: 'expired', label: 'Expired' },
];

const SUBSCRIPTION_OPTIONS = [
  { value: '', label: '— unchanged —' },
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'expired', label: 'Expired' },
];

interface FacilityFormData {
  name: string;
  type: Facility['type'];
  address: string;
  district: string;
  region: string;
  phone: string;
  email: string;
  logo: string;
  subscriptionStatus: '' | SubscriptionStatus;
  // Only used when registering, never when editing.
  createAdmin: boolean;
  adminFullName: string;
  adminEmail: string;
  adminPhone: string;
  adminNationalId: string;
}

const INITIAL_FORM: FacilityFormData = {
  name: '',
  type: 'clinic',
  address: '',
  district: '',
  region: '',
  phone: '',
  email: '',
  logo: '',
  subscriptionStatus: '',
  createAdmin: true,
  adminFullName: '',
  adminEmail: '',
  adminPhone: '',
  adminNationalId: '',
};

const ITEMS_PER_PAGE = 8;

const BADGE_BASE =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium';

const neutralClasses =
  'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';

/**
 * The subscription column sits next to the operational Status column, which already renders a
 * filled pill for the same underlying state. A dot keeps the two readable as different things.
 */
const subscriptionDot: Record<string, string> = {
  active: 'bg-emerald-500',
  trial: 'bg-sky-500',
  expired: 'bg-amber-500',
  suspended: 'bg-red-500',
};

function toFacilityFormData(facility: Facility): FacilityFormData {
  return {
    ...INITIAL_FORM,
    createAdmin: false,
    name: facility.name,
    type: facility.type,
    address: facility.address ?? '',
    district: facility.district ?? '',
    region: facility.region ?? '',
    phone: facility.contactInfo?.phone ?? '',
    email: facility.contactInfo?.email ?? '',
    logo: facility.logo ?? '',
  };
}

export function FacilityRegistryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  /** Registration is two steps so nothing has to be scrolled past; editing stays single. */
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailFacility, setDetailFacility] = useState<Facility | null>(null);
  const [formData, setFormData] = useState<FacilityFormData>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<FacilityOnboardingResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Facility | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionTarget, setSubscriptionTarget] = useState<Facility | null>(null);
  const [subscriptionChoice, setSubscriptionChoice] = useState<'' | SubscriptionStatus>('');

  const { data: facilities, isLoading } = useQuery<Facility[]>({
    queryKey: ['facilities'],
    queryFn: async () => {
      const res = await client.get('/facilities');
      return res.data.data;
    },
  });

  const { data: users } = useQuery<StaffUser[]>({
    queryKey: ['users'],
    queryFn: listUsers,
  });

  const admins = useMemo(
    () => (users ?? []).filter((u) => u.role === 'facility_admin'),
    [users],
  );

  const filtered = useMemo(() => {
    return (facilities ?? []).filter((f) => {
      const matchesSearch =
        !searchFilter || f.name.toLowerCase().includes(searchFilter.toLowerCase());
      const matchesType = !typeFilter || f.type === typeFilter;
      // The subscription is the commercial state; `isActive` is derived from it, so a
      // suspended subscription shows as suspended rather than as a second "active" state.
      const matchesStatus = !statusFilter || f.subscriptionStatus === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [facilities, searchFilter, typeFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(currentPage * ITEMS_PER_PAGE, filtered.length);
  const hasFilters = Boolean(searchFilter || typeFilter || statusFilter);

  const resetFilters = () => {
    setSearchFilter('');
    setTypeFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  const totalFacilities = facilities?.length ?? 0;
  const activeFacilities =
    facilities?.filter((f) => f.isActive && f.subscriptionStatus !== 'suspended').length ?? 0;
  const suspendedFacilities =
    facilities?.filter((f) => !f.isActive || f.subscriptionStatus === 'suspended').length ?? 0;

  const createMutation = useMutation({
    mutationFn: async (data: FacilityFormData) => {
      // `contactInfo` is a nested object on the model; flat `phone`/`email` keys are
      // stripped by validation, so they must be nested to be persisted.
      const payload: Record<string, unknown> = {
        name: data.name.trim(),
        type: data.type,
        address: data.address.trim() || undefined,
        district: data.district.trim() || undefined,
        region: data.region.trim() || undefined,
        logo: data.logo.trim() || undefined,
      };
      if (data.phone.trim() || data.email.trim()) {
        payload.contactInfo = {
          phone: data.phone.trim() || undefined,
          email: data.email.trim() || undefined,
        };
      }

      if (editingFacility) {
        return client.put(`/facilities/${editingFacility._id}`, payload);
      }

      if (data.subscriptionStatus) payload.subscriptionStatus = data.subscriptionStatus;
      if (data.createAdmin) {
        payload.admin = {
          fullName: data.adminFullName.trim(),
          email: data.adminEmail.trim().toLowerCase(),
          phone: data.adminPhone.trim() || undefined,
          nationalId: data.adminNationalId.trim() || undefined,
        };
      }
      return client.post('/facilities', payload);
    },
    onSuccess: (res) => {
      // A successful registration returns the temporary password exactly once, so it is
      // shown in a dedicated handover step instead of a dismissible toast.
      if (!editingFacility && res.data?.data?.temporaryPassword) {
        setCredentials(res.data.data as FacilityOnboardingResult);
      } else {
        toast.success(editingFacility ? 'Facility updated.' : 'Facility registered.', 'Facility');
      }
      setShowFormModal(false);
      setEditingFacility(null);
      setFormData(INITIAL_FORM);
      setFormStep(1);
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // The backend exposes activate/deactivate as PATCH sub-resources; there is no
  // `PUT /:id/status` route, so a status change goes through these mutations.
  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'deactivate' }) =>
      client.patch(`/facilities/${id}/${action}`),
    onSuccess: () => {
      toast.success('Facility status updated.');
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const subscriptionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SubscriptionStatus }) =>
      client.patch(`/facilities/${id}/subscription`, { subscriptionStatus: status }),
    onSuccess: () => {
      toast.success('Subscription updated.');
      setShowSubscriptionModal(false);
      setSubscriptionTarget(null);
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.delete(`/facilities/${id}`),
    onSuccess: (res) => {
      const suspendedStaff = res.data?.data?.suspendedStaff ?? 0;
      toast.success(
        `Hospital deleted${suspendedStaff ? ` — ${suspendedStaff} staff account(s) suspended` : ''}. Records are retained.`,
        'Hospital deleted',
      );
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const openCreateModal = () => {
    setEditingFacility(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setFormStep(1);
    setShowFormModal(true);
  };

  // Deep link support: the dashboard links here with `?register=1` so "register a hospital"
  // lands directly on the form rather than on the registry table. The param is dropped as
  // soon as it is honoured, so closing the modal does not reopen it on the next render.
  const [searchParams, setSearchParams] = useSearchParams();
  const wantsRegister = searchParams.get('register') === '1';
  useEffect(() => {
    if (!wantsRegister) return;
    setEditingFacility(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setFormStep(1);
    setShowFormModal(true);
    setSearchParams({}, { replace: true });
  }, [wantsRegister, setSearchParams]);

  const openEditModal = (facility: Facility) => {
    setEditingFacility(facility);
    setFormData(toFacilityFormData(facility));
    setFormErrors({});
    setFormStep(1);
    setShowFormModal(true);
    setActiveMenu(null);
  };

  const handleClearForm = () => {
    setFormData(editingFacility ? toFacilityFormData(editingFacility) : INITIAL_FORM);
    setFormErrors({});
    setFormStep(1);
  };

  const openDetailModal = (facility: Facility) => {
    setDetailFacility(facility);
    setShowDetailModal(true);
    setActiveMenu(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Facility name is required';
    if (!formData.type) errors.type = 'Facility type is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Invalid email address';
    }
    if (formData.logo && !/^https?:\/\/\S+$/i.test(formData.logo.trim())) {
      errors.logo = 'Logo must be a full http(s) URL';
    }
    if (!editingFacility && formData.createAdmin) {
      if (formData.adminFullName.trim().length < 5) {
        errors.adminFullName = 'Admin name must be at least 5 characters';
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail.trim())) {
        errors.adminEmail = 'A valid admin email is required';
      }
      if (formData.adminPhone.trim() && !/^0\d{9}$/.test(formData.adminPhone.trim())) {
        errors.adminPhone = 'Use the national format, e.g. 0788123456';
      }
      if (formData.adminNationalId.trim() && !/^1\d{15}$/.test(formData.adminNationalId.trim())) {
        errors.adminNationalId = 'National ID is 16 digits starting with 1';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    createMutation.mutate(formData);
  };

  /**
   * Step 1 owns the facility itself; step 2 the subscription and the first admin. Each gates
   * only itself, so "Continue" is never blocked by a field the user has not reached yet. The
   * regexes mirror `validateForm` — here they keep the buttons honest, there they surface text.
   */
  const detailsValid =
    formData.name.trim() !== '' &&
    (!formData.email.trim() ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) &&
    (!formData.logo.trim() || /^https?:\/\/\S+$/i.test(formData.logo.trim()));

  const adminDetailsValid =
    !formData.createAdmin ||
    (formData.adminFullName.trim().length >= 5 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail.trim()) &&
      (!formData.adminPhone.trim() || /^0\d{9}$/.test(formData.adminPhone.trim())) &&
      (!formData.adminNationalId.trim() || /^1\d{15}$/.test(formData.adminNationalId.trim())));

  const canRegister = detailsValid && adminDetailsValid;

  const handleStatusChange = (id: string, action: 'activate' | 'deactivate') => {
    statusMutation.mutate({ id, action });
    setActiveMenu(null);
  };

  const getStatusBadge = (facility: Facility) => {
    const isDeleted = Boolean(facility.deletedAt);
    const isSuspended = !facility.isActive || facility.subscriptionStatus === 'suspended';

    if (isDeleted) {
      return <span className={`${BADGE_BASE} ${neutralClasses}`}>Deleted</span>;
    }
    if (isSuspended) {
      return (
        <span
          className={`${BADGE_BASE} border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300`}
        >
          Suspended
        </span>
      );
    }
    if (facility.subscriptionStatus === 'trial') {
      return (
        <span
          className={`${BADGE_BASE} border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300`}
        >
          Trial
        </span>
      );
    }
    if (facility.subscriptionStatus === 'expired') {
      return (
        <span
          className={`${BADGE_BASE} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300`}
        >
          Expired
        </span>
      );
    }
    return (
      <span
        className={`${BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300`}
      >
        Active
      </span>
    );
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingFacility(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setFormStep(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner label={t('common.loading')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            {t('admin.facilities.title')}
          </h1>
          <p className="text-sm text-slate-500">{t('admin.facilities.subtitle')}</p>
        </div>
        <Button onClick={openCreateModal} icon={Plus}>
          Register Hospital
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <Building2 className="h-5 w-5 text-slate-700" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900 font-display">{totalFacilities}</p>
            <p className="text-xs text-slate-500">Total Hospitals</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <CheckCircle2 className="h-5 w-5 text-slate-700" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900 font-display">{activeFacilities}</p>
            <p className="text-xs text-slate-500">Active Hospitals</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <AlertCircle className="h-5 w-5 text-slate-700" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900 font-display">
              {suspendedFacilities}
            </p>
            <p className="text-xs text-slate-500">Suspended</p>
          </div>
        </Card>
      </div>

      {/* Facilities Table */}
      <Card padding={false}>
        <div className="border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search hospitals..."
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-text-main placeholder:text-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-primary/30"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchFilter('');
                    setCurrentPage(1);
                  }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select
              options={TYPE_OPTIONS}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by hospital type"
              className="sm:w-40"
            />
            <Select
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by subscription status"
              className="sm:w-40"
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={resetFilters}>
                Reset
              </Button>
            )}
          </div>

          <p className="mt-3 text-xs text-text-muted dark:text-slate-400">
            <span className="font-semibold text-text-main dark:text-slate-200">
              {filtered.length}
            </span>{' '}
            {filtered.length === 1 ? 'hospital' : 'hospitals'}
            {hasFilters && <span className="ml-1">match the current filters</span>}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left dark:border-slate-800 dark:bg-slate-900/40">
                {['Hospital', 'Location', 'Type', 'Admin', 'Subscription', 'Status'].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      {heading}
                    </th>
                  ),
                )}
                <th
                  scope="col"
                  className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {paginatedData.map((f) => {
                const admin = admins.find((a) => a.facilityId === f._id);
                const contact = f.contactInfo?.phone || f.contactInfo?.email || null;
                return (
                  <tr
                    key={f._id}
                    className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {f.logo ? (
                          <img
                            src={f.logo}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-xl border border-slate-100 object-cover ring-2 ring-white shadow-sm dark:ring-slate-900"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 ring-2 ring-white shadow-sm dark:bg-primary-500/10 dark:ring-slate-900">
                            <Building2 className="h-5 w-5 text-primary-600 dark:text-primary-300" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-text-main dark:text-slate-100">
                            {f.name}
                          </p>
                          <p className="truncate text-xs text-text-muted dark:text-slate-400">
                            {contact ?? 'No contact on file'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                        <span className="truncate text-xs">
                          {[f.region, f.district].filter(Boolean).join(', ') || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`${BADGE_BASE} ${neutralClasses} capitalize`}
                      >
                        {f.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {admin ? (
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {admin.fullName}
                        </span>
                      ) : (
                        <span
                          className={`${BADGE_BASE} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300`}
                        >
                          <AlertCircle className="h-3 w-3" />
                          No admin yet
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {f.subscriptionStatus ? (
                        <span className="inline-flex items-center gap-2 text-xs capitalize text-slate-600 dark:text-slate-300">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              subscriptionDot[f.subscriptionStatus] ?? 'bg-slate-400'
                            }`}
                          />
                          {f.subscriptionStatus}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">{getStatusBadge(f)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="relative inline-block">
                        <button
                          type="button"
                          aria-label={`Actions for ${f.name}`}
                          aria-haspopup="menu"
                          aria-expanded={activeMenu === f._id}
                          title="More actions"
                          onClick={() =>
                            setActiveMenu(activeMenu === f._id ? null : f._id)
                          }
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-slate-500 dark:hover:bg-slate-700"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {activeMenu === f._id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setActiveMenu(null)}
                            />
                            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-dropdown dark:border-slate-700 dark:bg-slate-900">
                              <button
                                onClick={() => openDetailModal(f)}
                                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <Eye className="h-4 w-4 text-slate-400" />
                                View Details
                              </button>
                              <button
                                onClick={() => openEditModal(f)}
                                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <Pencil className="h-4 w-4 text-slate-400" />
                                Edit Hospital
                              </button>
                              <button
                                onClick={() => {
                                  setSubscriptionTarget(f);
                                  setSubscriptionChoice('');
                                  setShowSubscriptionModal(true);
                                  setActiveMenu(null);
                                }}
                                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <ShieldCheck className="h-4 w-4 text-slate-400" />
                                Set Subscription
                              </button>
                              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                              {f.isActive ? (
                                <button
                                  onClick={() => handleStatusChange(f._id, 'deactivate')}
                                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                                >
                                  <ToggleLeft className="h-4 w-4" />
                                  Suspend Hospital
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStatusChange(f._id, 'activate')}
                                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                                >
                                  <ToggleRight className="h-4 w-4" />
                                  Reactivate Hospital
                                </button>
                              )}
                              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                              <button
                                onClick={() => {
                                  setConfirmDelete(f);
                                  setActiveMenu(null);
                                }}
                                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete Hospital
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                      <Building2 className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                    </span>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {hasFilters ? 'No hospitals match your filters' : 'No hospitals registered yet'}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                      {hasFilters
                        ? 'Try a different search term, or clear the filters to see every hospital.'
                        : 'Register your first hospital to start onboarding its staff and patients.'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {hasFilters && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={RotateCcw}
                          onClick={resetFilters}
                        >
                          Reset filters
                        </Button>
                      )}
                      <Button size="sm" icon={Plus} onClick={openCreateModal}>
                        Register Hospital
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-muted dark:text-slate-400">
            {filtered.length === 0 ? (
              'No hospitals to show'
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
                {filtered.length === 1 ? 'hospital' : 'hospitals'}
              </>
            )}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageWindow(currentPage, totalPages).map((page, index) =>
                page === 'gap' ? (
                  <span
                    key={`gap-${index}`}
                    aria-hidden="true"
                    className="px-1 text-xs text-slate-400"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    aria-label={`Page ${page}`}
                    aria-current={page === currentPage ? 'page' : undefined}
                    onClick={() => setCurrentPage(page)}
                    className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                      page === currentPage
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {page}
                  </button>
                ),
              )}
              <button
                type="button"
                aria-label="Next page"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Temporary password handover — shown once, never re-fetchable */}
      <Modal
        open={Boolean(credentials)}
        onClose={() => setCredentials(null)}
        title="Hospital registered"
        width="md"
      >
        {credentials && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="text-sm text-amber-800">
                Copy the temporary password now. It is shown only once and cannot be
                retrieved later — the new admin must change it at first sign-in.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Hospital
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {credentials.facility.name}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Admin account
              </p>
              <p className="mt-1 font-medium text-slate-900">{credentials.admin.fullName}</p>
              <p className="text-sm text-slate-500">{credentials.admin.email}</p>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                Temporary password
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all rounded-lg bg-slate-900 px-4 py-3 font-mono text-base tracking-wide text-white">
                  {credentials.temporaryPassword}
                </code>
                <Button
                  variant="outline"
                  icon={copied ? Check : Copy}
                  onClick={() => {
                    void navigator.clipboard?.writeText(credentials.temporaryPassword);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
              <Button onClick={() => setCredentials(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Subscription modal */}
      <Modal
        open={showSubscriptionModal}
        onClose={() => {
          setShowSubscriptionModal(false);
          setSubscriptionTarget(null);
        }}
        title="Set subscription"
        width="sm"
        density="compact"
        footer={
          subscriptionTarget ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setShowSubscriptionModal(false);
                  setSubscriptionTarget(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                disabled={!subscriptionChoice}
                loading={subscriptionMutation.isPending}
                onClick={() =>
                  subscriptionTarget &&
                  subscriptionMutation.mutate({
                    id: subscriptionTarget._id,
                    status: subscriptionChoice as SubscriptionStatus,
                  })
                }
              >
                Save Subscription
              </Button>
            </>
          ) : undefined
        }
      >
        {subscriptionTarget && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              {subscriptionTarget.name} is currently{' '}
              <span className="font-medium capitalize text-slate-700">
                {subscriptionTarget.subscriptionStatus ?? 'unset'}
              </span>
              .
            </p>
            <Select
              label="Subscription status"
              options={SUBSCRIPTION_OPTIONS}
              value={subscriptionChoice}
              onChange={(e) =>
                setSubscriptionChoice(e.target.value as '' | SubscriptionStatus)
              }
            />
            <p className="text-xs text-slate-500">
              Suspending a subscription also deactivates the hospital, and its staff cannot
              sign in until it is restored.
            </p>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete hospital"
        width="sm"
      >
        {confirmDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
              <p className="text-sm text-red-800">
                Deleting <span className="font-semibold">{confirmDelete.name}</span> suspends
                every staff account at this hospital. Patient, appointment and payment records
                are retained, and the hospital can be restored afterwards.
              </p>
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDelete._id)}
              >
                Delete Hospital
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Register / Edit Modal */}
      <Modal
        open={showFormModal}
        onClose={closeFormModal}
        title={editingFacility ? 'Edit Hospital' : 'Register New Hospital'}
        width="xl"
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={handleClearForm}>
              Clear
            </Button>
            <Button variant="outline" onClick={closeFormModal}>
              {t('common.cancel')}
            </Button>
            {editingFacility ? (
              <Button
                onClick={handleSubmit}
                loading={createMutation.isPending}
                disabled={!formData.name.trim()}
              >
                Save Changes
              </Button>
            ) : formStep === 1 ? (
              <Button icon={ArrowRight} disabled={!detailsValid} onClick={() => setFormStep(2)}>
                Continue
              </Button>
            ) : (
              <>
                <Button variant="outline" icon={ArrowLeft} onClick={() => setFormStep(1)}>
                  Back
                </Button>
                <Button
                  icon={Plus}
                  loading={createMutation.isPending}
                  disabled={!canRegister}
                  onClick={handleSubmit}
                >
                  Register Hospital
                </Button>
              </>
            )}
          </>
        }
      >
        <div className="space-y-3">
          {!editingFacility && (
            <>
              <StepIndicator
                current={formStep}
                steps={['Details', 'Admin & Subscription']}
                onSelect={(n) => {
                  // Backwards only: a half-filled step must not be skipped past.
                  if (n < formStep) setFormStep(n === 1 ? 1 : 2);
                }}
              />
              <p className="text-xs text-slate-600">
                {formStep === 1
                  ? "The facility's identity, contact details and location."
                  : 'The commercial status and who runs the hospital. A temporary password is shown once after saving.'}
              </p>
            </>
          )}

          {(editingFacility || formStep === 1) && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Input
                  label="Hospital Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  error={formErrors.name}
                  icon={Building2}
                  placeholder="e.g. Kigali Central Hospital"
                  wrapperClassName="xl:col-span-2"
                />
                <Select
                  label="Hospital Type"
                  options={TYPE_OPTIONS}
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as Facility['type'] })
                  }
                  error={formErrors.type}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Input
                  label="Address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  icon={MapPin}
                  placeholder="Street address"
                  wrapperClassName="xl:col-span-2"
                />
                <Input
                  label="District"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  placeholder="e.g. Gasabo"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Input
                  label="Province"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="e.g. Kigali City"
                />
                <Input
                  label="Contact Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  icon={Phone}
                  placeholder="0788123456"
                />
                <Input
                  label="Contact Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  icon={Mail}
                  error={formErrors.email}
                  placeholder="info@facility.rw"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Input
                  label="Logo URL"
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  icon={ImageIcon}
                  error={formErrors.logo}
                  placeholder="https://cdn.example.org/logo.png"
                  wrapperClassName="xl:col-span-2"
                />
              </div>
            </>
          )}

          {!editingFacility && formStep === 2 && (
            <>
              <Select
                label="Subscription Status"
                options={SUBSCRIPTION_OPTIONS}
                value={formData.subscriptionStatus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    subscriptionStatus: e.target.value as '' | SubscriptionStatus,
                  })
                }
              />

              {/* First admin provisioning — creation only */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={formData.createAdmin}
                    onChange={(e) =>
                      setFormData({ ...formData, createAdmin: e.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-900">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-primary-600" />
                      Create the first hospital admin now
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      A temporary password is generated and shown once after saving.
                    </span>
                  </span>
                </label>

                {formData.createAdmin && (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Input
                      label="Admin Full Name"
                      value={formData.adminFullName}
                      onChange={(e) =>
                        setFormData({ ...formData, adminFullName: e.target.value })
                      }
                      error={formErrors.adminFullName}
                      placeholder="e.g. Alice Mukamana"
                    />
                    <Input
                      label="Admin Email"
                      type="email"
                      value={formData.adminEmail}
                      onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                      error={formErrors.adminEmail}
                      placeholder="admin@facility.rw"
                    />
                    <Input
                      label="Admin Phone"
                      value={formData.adminPhone}
                      onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                      error={formErrors.adminPhone}
                      placeholder="0788123456"
                    />
                    <Input
                      label="Admin National ID"
                      value={formData.adminNationalId}
                      onChange={(e) =>
                        setFormData({ ...formData, adminNationalId: e.target.value })
                      }
                      error={formErrors.adminNationalId}
                      placeholder="1199900011111111"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Facility Detail Modal */}
      <Modal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailFacility(null);
        }}
        title="Hospital Details"
        width="md"
      >
        {detailFacility && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              {detailFacility.logo ? (
                <img
                  src={detailFacility.logo}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl border border-slate-100 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                  <Building2 className="h-7 w-7 text-primary-600" />
                </span>
              )}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 font-display">
                  {detailFacility.name}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {getStatusBadge(detailFacility)}
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 capitalize">
                    {detailFacility.type.replace(/_/g, ' ')}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600">
                    {detailFacility.subscriptionStatus ?? 'no subscription'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs font-medium text-slate-500">Location</p>
                <p className="mt-1 text-sm text-slate-900">
                  {[detailFacility.region, detailFacility.district].filter(Boolean).join(', ') ||
                    '—'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs font-medium text-slate-500">Phone</p>
                <p className="mt-1 text-sm text-slate-900">
                  {detailFacility.contactInfo?.phone ?? '—'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs font-medium text-slate-500">Email</p>
                <p className="mt-1 text-sm text-slate-900">
                  {detailFacility.contactInfo?.email ?? '—'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs font-medium text-slate-500">Hospital Admin</p>
                <p className="mt-1 text-sm text-slate-900">
                  {admins.find((a) => a.facilityId === detailFacility._id)?.fullName ??
                    'No admin yet'}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs font-medium text-slate-500">Address</p>
              <p className="mt-1 text-sm text-slate-900">{detailFacility.address ?? '—'}</p>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDetailModal(false);
                  setDetailFacility(null);
                }}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowDetailModal(false);
                  openEditModal(detailFacility);
                }}
                icon={Pencil}
              >
                Edit Hospital
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
