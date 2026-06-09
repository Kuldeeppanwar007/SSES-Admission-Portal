import { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useTheme(); // apply saved theme on load

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 w-full ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <div className="sticky top-0 md:top-4 z-40 px-0 md:px-6 mb-0 md:mb-2">
          <Navbar onMenuClick={() => setSidebarOpen(true)} />
        </div>
        <main className="flex-1 px-4 pb-4 md:px-6 md:pb-6 w-full max-w-[1600px] mx-auto mt-2 md:mt-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
