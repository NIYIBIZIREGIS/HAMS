import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import {
  Plus,
  Pencil,
  Stethoscope,
  Calendar,
  FlaskConical,
  ShieldCheck,
  Search,
  Power,
  PowerOff,
  RotateCcw,
} from 'lucide-react';

const TABS = [
  { key: 'specializations', label: 'Specializations', icon: Stethoscope, endpoint: 'specializations' },
  { key: 'appointmentTypes', label: 'Appointment Types', icon: Calendar, endpoint: 'appointment-types' },
  { key: 'labTestTypes', label: 'Lab Test Types', icon: FlaskConical, endpoint: 'lab-test-types' },
  { key: 'insuranceProviders', label: 'Insurance Providers', icon: ShieldCheck, endpoint: 'insurance-providers' },
] as const;

interface MasterDataItem {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

interface FormData {
  name: string;
  description: string;
}

const emptyForm: FormData = { name: '', description: '' };

export function MasterDataPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>(TABS[0].key);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterDataItem | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');

  const currentTab = TABS.find((tab) => tab.key === activeTab)!;

  const { data, isLoading } = useQuery({
    queryKey: ['master-data', currentTab.endpoint],
    queryFn: async () => {
      const res = await api.get(`/admin/master-data/${currentTab.endpoint}`);
      return res.data as MasterDataItem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/master-data/${currentTab.endpoint}`, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-data', currentTab.endpoint] });
      closeModal();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'An error occurred');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/admin/master-data/${currentTab.endpoint}/${editingItem!._id}`, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-data', currentTab.endpoint] });
      closeModal();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'An error occurred');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (item: MasterDataItem) => {
      if (item.isActive) {
        await api.delete(`/admin/master-data/${currentTab.endpoint}/${item._id}`);
      } else {
        await api.put(`/admin/master-data/${currentTab.endpoint}/${item._id}`, { isActive: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-data', currentTab.endpoint] });
    },
  });

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (item: MasterDataItem) => {
    setEditingItem(item);
    setForm({ name: item.name, description: item.description || '' });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    setForm(emptyForm);
    setFormError('');
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (editingItem) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const filtered = (data ?? []).filter((item) =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-display">Master Data Management</h1>
        <p className="text-sm text-slate-500">Manage reference data used across the system</p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSearch(''); }}
                className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <Card>
        <CardHeader
          title={`${currentTab.label}`}
          subtitle={`${filtered.length} item(s)`}
          action={
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <Button icon={Plus} onClick={openCreate}>
                Add New
              </Button>
            </div>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <currentTab.icon className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item._id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{item.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          item.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleStatusMutation.mutate(item)}
                          className={`rounded-lg p-1.5 transition-colors ${
                            item.isActive
                              ? 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                              : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                          title={item.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {item.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingItem ? 'Edit Item' : 'Add New Item'}
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={() => { setForm(emptyForm); setFormError(''); }}>
              Clear
            </Button>
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button loading={isSaving} onClick={handleSubmit}>
              {editingItem ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Enter name"
            error={formError && !form.name.trim() ? formError : undefined}
          />
          <div className="w-full">
            <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Enter description (optional)"
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-slate-400"
            />
          </div>
          {formError && form.name.trim() && (
            <p className="text-xs text-red-600">{formError}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
