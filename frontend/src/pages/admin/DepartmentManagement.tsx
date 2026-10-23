import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';
import { client, getErrorMessage } from '../../services/client';
import { listFacilityDepartments, type Department } from '../../services/api';
import { toast } from '../../store/toastStore';

interface DepartmentFormData {
  name: string;
  description: string;
  defaultConsultationFee: string;
  contactPhone: string;
  contactEmail: string;
}

const EMPTY_FORM: DepartmentFormData = {
  name: '',
  description: '',
  defaultConsultationFee: '',
  contactPhone: '',
  contactEmail: '',
};

function toDepartmentFormData(dept: Department): DepartmentFormData {
  return {
    name: dept.name,
    description: dept.description ?? '',
    defaultConsultationFee: dept.defaultConsultationFee?.toString() ?? '',
    contactPhone: dept.contactInfo?.phone ?? '',
    contactEmail: dept.contactInfo?.email ?? '',
  };
}

export default function DepartmentManagement() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId as string | undefined;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof DepartmentFormData, string>>>({});
  const [formData, setFormData] = useState<DepartmentFormData>(EMPTY_FORM);

  const { data: departments, isLoading } = useQuery<Department[]>({
    queryKey: ['facility-departments', facilityId],
    queryFn: () => listFacilityDepartments(facilityId!),
    enabled: Boolean(facilityId),
  });

  const filteredDepartments = useMemo(() => {
    return (departments ?? []).filter((dept) => {
      return (
        !search ||
        dept.name.toLowerCase().includes(search.toLowerCase()) ||
        (dept.description ?? '').toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [departments, search]);

  const invalidateDepartments = () =>
    queryClient.invalidateQueries({ queryKey: ['facility-departments', facilityId] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        defaultConsultationFee: formData.defaultConsultationFee
          ? Number(formData.defaultConsultationFee)
          : undefined,
        contactInfo: {
          phone: formData.contactPhone.trim() || undefined,
          email: formData.contactEmail.trim() || undefined,
        },
      };
      if (editingDept) {
        await client.put(`/departments/${editingDept._id}`, payload);
      } else {
        await client.post('/departments', payload);
      }
    },
    onSuccess: () => {
      toast.success(
        editingDept ? 'Department updated successfully.' : 'Department created successfully.',
        'Department saved',
      );
      setIsFormModalOpen(false);
      setEditingDept(null);
      invalidateDepartments();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.delete(`/departments/${id}`),
    onSuccess: () => {
      toast.success('Department deleted.', 'Department deleted');
      setIsDeleteModalOpen(false);
      setDeletingDept(null);
      invalidateDepartments();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof DepartmentFormData, string>> = {};
    if (!formData.name.trim()) newErrors.name = 'Department name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const openCreateModal = () => {
    setEditingDept(null);
    setFormData(EMPTY_FORM);
    setErrors({});
    setIsFormModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setFormData(toDepartmentFormData(dept));
    setErrors({});
    setIsFormModalOpen(true);
  };

  const handleClearForm = () => {
    setFormData(editingDept ? toDepartmentFormData(editingDept) : EMPTY_FORM);
    setErrors({});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">
            {t('admin.departmentManagement', 'Department Management')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage departments in your facility
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openCreateModal}>
          Add Department
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              icon={Search}
              placeholder="Search departments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-500">
              {filteredDepartments.length} of {departments?.length ?? 0} shown
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 font-medium text-slate-600">Name</th>
                <th className="px-5 py-3 font-medium text-slate-600">Description</th>
                <th className="px-5 py-3 font-medium text-slate-600">Consultation Fee</th>
                <th className="px-5 py-3 font-medium text-slate-600">Contact</th>
                <th className="px-5 py-3 font-medium text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <Building2 className="mx-auto mb-2 h-8 w-8" />
                    <p>No departments found</p>
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((dept) => (
                  <tr key={dept._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-medium text-navy-900">{dept.name}</td>
                    <td className="px-5 py-4 text-slate-500 max-w-xs truncate">
                      {dept.description || '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {dept.defaultConsultationFee != null
                        ? `RWF ${dept.defaultConsultationFee.toLocaleString()}`
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs">
                      {dept.contactInfo?.phone || dept.contactInfo?.email || '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Pencil}
                          onClick={() => openEditModal(dept)}
                          aria-label="Edit department"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => {
                            setDeletingDept(dept);
                            setIsDeleteModalOpen(true);
                          }}
                          className="text-red-500 hover:text-red-700"
                          aria-label="Delete department"
                        />
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
            Showing {filteredDepartments.length} of {departments?.length ?? 0} departments
          </p>
        </div>
      </Card>

      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingDept ? 'Edit Department' : 'Add Department'}
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={handleClearForm}>
              Clear
            </Button>
            <Button variant="ghost" onClick={() => setIsFormModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saveMutation.isPending}
              onClick={() => {
                if (!validate()) return;
                saveMutation.mutate();
              }}
            >
              {editingDept ? 'Save Changes' : 'Create Department'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Department Name"
              placeholder="e.g. Cardiology"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={errors.name}
            />
            <Input
              label="Contact Phone"
              placeholder="+250 788 000 000"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Default Consultation Fee (RWF)"
              type="number"
              placeholder="5000"
              value={formData.defaultConsultationFee}
              onChange={(e) => setFormData({ ...formData, defaultConsultationFee: e.target.value })}
            />
            <Input
              label="Contact Email"
              type="email"
              placeholder="dept@has.demo"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            />
          </div>
          <Input
            label="Description"
            placeholder="Brief description of the department"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            error={errors.description}
          />
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Department"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <strong>{deletingDept?.name}</strong>? This action
            cannot be undone.
          </p>
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deletingDept!._id)}
            >
              Delete Department
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}