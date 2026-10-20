import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Eye,
  Download,
  Users,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  Phone,
  CreditCard,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationalId: string;
  dateOfBirth: string;
  gender: string;
  registeredDate: string;
  lastVisit: string | null;
}

interface PatientDetail extends Patient {
  address: string;
  bloodGroup: string;
  allergies: string[];
  emergencyContact: string;
  emergencyPhone: string;
  appointments: AppointmentRecord[];
  medicalNotes: string;
}

interface AppointmentRecord {
  id: string;
  date: string;
  doctorName: string;
  department: string;
  status: 'completed' | 'cancelled' | 'upcoming';
  notes: string;
}

const ITEMS_PER_PAGE = 10;

export default function PatientManagement() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId;

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPatients = async () => {
    if (!facilityId) return;
    try {
      setLoading(true);
      const res = await api.get('/patients', {
        params: { facilityId, search },
      });
      setPatients(res.data);
    } catch (err) {
      console.error('Failed to load patients', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchPatients();
    }, 400);
    return () => clearTimeout(debounce);
  }, [facilityId, search]);

  const totalPages = Math.ceil(patients.length / ITEMS_PER_PAGE);

  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return patients.slice(start, start + ITEMS_PER_PAGE);
  }, [patients, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const openDetailModal = async (patientId: string) => {
    try {
      setDetailLoading(true);
      setIsDetailModalOpen(true);
      const res = await api.get(`/patients/${patientId}`);
      setSelectedPatient(res.data);
    } catch (err) {
      console.error('Failed to load patient details', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">
            {t('admin.patientManagement', 'Patient Management')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View and manage patient records
          </p>
        </div>
        <Button variant="outline" icon={Download}>
          Export Patients
        </Button>
      </div>

      <Card>
        <div className="p-4">
          <Input
            icon={Search}
            placeholder="Search by name, email, phone, or national ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-lg"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 font-medium text-slate-600">Name</th>
                <th className="px-5 py-3 font-medium text-slate-600">Email</th>
                <th className="px-5 py-3 font-medium text-slate-600">Phone</th>
                <th className="px-5 py-3 font-medium text-slate-600">National ID</th>
                <th className="px-5 py-3 font-medium text-slate-600">Registered</th>
                <th className="px-5 py-3 font-medium text-slate-600">Last Visit</th>
                <th className="px-5 py-3 font-medium text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <Users className="mx-auto mb-2 h-8 w-8" />
                    <p>No patients found</p>
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => openDetailModal(patient.id)}
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-navy-900">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {patient.gender || 'Not specified'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{patient.email || '—'}</td>
                    <td className="px-5 py-4 text-slate-600">{patient.phone || '—'}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">
                      {patient.nationalId || '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(patient.registeredDate)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(patient.lastVisit)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetailModal(patient.id);
                        }}
                        aria-label="View patient details"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <p className="text-sm text-slate-500">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(currentPage * ITEMS_PER_PAGE, patients.length)} of {patients.length} patients
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={ChevronLeft}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="px-3 py-1.5 text-sm font-medium text-slate-700">
              {currentPage} / {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedPatient(null);
        }}
        title="Patient Details"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : selectedPatient ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-lg font-bold text-primary">
                {selectedPatient.firstName?.[0]}
                {selectedPatient.lastName?.[0]}
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-navy-900">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </h3>
                <p className="text-sm text-slate-500">{selectedPatient.email}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-navy-900">
                Personal Information
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="h-4 w-4 text-slate-400" />
                  {selectedPatient.phone || 'No phone'}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  {selectedPatient.nationalId || 'No ID'}
                </div>
                <div className="text-slate-600">
                  <span className="text-slate-400">DOB:</span>{' '}
                  {formatDate(selectedPatient.dateOfBirth)}
                </div>
                <div className="text-slate-600">
                  <span className="text-slate-400">Gender:</span>{' '}
                  {selectedPatient.gender || 'Not specified'}
                </div>
                {selectedPatient.address && (
                  <div className="col-span-2 text-slate-600">
                    <span className="text-slate-400">Address:</span> {selectedPatient.address}
                  </div>
                )}
                {selectedPatient.bloodGroup && (
                  <div className="text-slate-600">
                    <span className="text-slate-400">Blood Group:</span>{' '}
                    {selectedPatient.bloodGroup}
                  </div>
                )}
              </div>
            </div>

            {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h4 className="mb-2 text-sm font-semibold text-amber-800">Allergies</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPatient.allergies.map((allergy, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full border border-amber-200 bg-white px-2.5 py-0.5 text-xs font-medium text-amber-700"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedPatient.emergencyContact && (
              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="mb-2 text-sm font-semibold text-navy-900">
                  Emergency Contact
                </h4>
                <p className="text-sm text-slate-600">
                  {selectedPatient.emergencyContact}
                  {selectedPatient.emergencyPhone &&
                    ` — ${selectedPatient.emergencyPhone}`}
                </p>
              </div>
            )}

            <div>
              <h4 className="mb-3 text-sm font-semibold text-navy-900">
                Appointment History
              </h4>
              {selectedPatient.appointments &&
              selectedPatient.appointments.length > 0 ? (
                <div className="space-y-2">
                  {selectedPatient.appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-start justify-between rounded-lg border border-slate-100 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-navy-900">
                            {apt.doctorName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {apt.department} · {formatDate(apt.date)}
                          </p>
                          {apt.notes && (
                            <p className="mt-1 text-xs text-slate-400">{apt.notes}</p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          apt.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : apt.status === 'cancelled'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {apt.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-slate-400">
                  <FileText className="mb-1 h-6 w-6" />
                  <p className="text-sm">No appointment history</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedPatient(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">Patient not found</div>
        )}
      </Modal>
    </div>
  );
}
