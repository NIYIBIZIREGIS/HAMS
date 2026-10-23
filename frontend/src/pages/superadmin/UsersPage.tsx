import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCog,
  Plus,
  Search,
  Building2,
  Mail,
  MoreVertical,
  ArrowRightLeft,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  Pencil,
  ShieldCheck,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { client, getErrorMessage } from '../../services/client';
import {
  listUsers,
  listFacilities,
  createStaffUser,
  updateUser,
  deleteUser,
  type StaffUser,
  type Facility,
} from '../../services/api';
import { toast } from '../../store/toastStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { StepIndicator } from '../../components/ui/StepIndicator';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Spinner } from '../../components/ui/Spinner';
import { UserAvatar } from '../../components/ui/UserAvatar';

const ITEMS_PER_PAGE = 8;

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  facility_admin: 'Facility Admin',
  receptionist: 'Receptionist',
  doctor: 'Doctor',
  nurse: 'Nurse',
  lab_technician: 'Lab Technician',
  pharmacist: 'Pharmacist',
  insurance_verifier: 'Insurance Verifier',
  auditor: 'Auditor',
};

const roleBadgeStyles: Record<string, string> = {
  super_admin: 'bg-slate-800 text-white border-slate-800',
  facility_admin: 'bg-blue-50 text-blue-700 border-blue-200',
  receptionist: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  doctor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  nurse: 'bg-rose-50 text-rose-700 border-rose-200',
  lab_technician: 'bg-purple-50 text-purple-700 border-purple-200',
  pharmacist: 'bg-amber-50 text-amber-700 border-amber-200',
  insurance_verifier: 'bg-teal-50 text-teal-700 border-teal-200',
  auditor: 'bg-slate-100 text-slate-700 border-slate-200',
};

const roleOptions = [
  { value: 'facility_admin', label: 'Facility Admin' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'lab_technician', label: 'Lab Technician' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'insurance_verifier', label: 'Insurance Verifier' },
  { value: 'auditor', label: 'Auditor' },
];

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  role: 'facility_admin',
  facilityId: '',
};

