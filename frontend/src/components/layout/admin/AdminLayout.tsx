import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface">
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-200 ${
          collapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
