import { NavLink, useNavigate } from 'react-router-dom';
import { FiHome, FiUsers, FiUserCheck, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { useState } from 'react';
import useAuthStore from '../../store/authStore';
import logo from '../../assets/web/icon-512.png';

const navItems = [
  { to: '/dashboard', icon: <FiHome size={20} />, label: 'Dashboard' },
  { to: '/students', icon: <FiUsers size={20} />, label: 'Students' },
  { to: '/users', icon: <FiUserCheck size={20} />, label: 'Users', adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const links = navItems.filter((i) => !i.adminOnly || user?.role === 'admin');

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 flex-col z-40">
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img src={logo} alt="SSES Logo" className="h-14 w-14 object-contain" />
            <span className="text-2xl font-bold text-gray-900">SSES</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {links.map((item) => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-orange-50 hover:text-primary'}`}>
              {item.icon} {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <p className="text-sm text-gray-700 font-medium mb-1">{user?.name}</p>
          <p className="text-xs text-gray-400 mb-3">{user?.email}</p>
          <button onClick={handleLogout} className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors text-sm">
            <FiLogOut /> Logout
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 flex items-center justify-between px-4 py-2">
        <img src={logo} alt="SSES Logo" className="h-8 object-contain" />
        <button onClick={() => setOpen(true)} className="text-gray-600 p-1">
          <FiMenu size={22} />
        </button>
      </div>

      {/* ── Mobile Drawer ── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => setOpen(false)} />
          <aside className="relative w-72 bg-white h-full flex flex-col shadow-xl">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={logo} alt="SSES Logo" className="h-12 w-12 object-contain" />
                <span className="text-xl font-bold text-gray-900">SSES</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
            </div>
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-sm text-gray-700 font-medium">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
              {user?.track && <p className="text-xs text-gray-400">{user.track}</p>}
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {links.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-orange-50 hover:text-primary'}`}>
                  {item.icon} {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-200">
              <button onClick={handleLogout} className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors text-sm">
                <FiLogOut /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