export function UsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [removing, setRemoving] = useState<StaffUser | null>(null);
  const [reassignUser, setReassignUser] = useState<StaffUser | null>(null);
  const [reassignFacility, setReassignFacility] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editStep, setEditStep] = useState(1);

  const { data: users, isLoading: usersLoading } = useQuery<StaffUser[]>({
    queryKey: ['users'],
    queryFn: listUsers,
  });

  const { data: facilities, isLoading: facilitiesLoading } = useQuery<Facility[]>({
    queryKey: ['facilities'],
    queryFn: listFacilities,
  });

  const facilityName = (facilityId?: string | null) => {
    if (!facilityId) return null;
    return (facilities ?? []).find((f) => f._id === facilityId)?.name ?? '—';
  };

  const filtered = useMemo(() => {
    if (!searchFilter) return users ?? [];
    const q = searchFilter.toLowerCase();
    return (users ?? []).filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        roleLabels[u.role]?.toLowerCase().includes(q),
    );
  }, [users, searchFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const showFeedback = (type: 'success' | 'error', message: string) => {
    if (type === 'success') toast.success(message);
    else toast.error(message);
  };

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      createStaffUser({
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone || undefined,
        password: payload.password,
        role: payload.role,
        facilityId: payload.facilityId || undefined,
      }),
    onSuccess: () => {
      toast.success('User account created successfully.', 'User created');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
    onError: (err) => {
      showFeedback('error', getErrorMessage(err));
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<StaffUser> }) =>
      updateUser(id, payload),
    onSuccess: () => {
      toast.success('User updated successfully.', 'User updated');
      setShowEdit(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      showFeedback('error', getErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      toast.success('User deactivated.', 'User removed');
      setShowDelete(false);
      setRemoving(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      showFeedback('error', getErrorMessage(err));
    },
  });

  const reassignMutation = useMutation({
    mutationFn: ({
      adminId,
      newFacilityId,
    }: {
      adminId: string;
      newFacilityId: string;
    }) => client.put('/admin/reassign-facility', { adminId, newFacilityId }),
    onSuccess: () => {
      toast.success('User reassigned to facility successfully.', 'Facility updated');
      setShowReassign(false);
      setReassignUser(null);
      setReassignFacility('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      showFeedback('error', getErrorMessage(err));
    },
  });

  const openEdit = (user: StaffUser) => {
    setEditing({ ...user, facilityId: user.facilityId ?? '' });
    setEditStep(1);
    setShowEdit(true);
    setActiveMenu(null);
  };

  const openDelete = (user: StaffUser) => {
    setRemoving(user);
    setShowDelete(true);
    setActiveMenu(null);
  };

  const openReassign = (user: StaffUser) => {
    setReassignUser(user);
    setReassignFacility(user.facilityId ?? '');
    setShowReassign(true);
    setActiveMenu(null);
  };

  const activeCount = (users ?? []).filter((u) => u.status !== 'inactive').length;

  const isLoading = usersLoading || facilitiesLoading;

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
          <h1 className="text-2xl font-bold text-slate-900 font-display dark:text-white">
            Users
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create and manage system users, assign roles and facilities
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} icon={Plus}>
          Create User
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50">
            <Users className="h-5 w-5 text-primary" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900 font-display dark:text-white">
              {users?.length ?? 0}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Users</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-status-confirmed-bg">
            <ShieldCheck className="h-5 w-5 text-status-confirmed-text" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900 font-display dark:text-white">
              {activeCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Active Users</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <Building2 className="h-5 w-5 text-slate-700" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900 font-display dark:text-white">
              {(users ?? []).filter((u) => u.facilityId).length}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Assigned to Facilities</p>
          </div>
        </Card>
      </div>

      {/* Users Table */}
      <Card padding={false}>
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search users by name, email, phone or role..."
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-800">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Facility</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {paginated.map((user) => (
                <tr
                  key={user._id}
                  className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.fullName} imageUrl={user.profileImageUrl} size="md" />
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {user.fullName}
                        </p>
                        <p className="text-xs text-slate-400">{user.phone ?? ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="text-xs">{user.email ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        roleBadgeStyles[user.role] ??
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {roleLabels[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {user.facilityId ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-primary-500" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {facilityName(user.facilityId)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        user.status === 'inactive'
                          ? 'border-status-cancelled-bg bg-status-cancelled-bg text-status-cancelled-text'
                          : 'border-status-confirmed-bg bg-status-confirmed-bg text-status-confirmed-text'
                      }`}
                    >
                      {user.status === 'inactive' ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() =>
                          setActiveMenu(
                            activeMenu === user._id ? null : user._id,
                          )
                        }
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        aria-label="Actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {activeMenu === user._id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setActiveMenu(null)}
                          />
                          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-dropdown dark:border-slate-700 dark:bg-slate-800">
                            <button
                              onClick={() => openEdit(user)}
                              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <Pencil className="h-4 w-4 text-slate-400" />
                              Edit User
                            </button>
                            {user.facilityId && (
                              <>
                                <button
                                  onClick={() => openReassign(user)}
                                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                                >
                                  <ArrowRightLeft className="h-4 w-4 text-slate-400" />
                                  Reassign Facility
                                </button>
                                <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                              </>
                            )}
                            <button
                              onClick={() => openDelete(user)}
                              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="h-4 w-4" />
                              Deactivate User
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <UserCog className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                    <p className="text-sm text-slate-500">No users found</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Create a user to get started
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}{' '}
              users
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                    page === currentPage
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Create User Modal */}
      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setForm(EMPTY_FORM);
        }}
        title="Create User"
        width="lg"
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={() => setForm(EMPTY_FORM)}>
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setForm(EMPTY_FORM);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!form.fullName || !form.email || !form.password}
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate(form)}
              icon={Plus}
            >
              Create User
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Create a new system user. Optionally assign them to a facility immediately.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Full name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
              autoComplete="off"
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
            />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              hint="At least 6 chars with a letter, number and symbol."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Role"
              options={roleOptions}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            />
            <Select
              label="Facility (optional)"
              options={[
                { value: '', label: '— No facility —' },
                ...(facilities ?? [])
                  .filter((f) => f.isActive)
                  .map((f) => ({ value: f._id, label: f.name })),
              ]}
              value={form.facilityId}
              onChange={(e) => setForm({ ...form, facilityId: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={showEdit}
        onClose={() => {
          setShowEdit(false);
          setEditing(null);
          setEditStep(1);
        }}
        title="Edit User"
        width="lg"
        density="compact"
        footer={
          editing ? (
            editStep === 1 ? (
              <>
                <Button
                  variant="ghost"
                  icon={RotateCcw}
                  onClick={() => {
                    const orig = users?.find((u) => u._id === editing._id);
                    if (orig) setEditing({ ...orig, facilityId: orig.facilityId ?? '' });
                  }}
                >
                  Clear
                </Button>
                <Button variant="outline" onClick={() => setShowEdit(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  icon={ArrowRight}
                  disabled={!editing.fullName.trim() || !editing.email?.trim()}
                  onClick={() => setEditStep(2)}
                >
                  Continue
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" icon={ArrowLeft} onClick={() => setEditStep(1)}>
                  Back
                </Button>
                <Button variant="outline" onClick={() => setShowEdit(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  icon={Pencil}
                  loading={editMutation.isPending}
                  onClick={() =>
                    editMutation.mutate({
                      id: editing._id,
                      payload: {
                        fullName: editing.fullName,
                        email: editing.email,
                        phone: editing.phone || undefined,
                        role: editing.role,
                        facilityId: editing.facilityId
                          ? (editing.facilityId as string)
                          : undefined,
                      },
                    })
                  }
                >
                  Save Changes
                </Button>
              </>
            )
          ) : undefined
        }
      >
        {editing ? (
          <div className="space-y-3">
            <StepIndicator
              current={editStep}
              steps={['Account', 'Role & Facility']}
              onSelect={(n) => {
                if (n < editStep) setEditStep(n === 1 ? 1 : 2);
              }}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {editStep === 1
                ? 'Update the name and contact details this user signs in with.'
                : 'Set what this user can do and which hospital they belong to.'}
            </p>

            {editStep === 1 ? (
              <div className="space-y-3">
                <Input
                  label="Full name"
                  value={editing.fullName}
                  onChange={(e) => setEditing({ ...editing, fullName: e.target.value })}
                />
                <Input
                  label="Email"
                  type="email"
                  value={editing.email ?? ''}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
                <Input
                  label="Phone"
                  value={editing.phone ?? ''}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <Select
                  label="Role"
                  options={roleOptions}
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                />
                <Select
                  label="Facility (optional)"
                  options={[
                    { value: '', label: '— No facility —' },
                    ...(facilities ?? [])
                      .filter((f) => f.isActive)
                      .map((f) => ({ value: f._id, label: f.name })),
                  ]}
                  value={editing.facilityId ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, facilityId: e.target.value || null })
                  }
                />
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">User not found</div>
        )}
      </Modal>

      {/* Reassign Facility Modal */}
      <Modal
        open={showReassign}
        onClose={() => {
          setShowReassign(false);
          setReassignUser(null);
          setReassignFacility('');
        }}
        title="Reassign Facility"
        density="compact"
        footer={
          <>
            <Button
              variant="ghost"
              icon={RotateCcw}
              onClick={() => setReassignFacility(reassignUser?.facilityId ?? '')}
            >
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowReassign(false);
                setReassignUser(null);
                setReassignFacility('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!reassignFacility}
              loading={reassignMutation.isPending}
              onClick={() =>
                reassignMutation.mutate({
                  adminId: reassignUser!._id,
                  newFacilityId: reassignFacility,
                })
              }
            >
              Confirm Reassignment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">User</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
              {reassignUser?.fullName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{reassignUser?.email}</p>
          </div>

          <Select
            label="New Facility"
            options={[
              { value: '', label: '— Select new facility —' },
              ...(facilities ?? [])
                .filter((f) => f.isActive)
                .map((f) => ({ value: f._id, label: f.name })),
            ]}
            value={reassignFacility}
            onChange={(e) => setReassignFacility(e.target.value)}
          />
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => {
          setShowDelete(false);
          setRemoving(null);
        }}
        onConfirm={() => removing && deleteMutation.mutate(removing._id)}
        title="Deactivate user?"
        message={
          removing
            ? `${removing.fullName} (${removing.email ?? 'no email'}) will be deactivated and lose system access. This can be reversed later.`
            : ''
        }
        confirmLabel="Deactivate"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}