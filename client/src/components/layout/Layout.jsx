import { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useTheme();

  return (
    <div className="min-h-screen bg-[#0b0f19]">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <main
        className={`px-4 pb-6 md:px-6 transition-all duration-300 ${collapsed ? 'md:ml-16' : 'md:ml-64'}`}
        style={{ paddingTop: 'calc(60px + env(safe-area-inset-top, 20px) + 20px)' }}
      >
        <Outlet />
      </main>
    </div>
  );
}
