import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 md:ml-64 pt-20 md:pt-6 p-4 md:p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
