import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export function AuthLayout() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface transition-colors duration-300 dark:bg-slate-950">
      <Navbar />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
