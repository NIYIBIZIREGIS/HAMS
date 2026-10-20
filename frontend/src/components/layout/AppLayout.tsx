import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-surface transition-colors duration-300 dark:bg-slate-950">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>
    </div>
  );
}
