import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  Filter,
  Mail,
  Phone,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { StepIndicator } from '../../components/ui/StepIndicator';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';
import {
  client,
  getErrorMessage,
} from '../../services/client';
import {
  listFacilityStaff,
  createStaffUser,
  type StaffUser,
} from '../../services/api';
import { toast } from '../../store/toastStore';

interface StaffFormData {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  password: string;
}

const roleBadgeStyles: Record<string, string> = {
  facility_admin: 'bg-blue-50 text-blue-700 border-blue-200',
  receptionist: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  nurse: 'bg-rose-50 text-rose-700 border-rose-200',
  lab_technician: 'bg-purple-50 text-purple-700 border-purple-200',
  pharmacist: 'bg-amber-50 text-amber-700 border-amber-200',
  insurance_verifier: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  auditor: 'bg-slate-100 text-slate-700 border-slate-200',
};

const roleLabels: Record<string, string> = {
  facility_admin: 'Facility Admin',
  receptionist: 'Receptionist',
  nurse: 'Nurse',
  lab_technician: 'Lab Technician',
  pharmacist: 'Pharmacist',
  insurance_verifier: 'Insurance Verifier',
  auditor: 'Auditor',
};

const roleOptions = [
  { value: 'nurse', label: 'Nurse' },
  { value: 'lab_technician', label: 'Lab Technician' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'insurance_verifier', label: 'Insurance Verifier' },
  { value: 'auditor', label: 'Auditor' },
];

const EMPTY_FORM: StaffFormData = {
  fullName: '',
  email: '',
  phone: '',
  role: '',
  password: '',
};

function toStaffFormData(s: StaffUser): StaffFormData {
  return {
    fullName: s.fullName,
    email: s.email ?? '',
    phone: s.phone ?? '',
    role: s.role,
    password: '',
  };
}

