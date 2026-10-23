import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  UserCog,
  Plus,
  Search,
  Building2,
  Mail,
  Clock,
  MoreVertical,
  ArrowRightLeft,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Users,
  Activity,
  UserPlus,
  RotateCcw,
} from 'lucide-react';
import { client, getErrorMessage } from '../../services/client';
import { listUsers, listFacilities, createStaffUser, type StaffUser, type Facility } from '../../services/api';
import { toast } from '../../store/toastStore';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';

interface AdminAssignment {
  _id: string;
  admin: StaffUser;
  facility: Facility | null;
  assignedAt: string;
  lastActive?: string;
  status: string;
}

const ITEMS_PER_PAGE = 8;

const EMPTY_REG_FORM = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  facilityId: '',
};

export function FacilityAdminsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<string>('');
  const [selectedFacility, setSelectedFacility] = useState<string>('');
  const [reassignAdmin, setReassignAdmin] = useState<StaffUser | null>(null);
  const [removeAdmin, setRemoveAdmin] = useState<StaffUser | null>(null);

  const [regForm, setRegForm] = useState(EMPTY_REG_FORM);

  const { data: users, isLoading: usersLoading } = useQuery<StaffUser[]>({
    queryKey: ['users'],
    queryFn: listUsers,
  });

  const { data: facilities, isLoading: facilitiesLoading } = useQuery<Facility[]>({
    queryKey: ['facilities'],
    queryFn: listFacilities,
  });

  const isLoading = usersLoading || facilitiesLoading;

  const facilityAdmins = useMemo(() => {
    const admins = (users ?? []).filter((u) => u.role === 'facility_admin');
    return admins.map((admin) => {
      const facility = (facilities ?? []).find((f) => f._id === admin.facilityId) ?? null;
      return {
        _id: admin._id,
        admin,
        facility,
        assignedAt: (admin as any).createdAt ?? new Date().toISOString(),
        lastActive: (admin as any).lastActive,
        status: admin.status ?? 'active',
      } as AdminAssignment;
    });
  }, [users, facilities]);

  const filtered = useMemo(() => {
    if (!searchFilter) return facilityAdmins;
    const q = searchFilter.toLowerCase();
    return facilityAdmins.filter(
      (a) =>
        a.admin.fullName.toLowerCase().includes(q) ||
        a.admin.email?.toLowerCase().includes(q) ||
        a.facility?.name.toLowerCase().includes(q),
    );
  }, [facilityAdmins, searchFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const unassignedAdmins = useMemo(
    () =>
      (users ?? []).filter(
        (u) => u.role === 'facility_admin' && !u.facilityId,
      ),
    [users],
  );

  const assignMutation = useMutation({
    mutationFn: ({ adminId, facilityId }: { adminId: string; facilityId: string }) =>
      client.post('/admin/assign-facility', { adminId, facilityId }),
    onSuccess: () => {
      toast.success('Admin assigned to facility successfully.');
      setShowAssignModal(false);
      setSelectedAdmin('');
      setSelectedFacility('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const reassignMutation = useMutation({
    mutationFn: ({ adminId, newFacilityId }: { adminId: string; newFacilityId: string }) =>
      client.put('/admin/reassign-facility', { adminId, newFacilityId }),
    onSuccess: () => {
      toast.success('Admin reassigned successfully.');
      setShowReassignModal(false);
      setReassignAdmin(null);
      setSelectedFacility('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (adminId: string) =>
      client.delete(`/admin/remove-facility/${adminId}`),
    onSuccess: () => {
      toast.success('Admin assignment removed.');
      setShowRemoveConfirm(false);
      setRemoveAdmin(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const registerAdminMutation = useMutation({
    mutationFn: (payload: {
      fullName: string;
      email: string;
      phone?: string;
      password: string;
      facilityId?: string;
    }) => createStaffUser({ ...payload, role: 'facility_admin' }),
    onSuccess: () => {
      toast.success('New facility admin account created successfully.', 'Admin registered');
      setShowRegisterModal(false);
      setRegForm(EMPTY_REG_FORM);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const openRegisterModal = () => {
    setRegForm(EMPTY_REG_FORM);
    setShowRegisterModal(true);
  };

  const openReassignModal = (admin: StaffUser) => {
    setReassignAdmin(admin);
    setSelectedFacility('');
    setShowReassignModal(true);
    setActiveMenu(null);
  };

  const openRemoveConfirm = (admin: StaffUser) => {
    setRemoveAdmin(admin);
    setShowRemoveConfirm(true);
    setActiveMenu(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
            Active
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-700 border-red-200">
            Inactive
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 border-slate-200">
            {status}
          </span>
        );
    }
  };

  const activeCount = facilityAdmins.filter((a) => a.status === 'active').length;
  const assignedCount = facilityAdmins.filter((a) => a.facility).length;

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
            Facility Administrators
          </h1>
          <p className="text-sm text-slate-500">
            Manage facility admin assignments and track administrator activity
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setShowAssignModal(true)} icon={Plus}>
            Assign Admin
          </Button>
          <Button variant="secondary" onClick={openRegisterModal} icon={UserPlus}>
            Register Admin
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <UserCog className="h-5 w-5 text-slate-700" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900 font-display">
              {facilityAdmins.length}
            </p>
            <p className="text-xs text-slate-500">Total Admins</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <ShieldCheck className="h-5 w-5 text-slate-700" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900 font-display">{activeCount}</p>
            <p className="text-xs text-slate-500">Active Admins</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <Building2 className="h-5 w-5 text-slate-700" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900 font-display">{assignedCount}</p>
            <p className="text-xs text-slate-500">Assigned to Facilities</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <Users className="h-5 w-5 text-slate-700" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900 font-display">
              {unassignedAdmins.length}
            </p>
            <p className="text-xs text-slate-500">Unassigned</p>
          </div>
        </Card>
      </div>

      {/* Admin Activity Summary */}
      <Card>
        <CardHeader title="Activity Summary" subtitle="Overview of administrator engagement" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-600">Avg. Sessions / Week</span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900 font-display">
              {facilityAdmins.length > 0 ? '14.2' : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-600">Avg. Response Time</span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900 font-display">
              {facilityAdmins.length > 0 ? '2.4 hrs' : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-600">Tasks Completed</span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900 font-display">
              {facilityAdmins.length > 0 ? '342' : '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* Admin Table */}
      <Card padding={false}>
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search administrators..."
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
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Admin Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Facility Assigned</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last Active</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedData.map((assignment) => (
                <tr
                  key={assignment._id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
                        {assignment.admin.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <div>
                        <p className="font-medium text-slate-900">
                          {assignment.admin.fullName}
                        </p>
                        <p className="text-xs text-slate-400">Facility Admin</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="text-xs">{assignment.admin.email ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {assignment.facility ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-primary-500" />
                        <span className="text-xs font-medium text-slate-700">
                          {assignment.facility.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {getStatusBadge(assignment.status)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="text-xs">
                        {assignment.lastActive
                          ? new Date(assignment.lastActive).toLocaleDateString()
                          : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() =>
                          setActiveMenu(
                            activeMenu === assignment._id ? null : assignment._id,
                          )
                        }
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {activeMenu === assignment._id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setActiveMenu(null)}
                          />
                          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-dropdown">
                            <button
                              onClick={() => openReassignModal(assignment.admin)}
                              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <ArrowRightLeft className="h-4 w-4 text-slate-400" />
                              Reassign Facility
                            </button>
                            <div className="my-1 border-t border-slate-100" />
                            <button
                              onClick={() => openRemoveConfirm(assignment.admin)}
                              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove Assignment
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <UserCog className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                    <p className="text-sm text-slate-500">No facility administrators found</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Assign an administrator to a facility to get started
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-500">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}{' '}
              admins
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
                      : 'text-slate-600 hover:bg-slate-100'
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

      {/* Register Admin Modal */}
      <Modal
        open={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title="Register Facility Admin"
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={() => setRegForm(EMPTY_REG_FORM)}>
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowRegisterModal(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!regForm.fullName || !regForm.email || !regForm.password}
              loading={registerAdminMutation.isPending}
              onClick={() =>
                registerAdminMutation.mutate({
                  fullName: regForm.fullName,
                  email: regForm.email,
                  phone: regForm.phone || undefined,
                  password: regForm.password,
                  facilityId: regForm.facilityId || undefined,
                })
              }
              icon={UserPlus}
            >
              Register Admin
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Create a new facility administrator account. The admin can optionally be
            assigned to a facility immediately.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Full name"
              name="regFullName"
              value={regForm.fullName}
              onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
              required
              autoComplete="off"
            />
            <Input
              label="Email"
              name="regEmail"
              type="email"
              value={regForm.email}
              onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Phone (optional)"
              name="regPhone"
              value={regForm.phone}
              onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
              autoComplete="tel"
            />
            <Input
              label="Password"
              name="regPassword"
              type="password"
              value={regForm.password}
              onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
              required
              minLength={6}
              autoComplete="new-password"
              hint="At least 6 chars with a letter, number and symbol."
            />
          </div>

          <Select
            label="Facility (optional)"
            options={[
              { value: '', label: '— No facility —' },
              ...(facilities ?? [])
                .filter((f) => f.isActive)
                .map((f) => ({ value: f._id, label: f.name })),
            ]}
            value={regForm.facilityId}
            onChange={(e) => setRegForm({ ...regForm, facilityId: e.target.value })}
          />
        </div>
      </Modal>

      {/* Assign Admin Modal */}
      <Modal
        open={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedAdmin('');
          setSelectedFacility('');
        }}
        title="Assign Admin to Facility"
        density="compact"
        footer={
          <>
            <Button
              variant="ghost"
              icon={RotateCcw}
              onClick={() => {
                setSelectedAdmin('');
                setSelectedFacility('');
              }}
            >
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignModal(false);
                setSelectedAdmin('');
                setSelectedFacility('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!selectedAdmin || !selectedFacility}
              loading={assignMutation.isPending}
              onClick={() =>
                assignMutation.mutate({
                  adminId: selectedAdmin,
                  facilityId: selectedFacility,
                })
              }
            >
              Assign Admin
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Assign an administrator to manage a specific facility. The admin will have full
            access to facility operations.
          </p>

          {unassignedAdmins.length > 0 ? (
            <Select
              label="Select Admin"
              options={[
                { value: '', label: '— Choose an admin —' },
                ...unassignedAdmins.map((a) => ({ value: a._id, label: a.fullName })),
              ]}
              value={selectedAdmin}
              onChange={(e) => setSelectedAdmin(e.target.value)}
            />
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Every facility administrator is already assigned to a hospital. Register a
                new admin without a facility, or use <strong>Reassign Facility</strong> on
                an existing row.
              </p>
            </div>
          )}

          <Select
            label="Select Facility"
            options={[
              { value: '', label: '— Choose a facility —' },
              ...(facilities ?? [])
                .filter((f) => f.isActive)
                .map((f) => ({ value: f._id, label: f.name })),
            ]}
            value={selectedFacility}
            onChange={(e) => setSelectedFacility(e.target.value)}
          />
        </div>
      </Modal>

      {/* Reassign Modal */}
      <Modal
        open={showReassignModal}
        onClose={() => {
          setShowReassignModal(false);
          setReassignAdmin(null);
          setSelectedFacility('');
        }}
        title="Reassign Facility"
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={() => setSelectedFacility('')}>
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowReassignModal(false);
                setReassignAdmin(null);
                setSelectedFacility('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!selectedFacility}
              loading={reassignMutation.isPending}
              onClick={() =>
                reassignMutation.mutate({
                  adminId: reassignAdmin!._id,
                  newFacilityId: selectedFacility,
                })
              }
            >
              Confirm Reassignment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">Administrator</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {reassignAdmin?.fullName}
            </p>
            <p className="text-xs text-slate-500">{reassignAdmin?.email}</p>
          </div>

          <Select
            label="New Facility"
            options={[
              { value: '', label: '— Select new facility —' },
              ...(facilities ?? [])
                .filter((f) => f.isActive)
                .map((f) => ({ value: f._id, label: f.name })),
            ]}
            value={selectedFacility}
            onChange={(e) => setSelectedFacility(e.target.value)}
          />
        </div>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        open={showRemoveConfirm}
        onClose={() => {
          setShowRemoveConfirm(false);
          setRemoveAdmin(null);
        }}
        title="Remove Admin Assignment"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Are you sure you want to remove this assignment?
              </p>
              <p className="mt-1 text-xs text-red-600">
                {removeAdmin?.fullName} will lose access to facility management functions.
                This action can be undone by reassigning them later.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
            <Button
              variant="outline"
              onClick={() => {
                setShowRemoveConfirm(false);
                setRemoveAdmin(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={removeMutation.isPending}
              onClick={() => removeMutation.mutate(removeAdmin!._id)}
            >
              Remove Assignment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
