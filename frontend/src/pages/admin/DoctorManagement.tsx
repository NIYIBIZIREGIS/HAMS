import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Pencil,
  Trash2,
  Eye,
  Stethoscope,
  Filter,
  Phone,
  RotateCcw,
  Plus,
  UserPlus,
  IdCard,
  GraduationCap,
  Wallet,
  Camera,
  UserCheck,
  Trash,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ZoomableImage } from '../../components/ui/ImageLightbox';
import { StepIndicator } from '../../components/ui/StepIndicator';
import { useAuthStore } from '../../store/authStore';
import { client, getErrorMessage } from '../../services/client';
import {
  listFacilityDoctors,
  listDoctors,
  listFacilityDepartments,
  listFacilities,
  type Doctor,
  type Department,
  type Facility,
} from '../../services/api';
import { toast } from '../../store/toastStore';

const specialtyOptions = [
  { value: 'General Medicine', label: 'General Medicine' },
  { value: 'Pediatrics', label: 'Pediatrics' },
  { value: 'Surgery', label: 'Surgery' },
  { value: 'Laboratory', label: 'Laboratory' },
  { value: 'Pharmacy', label: 'Pharmacy' },
  { value: 'Maternity', label: 'Maternity' },
  { value: 'Cardiology', label: 'Cardiology' },
  { value: 'Dermatology', label: 'Dermatology' },
  { value: 'Neurology', label: 'Neurology' },
  { value: 'Orthopedics', label: 'Orthopedics' },
  { value: 'Radiology', label: 'Radiology' },
  { value: 'Psychiatry', label: 'Psychiatry' },
];

const EMPTY_EDIT = {
  fullName: '',
  email: '',
  phone: '',
  status: 'active',
  specialization: '',
  departmentId: '',
  licenseNumber: '',
  experienceYears: '',
  newVisit: '',
  followUp: '',
  bio: '',
};

const MAX_PHOTO_BYTES = 512 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const EMPTY_ADD = {
  fullName: '',
  email: '',
  phone: '',
  nationalId: '',
  password: '',
  specialization: '',
  departmentId: '',
  licenseNumber: '',
  experienceYears: '',
  newVisit: '',
  followUp: '',
};

function doctorUser(doc: Doctor) {
  return typeof doc.userId === 'string' ? null : doc.userId;
}

