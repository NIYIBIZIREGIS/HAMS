import { AuthCentered } from '../../components/auth/AuthCentered';
import { RegisterForm } from '../../components/auth/RegisterForm';

export function Register() {
  return (
    <AuthCentered>
      <RegisterForm />
    </AuthCentered>
  );
}