export default function StaffManagement() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId as string | undefined;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [deactivatingStaff, setDeactivatingStaff] = useState<StaffUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof StaffFormData, string>>>({});
  const [formData, setFormData] = useState<StaffFormData>(EMPTY_FORM);
  const [formStep, setFormStep] = useState<1 | 2>(1);

  const { data: staff, isLoading } = useQuery<StaffUser[]>({
    queryKey: ['facility-staff', facilityId],
    queryFn: () => listFacilityStaff(facilityId!),
    enabled: Boolean(facilityId),
  });

  const rolesInUse = useMemo(() => {
    const roles = new Set<string>();
    (staff ?? []).forEach((s) => roles.add(s.role));
    return Array.from(roles);
  }, [staff]);

  const filteredStaff = useMemo(() => {
    return (staff ?? []).filter((s) => {
      const matchesSearch =
        !search ||
        s.fullName.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase()) ||
        s.phone?.includes(search);
      const matchesRole = activeTab === 'all' || s.role === activeTab;
      const matchesStatus = !statusFilter || s.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staff, search, activeTab, statusFilter]);

  const tabs = useMemo(() => {
    const keys = ['all', ...rolesInUse];
    return keys.map((key) => ({
      key,
      label: key === 'all' ? 'All' : roleLabels[key] || key,
    }));
  }, [rolesInUse]);

  const invalidateStaff = () =>
    queryClient.invalidateQueries({ queryKey: ['facility-staff', facilityId] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingStaff) {
        await client.put(`/users/${editingStaff._id}`, {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone || undefined,
          role: formData.role,
        });
      } else {
        await createStaffUser({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone || undefined,
          password: formData.password,
          role: formData.role,
          facilityId,
        });
      }
    },
    onSuccess: () => {
      toast.success(
        editingStaff ? 'Staff member updated successfully.' : 'Staff member added successfully.',
        'Staff saved',
      );
      setIsFormModalOpen(false);
      setEditingStaff(null);
      invalidateStaff();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => client.put(`/users/${id}`, { status: 'inactive' }),
    onSuccess: () => {
      toast.success('Staff member deactivated.', 'Staff deactivated');
      setIsDeactivateModalOpen(false);
      setDeactivatingStaff(null);
      invalidateStaff();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  /**
   * Editing keeps a single step: the password is not shown, so there is only ever one screen
   * worth of fields. Adding splits into identity then credentials, which is where a five-field
   * form stops being a quick add and starts being a form to think about.
   */
  const validateIdentity = (): boolean => {
    const newErrors: Partial<Record<keyof StaffFormData, string>> = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.role) newErrors.role = 'Role is required';
    // Only report what this step actually owns, so Continue is not blocked by the password.
    // The password belongs to step two, so it is withheld here rather than reported against a
// field the user cannot see yet.
    const { password: _p, ...visible } = newErrors;
    setErrors(visible as Partial<Record<keyof StaffFormData, string>>);
    return Object.keys(visible).length === 0;
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof StaffFormData, string>> = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.role) newErrors.role = 'Role is required';
    if (!editingStaff && formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Submit from step two. The identity fields are no longer on screen, so re-reporting their
   * errors would leave the user stuck on a step they cannot fix: a red "Role is required" with
   * no role select visible, and no way back except the Back button. Identity problems are
   * caught by `validateIdentity` before the step is ever left, so only the password is judged
   * here — and if identity somehow went bad, the user is returned to the step that owns it.
   */
  const submitFromCredentialsStep = (): boolean => {
    const identityErrors: Partial<Record<keyof StaffFormData, string>> = {};
    if (!formData.fullName.trim()) identityErrors.fullName = 'Full name is required';
    if (!formData.email.trim()) identityErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) identityErrors.email = 'Invalid email format';
    if (!formData.role) identityErrors.role = 'Role is required';

    if (Object.keys(identityErrors).length) {
      setErrors(identityErrors);
      setFormStep(1);
      return false;
    }

    return validate();
  };

  const openCreateModal = () => {
    setEditingStaff(null);
    setFormData({ fullName: '', email: '', phone: '', role: '', password: '' });
    setErrors({});
    setFormStep(1);
    setIsFormModalOpen(true);
  };

  const openEditModal = (s: StaffUser) => {
    setEditingStaff(s);
    setFormStep(1);
    setFormData({
      fullName: s.fullName,
      email: s.email ?? '',
      phone: s.phone ?? '',
      role: s.role,
      password: '',
    });
    setErrors({});
    setIsFormModalOpen(true);
  };

  const filterStatusOptions = [
    { value: '', label: 'All Statuses' },
    ...(['active', 'inactive', 'suspended'] as const).map((s) => ({ value: s, label: s })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">
            {t('admin.staffManagement', 'Staff Management')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage nurses, lab, pharmacy, verification and reception staff in your facility
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openCreateModal}>
          Add Staff
        </Button>
      </div>

      <Card>
        <div className="border-b border-slate-100 px-5 pt-4">
          <div className="flex gap-1 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-primary text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              icon={Search}
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <Select
              options={filterStatusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-40"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 font-medium text-slate-600">Name</th>
                <th className="px-5 py-3 font-medium text-slate-600">Role</th>
                <th className="px-5 py-3 font-medium text-slate-600">Email</th>
                <th className="px-5 py-3 font-medium text-slate-600">Phone</th>
                <th className="px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="px-5 py-3 font-medium text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <Users className="mx-auto mb-2 h-8 w-8" />
                    <p>No staff members found</p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-navy-900">{s.fullName}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          roleBadgeStyles[s.role] || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {roleLabels[s.role] || s.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{s.email || '—'}</td>
                    <td className="px-5 py-4 text-slate-600">{s.phone || '—'}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          s.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Pencil}
                          onClick={() => openEditModal(s)}
                          aria-label="Edit staff"
                        />
                        {s.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => {
                              setDeactivatingStaff(s);
                              setIsDeactivateModalOpen(true);
                            }}
                            className="text-red-500 hover:text-red-700"
                            aria-label="Deactivate staff"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <p className="text-sm text-slate-500">
            Showing {filteredStaff.length} of {staff?.length ?? 0} staff members
          </p>
        </div>
      </Card>

      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
        density="compact"
        footer={
          <>
            <Button
              variant="ghost"
              icon={RotateCcw}
              onClick={() => {
                setFormData(editingStaff ? toStaffFormData(editingStaff) : EMPTY_FORM);
                setErrors({});
                setFormStep(1);
              }}
            >
              Clear
            </Button>
            <Button variant="ghost" onClick={() => setIsFormModalOpen(false)}>
              Cancel
            </Button>
            {!editingStaff && formStep === 1 && (
              <Button
                variant="primary"
                icon={ArrowRight}
                onClick={() => {
                  if (!validateIdentity()) return;
                  setFormStep(2);
                }}
              >
                Continue
              </Button>
            )}
            {(!editingStaff && formStep === 2) || editingStaff ? (
              <>
                {!editingStaff && (
                  <Button variant="outline" icon={ArrowLeft} onClick={() => setFormStep(1)}>
                    Back
                  </Button>
                )}
                <Button
                  variant="primary"
                  loading={saveMutation.isPending || submitting}
                  onClick={() => {
                    const isTwoStepSubmit = !editingStaff && formStep === 2;
                    const ok = isTwoStepSubmit ? submitFromCredentialsStep() : validate();
                    if (!ok) return;
                    setSubmitting(true);
                    saveMutation.mutate(undefined, { onSettled: () => setSubmitting(false) });
                  }}
                >
                  {editingStaff ? 'Save Changes' : 'Add Staff Member'}
                </Button>
              </>
            ) : null}
          </>
        }
      >
        <div className="space-y-3">
          {!editingStaff && (
            <StepIndicator
              current={formStep}
              steps={['Identity', 'Credentials']}
              onSelect={(n) => {
                // Backwards only: a half-filled step must not be skipped past.
                if (n < formStep) setFormStep(n === 1 ? 1 : 2);
              }}
            />
          )}

          {(editingStaff || formStep === 1) && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Full Name"
                  placeholder="Jane Smith"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  error={errors.fullName}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="staff@example.com"
                  icon={Mail}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={errors.email}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Phone"
                  placeholder="+250 788 000 000"
                  icon={Phone}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Select
                  label="Role"
                  options={roleOptions}
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                />
              </div>
              {errors.role && <p className="text-xs text-red-500">{errors.role}</p>}
            </>
          )}

          {!editingStaff && formStep === 2 && (
            <>
              <p className="text-xs text-slate-600">
                The sign-in credentials for this staff account. They will use these to reach the
                system.
              </p>
              <Input
                label="Password"
                type="password"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                error={errors.password}
                hint="At least 6 chars with a letter, number and symbol."
                autoComplete="new-password"
              />
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        title="Deactivate Staff Member"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to deactivate{' '}
            <strong>{deactivatingStaff?.fullName}</strong>? They will no longer have access to the
            system.
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsDeactivateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate(deactivatingStaff!._id)}
            >
              Deactivate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}