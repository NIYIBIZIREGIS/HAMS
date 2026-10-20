import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import api from '../../services/api';
import {
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  Clock,
  Pill,
  ArrowRight,
  Package,
  TrendingDown,
} from 'lucide-react';

interface InventoryItem {
  _id: string;
  drugName: string;
  form: string;
  strength: string;
  quantityOnHand: number;
  reorderThreshold: number;
  expiryDate: string;
}

interface Prescription {
  _id: string;
  medicines: Array<{ name: string; dosage: string; frequency: string }>;
  issuedAt: string;
  medicalRecordId?: { appointmentId?: { patientId?: { userId?: { fullName?: string } }; doctorId?: { userId?: { fullName?: string } } } };
}

export function PharmacistDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [invRes, lowRes, prescRes] = await Promise.all([
          api.get('/pharmacy/inventory', { params: { limit: 100 } }),
          api.get('/pharmacy/low-stock'),
          api.get('/pharmacy/pending-prescriptions', { params: { limit: 10 } }),
        ]);
        setInventory(invRes.data.data ?? []);
        setLowStock(lowRes.data.data ?? []);
        setPrescriptions(prescRes.data.data ?? []);
      } catch {
        // silently handle errors
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const expiringSoon = inventory.filter((item) => {
    const daysToExpiry = (new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysToExpiry <= 90 && daysToExpiry > 0;
  });

  const stats = [
    { label: 'Pending Prescriptions', value: prescriptions.length, icon: ClipboardList, color: 'bg-blue-50 text-blue-600' },
    { label: 'In Stock Items', value: inventory.length, icon: Package, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Low Stock Items', value: lowStock.length, icon: TrendingDown, color: lowStock.length > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600' },
    { label: 'Expiring Soon', value: expiringSoon.length, icon: Clock, color: expiringSoon.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600' },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="mt-3 text-sm text-slate-500">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {t('dashboard.welcome', { name: user?.fullName ?? 'Pharmacist' })}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{today}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/pharmacy/inventory">
            <Button variant="outline" icon={Package}>View Inventory</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900">{stat.value}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pending Prescriptions */}
        <Card>
          <CardHeader title="Pending Prescriptions" subtitle="Prescriptions awaiting dispensing" action={<Link to="/pharmacy/inventory" className="text-sm font-medium text-primary-600 hover:underline">View All</Link>} />
          {prescriptions.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">No pending prescriptions</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {prescriptions.slice(0, 5).map((p) => (
                <div key={p._id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {p.medicines.map((m) => m.name).join(', ')}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {p.medicines.length} medicine{p.medicines.length !== 1 ? 's' : ''} — {new Date(p.issuedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="ml-4 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader title="Low Stock Alerts" subtitle="Items below reorder threshold" action={lowStock.length > 0 ? <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200">{lowStock.length} items</span> : undefined} />
          {lowStock.length === 0 ? (
            <div className="px-5 pb-5">
              <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <p className="text-sm text-emerald-700">All stock levels are adequate</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStock.slice(0, 5).map((item) => (
                <div key={item._id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{item.drugName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.strength} — {item.form}</p>
                  </div>
                  <div className="ml-4 text-right">
                    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      {item.quantityOnHand} / {item.reorderThreshold}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader title="Quick Actions" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 px-5 pb-5">
          <Link to="/pharmacy/inventory" className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition-all hover:border-primary-300 hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">View Inventory</p>
              <p className="text-xs text-slate-500">Manage stock levels</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-slate-400 group-hover:text-primary-600" />
          </Link>
          <Link to="/pharmacy/inventory" className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition-all hover:border-primary-300 hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100">
              <Pill className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Dispense Medication</p>
              <p className="text-xs text-slate-500">Fulfill prescriptions</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-slate-400 group-hover:text-primary-600" />
          </Link>
          <Link to="/pharmacy/inventory" className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition-all hover:border-primary-300 hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-100">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Check Alerts</p>
              <p className="text-xs text-slate-500">Low stock & expiry alerts</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-slate-400 group-hover:text-primary-600" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
