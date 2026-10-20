import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { ForcePasswordChange } from '../auth/ForcePasswordChange';

export function ProtectedRoute({ roles }: { roles?: string[] }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (user.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  return <Outlet />;
}
