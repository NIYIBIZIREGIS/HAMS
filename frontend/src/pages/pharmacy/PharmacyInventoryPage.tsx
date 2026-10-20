import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import api from '../../services/api';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  Package,
  RotateCcw,
} from 'lucide-react';

interface InventoryItem {
  _id: string;
  drugName: string;
  form: string;
  strength: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  reorderThreshold: number;
  unitCost: number;
}

const FORM_OPTIONS = [
  { value: '', label: 'All Forms' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'syrup', label: 'Syrup' },
  { value: 'injection', label: 'Injection' },
  { value: 'cream', label: 'Cream' },
  { value: 'drops', label: 'Drops' },
  { value: 'inhaler', label: 'Inhaler' },
];

const EMPTY_FORM = {
  drugName: '',
  form: 'tablet',
  strength: '',
  batchNumber: '',
  expiryDate: '',
  quantityOnHand: 0,
  reorderThreshold: 10,
  unitCost: 0,
};

function toItemForm(item: InventoryItem) {
  return {
    drugName: item.drugName,
    form: item.form,
    strength: item.strength,
    batchNumber: item.batchNumber,
    expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
    quantityOnHand: item.quantityOnHand,
    reorderThreshold: item.reorderThreshold,
    unitCost: item.unitCost,
  };
}

export function PharmacyInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formFilter, setFormFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'expiring'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [showWriteOff, setShowWriteOff] = useState(false);
  const [writeOffItem, setWriteOffItem] = useState<InventoryItem | null>(null);
  const [writeOffQty, setWriteOffQty] = useState(1);
  const [writeOffReason, setWriteOffReason] = useState('');
  const [writeOffSaving, setWriteOffSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = { page, limit };
      if (search) params.search = search;
      if (formFilter) params.form = formFilter;
      if (stockFilter === 'low') params.lowStock = 'true';
      const res = await api.get('/pharmacy/inventory', { params });
      setItems(res.data.data ?? []);
      setTotal(res.data.meta?.total ?? 0);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [page, search, formFilter, stockFilter]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const openCreate = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setForm(toItemForm(item));
    setFormError('');
    setShowForm(true);
  };

  const handleClearForm = () => {
    setForm(editItem ? toItemForm(editItem) : EMPTY_FORM);
    setFormError('');
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.drugName.trim()) {
      setFormError('Drug name is required');
      return;
    }
    if (!form.expiryDate) {
      setFormError('Expiry date is required');
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/pharmacy/inventory/${editItem._id}`, form);
      } else {
        await api.post('/pharmacy/inventory', form);
      }
      setShowForm(false);
      void fetchItems();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const openWriteOff = (item: InventoryItem) => {
    setWriteOffItem(item);
    setWriteOffQty(1);
    setWriteOffReason('');
    setShowWriteOff(true);
  };

  const handleClearWriteOff = () => {
    setWriteOffQty(1);
    setWriteOffReason('');
  };

  const handleWriteOff = async () => {
    if (!writeOffItem || !writeOffReason.trim()) return;
    setWriteOffSaving(true);
    try {
      await api.post('/pharmacy/write-off', {
        inventoryId: writeOffItem._id,
        quantity: writeOffQty,
        reason: writeOffReason,
      });
      setShowWriteOff(false);
      void fetchItems();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to write off';
      setFormError(msg);
    } finally {
      setWriteOffSaving(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Pharmacy Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">Manage drug stock, expiry tracking, and write-offs</p>
        </div>
        <Button icon={Plus} onClick={openCreate}>Add Item</Button>
      </div>

      {/* Filters */}
      <Card padding={false}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              icon={Search}
              placeholder="Search by drug name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-full sm:w-40">
            <Select
              options={FORM_OPTIONS}
              value={formFilter}
              onChange={(e) => { setFormFilter(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'low', 'expiring'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setStockFilter(f); setPage(1); }}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  stockFilter === f
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f === 'all' ? 'All' : f === 'low' ? 'Low Stock' : 'Expiring'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center p-8">
            <Package className="mb-3 h-12 w-12 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No inventory items found</p>
            <Button size="sm" className="mt-3" icon={Plus} onClick={openCreate}>Add First Item</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-medium text-slate-600">Drug Name</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Form</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Strength</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Batch #</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Expiry</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Qty</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Reorder At</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Unit Cost</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const isLow = item.quantityOnHand <= item.reorderThreshold;
                  const isExpiring = (new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 90;
                  return (
                    <tr key={item._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{item.drugName}</td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{item.form}</td>
                      <td className="px-4 py-3 text-slate-600">{item.strength}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.batchNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(item.expiryDate).toLocaleDateString()}</td>
                      <td className={`px-4 py-3 font-medium ${isLow ? 'text-red-600' : 'text-slate-900'}`}>{item.quantityOnHand}</td>
                      <td className="px-4 py-3 text-slate-600">{item.reorderThreshold}</td>
                      <td className="px-4 py-3 text-slate-600">{item.unitCost > 0 ? `$${item.unitCost.toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            <AlertTriangle className="h-3 w-3" /> Low
                          </span>
                        ) : isExpiring ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            <AlertTriangle className="h-3 w-3" /> Expiring
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">OK</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(item)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary-600"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => openWriteOff(item)} className="rounded p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
        width="lg"
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={handleClearForm}>Clear</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>{editItem ? 'Save Changes' : 'Add Item'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{formError}</div>
          )}
          <Input label="Drug Name" value={form.drugName} onChange={(e) => setForm({ ...form, drugName: e.target.value })} required icon={Package} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Form" options={FORM_OPTIONS.slice(1)} value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })} />
            <Input label="Strength" value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} placeholder="e.g. 500mg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Batch Number" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
            <Input label="Expiry Date" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Quantity" type="number" value={String(form.quantityOnHand)} onChange={(e) => setForm({ ...form, quantityOnHand: parseInt(e.target.value) || 0 })} />
            <Input label="Reorder Threshold" type="number" value={String(form.reorderThreshold)} onChange={(e) => setForm({ ...form, reorderThreshold: parseInt(e.target.value) || 0 })} />
            <Input label="Unit Cost ($)" type="number" step="0.01" value={String(form.unitCost)} onChange={(e) => setForm({ ...form, unitCost: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      </Modal>

      {/* Write-Off Modal */}
      <Modal
        open={showWriteOff}
        onClose={() => setShowWriteOff(false)}
        title="Write Off Stock"
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={handleClearWriteOff}>Clear</Button>
            <Button variant="ghost" onClick={() => setShowWriteOff(false)}>Cancel</Button>
            <Button variant="danger" loading={writeOffSaving} onClick={handleWriteOff}>Write Off</Button>
          </>
        }
      >
        <div className="space-y-3">
          {writeOffItem && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-900">{writeOffItem.drugName}</p>
              <p className="text-xs text-slate-500">{writeOffItem.strength} — {writeOffItem.form} — Batch: {writeOffItem.batchNumber}</p>
              <p className="mt-1 text-xs text-slate-500">Current stock: <span className="font-medium text-slate-700">{writeOffItem.quantityOnHand}</span></p>
            </div>
          )}
          <Input label="Quantity to Write Off" type="number" min={1} value={String(writeOffQty)} onChange={(e) => setWriteOffQty(parseInt(e.target.value) || 1)} />
          <Input label="Reason" value={writeOffReason} onChange={(e) => setWriteOffReason(e.target.value)} placeholder="e.g. Expired, Damaged, Recalled" required />
        </div>
      </Modal>
    </div>
  );
}
