import { AuthCentered } from '../../components/auth/AuthCentered';
import { LoginForm } from '../../components/auth/LoginForm';

export function Login() {
  return (
    <AuthCentered>
      <LoginForm />
    </AuthCentered>
  );
}