export default function DoctorManagement() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId as string | undefined;
  const isSuperAdmin = user?.role === 'super_admin';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [removingDoc, setRemovingDoc] = useState<Doctor | null>(null);
  const [editingDoc, setEditingDoc] = useState<Doctor | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Doctor | null>(null);
  const [viewingDoc, setViewingDoc] = useState<Doctor | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [editStep, setEditStep] = useState<1 | 2>(1);
  const [editPhoto, setEditPhoto] = useState<string | undefined>(undefined);
  const [editPhotoRemoved, setEditPhotoRemoved] = useState(false);
  const [editPhotoError, setEditPhotoError] = useState('');
  const editPhotoRef = useRef<HTMLInputElement>(null);
  const [addForm, setAddForm] = useState(EMPTY_ADD);
  const [selectedFacility, setSelectedFacility] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const { data: doctors, isLoading } = useQuery<Doctor[]>({
    queryKey: ['doctors', facilityId ?? 'all'],
    queryFn: () => (facilityId ? listFacilityDoctors(facilityId) : listDoctors()),
  });

  const departmentSource = facilityId ?? (isSuperAdmin ? selectedFacility : '');

  const { data: departments } = useQuery<Department[]>({
    queryKey: ['departments', departmentSource || 'none'],
    queryFn: () => listFacilityDepartments(departmentSource),
    enabled: Boolean(departmentSource),
  });

  const { data: facilities } = useQuery<Facility[]>({
    queryKey: ['facilities'],
    queryFn: listFacilities,
    enabled: isSuperAdmin,
  });

  const departmentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (doctors ?? []).forEach((doc) => {
      const deps = Array.isArray(doc.departmentId) ? doc.departmentId : [];
      deps.forEach((d) => {
        const id = typeof d === 'string' ? d : d._id;
        const name = typeof d === 'string' ? d : d.name;
        if (id && !seen.has(id)) seen.set(id, name);
      });
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    return (doctors ?? []).filter((doc) => {
      const u = doctorUser(doc);
      const fullName = (u?.fullName ?? '').toLowerCase();
      const specs = (doc.specialization ?? []).join(' ').toLowerCase();
      const matchesSearch =
        !search ||
        fullName.includes(search.toLowerCase()) ||
        (u?.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (u?.phone ?? '').includes(search.toLowerCase()) ||
        specs.includes(search.toLowerCase());
      const matchesDept =
        !departmentFilter ||
        (Array.isArray(doc.departmentId) &&
          doc.departmentId.some((d) => (typeof d === 'string' ? d : d._id) === departmentFilter));
      const matchesStatus = !statusFilter || (u?.status ?? 'active') === statusFilter;
      const matchesSpec =
        !specializationFilter || (doc.specialization ?? []).includes(specializationFilter);
      return matchesSearch && matchesDept && matchesStatus && matchesSpec;
    });
  }, [doctors, search, departmentFilter, statusFilter, specializationFilter]);

  // Reset to the first page whenever the result set is narrowed.
  useEffect(() => {
    setPage(1);
  }, [search, departmentFilter, statusFilter, specializationFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / PAGE_SIZE));
  const pagedDoctors = filteredDoctors.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const availableSpecializations = useMemo(() => {
    const seen = new Set<string>();
    (doctors ?? []).forEach((doc) => (doc.specialization ?? []).forEach((s) => seen.add(s)));
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [doctors]);

  const invalidateDoctors = () => {
    queryClient.invalidateQueries({ queryKey: ['doctors', facilityId ?? 'all'] });
    queryClient.invalidateQueries({ queryKey: ['facility-doctors'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingDoc) return;
      const u = doctorUser(editingDoc);

      // Account fields (name, contact, status, photo) live on the User record.
      if (u && typeof u === 'object' && u._id) {
        const userPayload: Record<string, unknown> = {
          fullName: editForm.fullName,
          email: editForm.email.trim(),
          status: editForm.status,
        };
        if (editForm.phone) userPayload.phone = editForm.phone;
        if (editPhotoRemoved) userPayload.profileImageUrl = '';
        else if (editPhoto) userPayload.profileImageUrl = editPhoto;
        await client.put(`/users/${u._id}`, userPayload);
      }

      // Professional fields live on the Doctor profile.
      await client.put(`/doctors/${editingDoc._id}`, {
        specialization: editForm.specialization ? [editForm.specialization] : [],
        departmentId: editForm.departmentId ? [editForm.departmentId] : [],
        licenseNumber: editForm.licenseNumber || undefined,
        experienceYears: editForm.experienceYears ? Number(editForm.experienceYears) : undefined,
        consultationFee: {
          newVisit: editForm.newVisit ? Number(editForm.newVisit) : undefined,
          followUp: editForm.followUp ? Number(editForm.followUp) : undefined,
        },
        bio: editForm.bio || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Doctor profile updated successfully.', 'Doctor updated');
      setIsEditModalOpen(false);
      setEditingDoc(null);
      setEditPhoto(undefined);
      setEditPhotoRemoved(false);
      setEditPhotoError('');
      invalidateDoctors();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (doc: Doctor) => {
      const u = doctorUser(doc);
      if (u && typeof u === 'object' && u._id) {
        await client.put(`/users/${u._id}`, { status: 'inactive' });
      }
    },
    onSuccess: () => {
      toast.success('Doctor deactivated.', 'Doctor deactivated');
      setIsDeleteModalOpen(false);
      setDeletingDoc(null);
      invalidateDoctors();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (doc: Doctor) => {
      const u = doctorUser(doc);
      if (u && typeof u === 'object' && u._id) {
        await client.put(`/users/${u._id}`, { status: 'active' });
      }
    },
    onSuccess: () => {
      toast.success('Doctor reactivated.', 'Doctor activated');
      invalidateDoctors();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (doc: Doctor) => {
      await client.delete(`/doctors/${doc._id}`);
    },
    onSuccess: () => {
      toast.success('Doctor profile removed.', 'Doctor removed');
      setIsRemoveModalOpen(false);
      setRemovingDoc(null);
      invalidateDoctors();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const userRes = await client.post('/users', {
        fullName: addForm.fullName,
        email: addForm.email.trim(),
        phone: addForm.phone || undefined,
        nationalId: addForm.nationalId || undefined,
        password: addForm.password,
        role: 'doctor',
        ...(isSuperAdmin && selectedFacility ? { facilityId: selectedFacility } : {}),
      });
      const userId = userRes.data.data._id as string;
      try {
        await client.post('/doctors', {
          userId,
          departmentId: addForm.departmentId ? [addForm.departmentId] : undefined,
          licenseNumber: addForm.licenseNumber || undefined,
          specialization: addForm.specialization ? [addForm.specialization] : undefined,
          experienceYears: addForm.experienceYears ? Number(addForm.experienceYears) : undefined,
          consultationFee: {
            newVisit: addForm.newVisit ? Number(addForm.newVisit) : undefined,
            followUp: addForm.followUp ? Number(addForm.followUp) : undefined,
          },
          ...(isSuperAdmin && selectedFacility ? { facilityId: selectedFacility } : {}),
        });
      } catch (err) {
        // Deactivate the account left behind by the failed profile creation.
        await client.delete(`/users/${userId}`).catch(() => undefined);
        throw err;
      }
    },
    onSuccess: () => {
      toast.success('Doctor added successfully.', 'Doctor created');
      setIsAddModalOpen(false);
      setAddForm(EMPTY_ADD);
      setAddStep(1);
      setSelectedFacility('');
      invalidateDoctors();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const openEditModal = (doc: Doctor) => {
    const u = doctorUser(doc);
    const firstDept = Array.isArray(doc.departmentId) ? doc.departmentId[0] : undefined;
    setEditingDoc(doc);
    setEditForm({
      fullName: u?.fullName ?? '',
      email: u?.email ?? '',
      phone: u?.phone ?? '',
      status: u?.status ?? 'active',
      specialization: (doc.specialization ?? [])[0] ?? '',
      departmentId: firstDept ? (typeof firstDept === 'string' ? firstDept : firstDept._id) : '',
      licenseNumber: doc.licenseNumber ?? '',
      experienceYears: doc.experienceYears != null ? String(doc.experienceYears) : '',
      newVisit: doc.consultationFee?.newVisit != null ? String(doc.consultationFee.newVisit) : '',
      followUp: doc.consultationFee?.followUp != null ? String(doc.consultationFee.followUp) : '',
      bio: doc.bio ?? '',
    });
    setEditPhoto(undefined);
    setEditPhotoRemoved(false);
    setEditPhotoError('');
    setEditStep(1);
    setIsEditModalOpen(true);
  };

  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditPhotoError('');
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setEditPhotoError('Only JPG, PNG, and WebP images are supported.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setEditPhotoError('Image must be 512 KB or smaller.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditPhoto(typeof reader.result === 'string' ? reader.result : undefined);
      setEditPhotoRemoved(false);
    };
    reader.onerror = () => setEditPhotoError('Could not read that image. Try another file.');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /**
   * The add-doctor form used to be thirteen fields in one scrolling modal, which meant the
   * button at the bottom was a long way from the first field and the whole thing had to be
   * read before anything could be filled in. It is split in two: who the person is, then the
   * credentials and professional details. Each step validates only itself, so "Continue" is
   * never blocked by a field the user has not reached yet.
   */
  const addIdentityValid =
    addForm.fullName.trim().length >= 5 &&
    addForm.email.trim() !== '' &&
    (!isSuperAdmin || Boolean(selectedFacility));

  const addCredentialsValid = addForm.password.length >= 6;

  /** Both steps satisfied — what the submit button is gated on. */
  const canAddDoctor = addIdentityValid && addCredentialsValid;

  const deptNames = (doc: Doctor) => {
    if (!Array.isArray(doc.departmentId)) return '—';
    return doc.departmentId
      .map((d) => (typeof d === 'string' ? d : d.name))
      .filter(Boolean)
      .join(', ') || '—';
  };

  const facilityName = (id?: string) =>
    (facilities ?? []).find((f) => f._id === id)?.name ?? '—';

  const deptOptions = [
    { value: '', label: '— No department —' },
    ...(departments ?? []).map((d) => ({ value: d._id, label: d.name })),
  ];

  const specOptions = [{ value: '', label: '— Select specialty —' }, ...specialtyOptions];

  const editStatusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' },
  ];

  const editingUser = editingDoc ? doctorUser(editingDoc) : null;
  const editingPhoto = editPhotoRemoved ? null : (editPhoto ?? editingUser?.profileImageUrl);

  const filterDeptOptions = [
    { value: '', label: 'All Departments' },
    ...departmentOptions,
  ];
  const filterStatusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' },
  ];

  const filterSpecOptions = [
    { value: '', label: 'All Specialties' },
    ...availableSpecializations.map((s) => ({ value: s, label: s })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 dark:text-white">
            {t('admin.doctorManagement', 'Doctor Management')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage doctors in your facility
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} icon={UserPlus}>
          Add Doctor
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              icon={Search}
              placeholder="Search by name, email, phone, or specialty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-slate-400" />
            <Select
              options={filterDeptOptions}
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-48"
            />
            <Select
              options={filterSpecOptions}
              value={specializationFilter}
              onChange={(e) => setSpecializationFilter(e.target.value)}
              className="w-48"
            />
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
                <th className="px-5 py-3 font-medium text-slate-600">Doctor</th>
                <th className="px-5 py-3 font-medium text-slate-600">Specialty</th>
                <th className="px-5 py-3 font-medium text-slate-600">Department</th>
                <th className="px-5 py-3 font-medium text-slate-600">License</th>
                <th className="px-5 py-3 font-medium text-slate-600">Contact</th>
                <th className="px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="px-5 py-3 font-medium text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <Stethoscope className="mx-auto mb-2 h-8 w-8" />
                    <p>No doctors found</p>
                  </td>
                </tr>
              ) : (
                pagedDoctors.map((doc) => {
                  const u = doctorUser(doc);
                  const name = u?.fullName ?? 'Unknown';
                  return (
                    <tr key={doc._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={name} imageUrl={u?.profileImageUrl} size="md" />
                          <div>
                            <p className="font-medium text-navy-900 dark:text-white">Dr. {name}</p>
                            <p className="text-xs text-slate-400">{u?.email ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600 capitalize">
                        {(doc.specialization ?? []).join(', ') || '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{deptNames(doc)}</td>
                      <td className="px-5 py-4 text-slate-600">
                        <span className="font-mono text-xs">{doc.licenseNumber ?? '—'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-slate-500">
                          {u?.phone && (
                            <span className="flex items-center gap-1 text-xs">
                              <Phone className="h-3 w-3" />
                              {u.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            (u?.status ?? 'active') === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {u?.status ?? 'active'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Eye}
                            onClick={() => {
                              setViewingDoc(doc);
                              setIsViewModalOpen(true);
                            }}
                            aria-label="View doctor"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Pencil}
                            onClick={() => openEditModal(doc)}
                            aria-label="Edit doctor"
                          />
                          {(u?.status ?? 'active') === 'active' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              onClick={() => {
                                setDeletingDoc(doc);
                                setIsDeleteModalOpen(true);
                              }}
                              className="text-red-500 hover:text-red-700"
                              aria-label="Deactivate doctor"
                            />
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={UserCheck}
                              onClick={() => activateMutation.mutate(doc)}
                              disabled={activateMutation.isPending}
                              className="text-emerald-600 hover:text-emerald-700"
                              aria-label="Activate doctor"
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash}
                            onClick={() => {
                              setRemovingDoc(doc);
                              setIsRemoveModalOpen(true);
                            }}
                            className="text-slate-400 hover:text-red-700"
                            aria-label="Remove doctor profile"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing {filteredDoctors.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filteredDoctors.length)} of {filteredDoctors.length} doctors
            {filteredDoctors.length !== (doctors?.length ?? 0) && (
              <span className="text-slate-400"> (filtered from {doctors?.length ?? 0})</span>
            )}
          </p>
          {totalPages > 1 && (
            <nav className="flex items-center gap-1" aria-label="Doctors pagination">
              <Button
                variant="ghost"
                size="sm"
                icon={ChevronLeft}
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              />
              <span className="px-2 text-sm text-slate-500">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={ChevronRight}
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              />
            </nav>
          )}
        </div>
      </Card>

      {/* Add Doctor Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Doctor"
        width="lg"
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={() => { setAddForm(EMPTY_ADD); setAddStep(1); }}>
              Clear
            </Button>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            {addStep === 1 ? (
              <Button icon={ArrowRight} disabled={!addIdentityValid} onClick={() => setAddStep(2)}>
                Continue
              </Button>
            ) : (
              <>
                <Button variant="outline" icon={ArrowLeft} onClick={() => setAddStep(1)}>
                  Back
                </Button>
                <Button
                  icon={Plus}
                  loading={addMutation.isPending}
                  disabled={!canAddDoctor}
                  onClick={() => addMutation.mutate()}
                >
                  Add Doctor
                </Button>
              </>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <StepIndicator
            current={addStep}
            steps={['Identity', 'Credentials']}
            onSelect={(n) => {
              // Only allow going back, so a half-filled step cannot be skipped past.
              if (n < addStep) setAddStep(n === 1 ? 1 : 2);
            }}
          />

          {addStep === 1 && (
            <>
              <p className="text-xs text-slate-600">
                Who this doctor is. Professional details and sign-in credentials come next.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Full name"
                  value={addForm.fullName}
                  onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                  placeholder="e.g. Jean Mugisha"
                  required
                  autoComplete="off"
                />
                <Input
                  label="National ID"
                  value={addForm.nationalId ?? ''}
                  onChange={(e) => setAddForm({ ...addForm, nationalId: e.target.value })}
                  placeholder="1________________"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Email"
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  required
                />
                <Input
                  label="Phone"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                />
              </div>
              {isSuperAdmin && (
                <Select
                  label="Facility"
                  placeholder="— Select facility —"
                  options={(facilities ?? []).map((f) => ({ value: f._id, label: f.name }))}
                  value={selectedFacility}
                  onChange={(e) => {
                    setSelectedFacility(e.target.value);
                    setAddForm({ ...addForm, departmentId: '' });
                  }}
                />
              )}
            </>
          )}

          {addStep === 2 && (
            <>
              <p className="text-xs text-slate-600">
                Professional details and the credentials the doctor signs in with.
              </p>
              <Input
                label="Password"
                type="password"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                required
                minLength={6}
                hint="At least 6 chars with a letter, number and symbol."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Specialty"
                  options={specOptions}
                  value={addForm.specialization}
                  onChange={(e) => setAddForm({ ...addForm, specialization: e.target.value })}
                />
                <Select
                  label="Department"
                  options={deptOptions}
                  placeholder={departmentSource ? undefined : '— Add doctors after setup —'}
                  value={addForm.departmentId}
                  onChange={(e) => setAddForm({ ...addForm, departmentId: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="License number"
                  value={addForm.licenseNumber}
                  onChange={(e) => setAddForm({ ...addForm, licenseNumber: e.target.value })}
                  placeholder="MED-12345"
                />
                <Input
                  label="Years of experience"
                  type="number"
                  min={0}
                  value={addForm.experienceYears}
                  onChange={(e) => setAddForm({ ...addForm, experienceYears: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Consultation fee — new visit (RWF)"
                  type="number"
                  min={0}
                  value={addForm.newVisit}
                  onChange={(e) => setAddForm({ ...addForm, newVisit: e.target.value })}
                />
                <Input
                  label="Consultation fee — follow-up (RWF)"
                  type="number"
                  min={0}
                  value={addForm.followUp}
                  onChange={(e) => setAddForm({ ...addForm, followUp: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* View Doctor Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewingDoc(null);
        }}
        title="Doctor Details"
        width="lg"
      >
        {viewingDoc ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <ZoomableImage
                src={viewingDoc && doctorUser(viewingDoc)?.profileImageUrl}
                alt={`Dr. ${doctorUser(viewingDoc)?.fullName ?? 'doctor'}'s profile photo`}
              >
                <UserAvatar
                  name={viewingDoc && doctorUser(viewingDoc)?.fullName}
                  imageUrl={viewingDoc && doctorUser(viewingDoc)?.profileImageUrl}
                  size="xl"
                />
              </ZoomableImage>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-text-main dark:text-white">
                    Dr. {doctorUser(viewingDoc)?.fullName ?? 'Unknown'}
                  </h3>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      (doctorUser(viewingDoc)?.status ?? 'active') === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {doctorUser(viewingDoc)?.status ?? 'active'}
                  </span>
                </div>
                <p className="text-sm capitalize text-slate-500">Doctor</p>
                <p className="text-sm text-slate-500">{doctorUser(viewingDoc)?.email ?? '—'}</p>
                {viewingDoc.bio && (
                  <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
                    {viewingDoc.bio}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <Stethoscope className="h-4 w-4 shrink-0 text-slate-400" />
                Specialty: {(viewingDoc.specialization ?? []).join(', ') || '—'}
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <GraduationCap className="h-4 w-4 shrink-0 text-slate-400" />
                Department: {deptNames(viewingDoc)}
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                Phone: {doctorUser(viewingDoc)?.phone ?? '—'}
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <IdCard className="h-4 w-4 shrink-0 text-slate-400" />
                License: {viewingDoc.licenseNumber ?? '—'}
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <Wallet className="h-4 w-4 shrink-0 text-slate-400" />
                Fee: {viewingDoc.consultationFee?.newVisit
                  ? `${viewingDoc.consultationFee.newVisit.toLocaleString()} RWF`
                  : '—'}
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <GraduationCap className="h-4 w-4 shrink-0 text-slate-400" />
                Experience: {viewingDoc.experienceYears != null ? `${viewingDoc.experienceYears} yrs` : '—'}
              </div>
              {doctorUser(viewingDoc)?.nationalId && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                  <IdCard className="h-4 w-4 shrink-0 text-slate-400" />
                  National ID: {doctorUser(viewingDoc)?.nationalId}
                </div>
              )}
              {isSuperAdmin && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300 sm:col-span-2">
                  <Stethoscope className="h-4 w-4 shrink-0 text-slate-400" />
                  Facility: {facilityName(String(viewingDoc.facilityId))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Account status
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    (doctorUser(viewingDoc)?.status ?? 'active') === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {doctorUser(viewingDoc)?.status ?? 'active'}
                </span>
                {(doctorUser(viewingDoc)?.status ?? 'active') === 'active' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Trash2}
                    className="text-red-500 hover:text-red-700"
                    onClick={() => {
                      setIsViewModalOpen(false);
                      setDeletingDoc(viewingDoc);
                      setIsDeleteModalOpen(true);
                    }}
                  >
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={UserCheck}
                    className="text-emerald-600 hover:text-emerald-700"
                    loading={activateMutation.isPending}
                    onClick={() => activateMutation.mutate(viewingDoc)}
                  >
                    Activate
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-end sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
              <Button
                variant="outline"
                icon={Pencil}
                onClick={() => {
                  setIsViewModalOpen(false);
                  openEditModal(viewingDoc);
                }}
              >
                Edit Doctor
              </Button>
              <Button variant="ghost" onClick={() => setIsViewModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">Doctor not found</div>
        )}
      </Modal>

{/* Edit Doctor Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditStep(1);
        }}
        title="Edit Doctor"
        width="lg"
        density="compact"
        footer={
          editStep === 1 ? (
            <>
              <Button
                variant="ghost"
                icon={RotateCcw}
                onClick={() => (editingDoc ? openEditModal(editingDoc) : setEditForm(EMPTY_EDIT))}
              >
                Reset
              </Button>
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                icon={ArrowRight}
                disabled={editForm.fullName.trim().length < 5 || !editForm.email.trim()}
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
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                loading={saveMutation.isPending}
                disabled={editForm.fullName.trim().length < 5 || !editForm.email.trim()}
                onClick={() => saveMutation.mutate()}
              >
                Save Changes
              </Button>
            </>
          )
        }
      >
        <div className="space-y-3">
          <StepIndicator
            current={editStep}
            steps={['Identity', 'Professional']}
            onSelect={(n) => {
              if (n < editStep) setEditStep(n === 1 ? 1 : 2);
            }}
          />

          {editStep === 1 && (
            <>
              {/* Photo */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <ZoomableImage
                  src={editingPhoto}
                  alt={editForm.fullName ? `${editForm.fullName}'s profile photo` : 'Profile photo'}
                >
                  <UserAvatar name={editForm.fullName || 'Doctor'} imageUrl={editingPhoto} size="lg" />
                </ZoomableImage>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-main dark:text-white">Profile photo</p>
                  <p className="mt-0.5 text-xs text-slate-500">JPG, PNG or WebP. Max 512 KB.</p>
                  {editPhotoError && (
                    <p className="mt-1 text-xs text-status-cancelled-text" role="alert">
                      {editPhotoError}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      ref={editPhotoRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleEditPhotoChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={Camera}
                      onClick={() => editPhotoRef.current?.click()}
                    >
                      {editPhoto || !editPhotoRemoved ? 'Change Photo' : 'Upload Photo'}
                    </Button>
                    {editPhoto && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          setEditPhoto(undefined);
                          setEditPhotoRemoved(true);
                        }}
                      >
                        Remove
                      </Button>
                    )}
                    {editPhoto && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditPhoto(undefined);
                          setEditPhotoError('');
                          if (editPhotoRef.current) editPhotoRef.current.value = '';
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal / contact */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Full name"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                />
                <Input
                  label="Phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
                <Select
                  label="Account status"
                  options={editStatusOptions}
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                />
              </div>
            </>
          )}

          {editStep === 2 && (
            <>
              {/* Professional */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Specialty"
                  options={specOptions}
                  value={editForm.specialization}
                  onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                />
                <Select
                  label="Department"
                  options={deptOptions}
                  value={editForm.departmentId}
                  onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
                />
                <Input
                  label="License number"
                  value={editForm.licenseNumber}
                  onChange={(e) => setEditForm({ ...editForm, licenseNumber: e.target.value })}
                  placeholder="MED-12345"
                />
                <Input
                  label="Years of experience"
                  type="number"
                  min={0}
                  value={editForm.experienceYears}
                  onChange={(e) => setEditForm({ ...editForm, experienceYears: e.target.value })}
                />
                <Input
                  label="Consultation fee — new visit (RWF)"
                  type="number"
                  min={0}
                  value={editForm.newVisit}
                  onChange={(e) => setEditForm({ ...editForm, newVisit: e.target.value })}
                />
                <Input
                  label="Consultation fee — follow-up (RWF)"
                  type="number"
                  min={0}
                  value={editForm.followUp}
                  onChange={(e) => setEditForm({ ...editForm, followUp: e.target.value })}
                />
              </div>
              <div>
                <label
                  htmlFor="edit-doctor-bio"
                  className="mb-1 block text-xs font-medium text-text-main"
                >
                  Bio
                </label>
                <textarea
                  id="edit-doctor-bio"
                  rows={3}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Short professional summary shown to patients."
                  className="w-full rounded-xl border border-slate-200 bg-card px-3 py-2 text-sm text-text-main transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Deactivate Confirmation */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Deactivate Doctor"
        width="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Deactivate <strong>{deletingDoc ? `Dr. ${doctorUser(deletingDoc)?.fullName ?? ''}` : ''}</strong>?{' '}
            This doctor will no longer be able to sign in, but their profile and history are kept.
          </p>
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-end sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate(deletingDoc!)}
            >
              Deactivate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove Doctor Profile Confirmation */}
      <Modal
        isOpen={isRemoveModalOpen}
        onClose={() => setIsRemoveModalOpen(false)}
        title="Remove Doctor Profile"
        width="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Permanently delete the profile for{' '}
            <strong>{removingDoc ? `Dr. ${doctorUser(removingDoc)?.fullName ?? ''}` : ''}</strong>?
            The sign-in account is left in place, but appointment history will no longer resolve to
            a doctor. This cannot be undone.
          </p>
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-end sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="ghost" onClick={() => setIsRemoveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={removeMutation.isPending}
              onClick={() => removingDoc && removeMutation.mutate(removingDoc)}
            >
              Remove Profile
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}