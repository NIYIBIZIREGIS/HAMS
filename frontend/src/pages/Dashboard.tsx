import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import { PatientDashboard } from './patient/PatientDashboard';
import { DoctorDashboard } from './doctor/DoctorDashboard';
import { ReceptionistDashboard } from './receptionist/ReceptionistDashboard';
import { FacilityAdminDashboard } from './admin/FacilityAdminDashboard';
import { NurseDashboard } from './nurse/NurseDashboard';
import { LabTechDashboard } from './lab/LabTechDashboard';
import { PharmacistDashboard } from './pharmacy/PharmacistDashboard';
import { InsuranceVerifierDashboard } from './insurance/InsuranceVerifierDashboard';

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  switch (user.role) {
    case 'super_admin':
      return <Navigate to="/admin/dashboard" replace />;
    case 'facility_admin':
      return <FacilityAdminDashboard />;
    case 'doctor':
      return <DoctorDashboard />;
    case 'receptionist':
      return <ReceptionistDashboard />;
    case 'nurse':
      return <NurseDashboard />;
    case 'lab_technician':
      return <LabTechDashboard />;
    case 'pharmacist':
      return <PharmacistDashboard />;
    case 'insurance_verifier':
      return <InsuranceVerifierDashboard />;
    case 'auditor':
      return <StaffPlaceholder role={user.role} />;
    case 'patient':
    default:
      return <PatientDashboard />;
  }
}

function StaffPlaceholder({ role }: { role: string }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.welcome')}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Your {role.replace(/_/g, ' ')} workspace arrives in a later phase.
      </p>
    </div>
  );
}
