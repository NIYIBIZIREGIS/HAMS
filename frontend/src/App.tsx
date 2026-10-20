import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { PortalLayout } from './components/layout/portal/PortalLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Landing } from './pages/Landing';
import { AboutPage } from './pages/public/AboutPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { CommentsPage } from './pages/public/CommentsPage';
import { HelpCenterPage } from './pages/public/HelpCenterPage';
import { FaqPage } from './pages/public/FaqPage';
import { PrivacyPolicyPage } from './pages/public/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/public/TermsOfServicePage';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { BookingWizard } from './pages/patient/BookingWizard';
import { MedicalHistoryPage } from './pages/patient/MedicalHistoryPage';
import { PrescriptionsPage } from './pages/patient/PrescriptionsPage';
import { LabResultsPage } from './pages/patient/LabResultsPage';
import { MessagesPage } from './pages/patient/MessagesPage';
import { NotificationsPage } from './pages/patient/NotificationsPage';
import { DocumentsPage } from './pages/patient/DocumentsPage';
import { BillingPage as PatientBillingPage } from './pages/patient/BillingPage';
import { AppointmentsPage } from './pages/patient/AppointmentsPage';
import { AppointmentDetailPage } from './pages/patient/AppointmentDetailPage';
import { MyFacilitiesPage } from './pages/patient/MyFacilitiesPage';
import { SettingsPage } from './pages/SettingsPage';
import { AvailabilityManager } from './pages/doctor/AvailabilityManager';
import { ConsultationScreen } from './pages/doctor/ConsultationScreen';
import { FacilityAdminDashboard } from './pages/admin/FacilityAdminDashboard';
import { SuperAdminOverview } from './pages/superadmin/SuperAdminOverview';
import { FacilityRegistryPage } from './pages/superadmin/FacilityRegistryPage';
import { FacilityAdminsPage } from './pages/superadmin/FacilityAdminsPage';
import { MasterDataPage } from './pages/superadmin/MasterDataPage';
import { AnalyticsPage } from './pages/superadmin/AnalyticsPage';
import { AuditLogsPage } from './pages/superadmin/AuditLogsPage';
import { GlobalSettingsPage } from './pages/superadmin/GlobalSettingsPage';
import { PharmacyInventoryPage } from './pages/pharmacy/PharmacyInventoryPage';
import { BillingPage } from './pages/receptionist/BillingPage';
import { InsuranceVerifierDashboard } from './pages/insurance/InsuranceVerifierDashboard';
import { ClaimReconciliationPage } from './pages/admin/ClaimReconciliationPage';
import DepartmentManagement from './pages/admin/DepartmentManagement';
import DoctorManagement from './pages/admin/DoctorManagement';
import StaffManagement from './pages/admin/StaffManagement';
import { PatientManagement } from './pages/management/PatientManagement';
import { UsersPage } from './pages/superadmin/UsersPage';
import { ToastHost } from './components/ui/ToastHost';
import { useAuthStore } from './store/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastHost />
      <BrowserRouter>
        <Routes>
          {/* Public routes with regular navbar */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/comments" element={<CommentsPage />} />
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          {/* Auth pages: full-bleed split layout, no container padding */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Authenticated routes with portal sidebar+topbar */}
          <Route element={<PortalLayout />}>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['patient', 'facility_admin', 'receptionist', 'doctor', 'super_admin']} />}>
              <Route path="/book" element={<BookingWizard />} />
            </Route>

            <Route element={<ProtectedRoute roles={['doctor', 'facility_admin', 'super_admin']} />}>
              <Route path="/availability" element={<AvailabilityManager />} />
            </Route>

            <Route element={<ProtectedRoute roles={['doctor', 'facility_admin', 'super_admin']} />}>
              <Route path="/consultation/:appointmentId" element={<ConsultationScreen />} />
            </Route>

            <Route element={<ProtectedRoute roles={['patient']} />}>
              <Route path="/medical-history" element={<MedicalHistoryPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['patient']} />}>
              <Route path="/prescriptions" element={<PrescriptionsPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['patient']} />}>
              <Route path="/lab-results" element={<LabResultsPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['patient']} />}>
              <Route path="/messages" element={<MessagesPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['patient']} />}>
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['patient']} />}>
              <Route path="/documents" element={<DocumentsPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['patient']} />}>
              <Route path="/billing-mine" element={<PatientBillingPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['patient']} />}>
              <Route path="/appointments" element={<AppointmentsPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['patient']} />}>
              <Route path="/my-facilities" element={<MyFacilitiesPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['patient']} />}>
              <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['facility_admin', 'super_admin']} />}>
              <Route path="/admin" element={<FacilityAdminDashboard />} />
            </Route>

            <Route element={<ProtectedRoute roles={['facility_admin', 'super_admin']} />}>
              <Route path="/admin/departments" element={<DepartmentManagement />} />
            </Route>

            <Route element={<ProtectedRoute roles={['facility_admin', 'super_admin']} />}>
              <Route path="/admin/doctors" element={<DoctorManagement />} />
            </Route>

            <Route element={<ProtectedRoute roles={['facility_admin', 'super_admin']} />}>
              <Route path="/admin/staff" element={<StaffManagement />} />
            </Route>

            <Route element={<ProtectedRoute roles={['pharmacist', 'facility_admin', 'super_admin']} />}>
              <Route path="/pharmacy/inventory" element={<PharmacyInventoryPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['receptionist', 'insurance_verifier', 'facility_admin', 'super_admin']} />}>
              <Route path="/billing" element={<BillingPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['receptionist', 'facility_admin']} />}>
              <Route path="/patients" element={<PatientManagement />} />
            </Route>

            <Route element={<ProtectedRoute roles={['super_admin']} />}>
              <Route path="/admin/patients" element={<PatientManagement />} />
            </Route>
            <Route element={<ProtectedRoute roles={['super_admin']} />}>
              <Route path="/admin/users" element={<UsersPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['insurance_verifier', 'facility_admin', 'super_admin']} />}>
              <Route path="/claims" element={<InsuranceVerifierDashboard />} />
            </Route>

            <Route element={<ProtectedRoute roles={['facility_admin', 'insurance_verifier', 'super_admin']} />}>
              <Route path="/reconciliation" element={<ClaimReconciliationPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['super_admin']} />}>
              <Route path="/admin/dashboard" element={<SuperAdminOverview />} />
            </Route>
            <Route element={<ProtectedRoute roles={['super_admin']} />}>
              <Route path="/admin/facilities" element={<FacilityRegistryPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['super_admin']} />}>
              <Route path="/admin/facility-admins" element={<FacilityAdminsPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['super_admin']} />}>
              <Route path="/admin/master-data" element={<MasterDataPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['super_admin']} />}>
              <Route path="/admin/analytics" element={<AnalyticsPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['super_admin']} />}>
              <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['super_admin']} />}>
              <Route path="/admin/settings" element={<GlobalSettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
