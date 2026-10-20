import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PortalSidebar } from './PortalSidebar';
import { PortalHeader } from './PortalHeader';

export function PortalLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      <PortalSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div
        className={`flex min-w-0 flex-col transition-all duration-300 ${
          collapsed ? 'lg:ml-16' : 'lg:ml-60'
        }`}
      >
        <PortalHeader onOpenMobile={() => setMobileOpen(true)} />
        <main key={location.pathname} className="flex-1 px-4 py-6 animate-page-in md:px-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}