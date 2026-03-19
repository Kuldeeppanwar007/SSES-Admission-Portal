import { NavLink, useNavigate } from 'react-router-dom';
import { FiHome, FiUsers, FiUserCheck, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { useState } from 'react';
import useAuthStore from '../../store/authStore';

const navItems = [
  { to: '/dashboard', icon: <FiHome />, label: 'Dashboard' },
  { to: '/students', icon: <FiUsers />, label: 'Students' },
  { to: '/users', icon: <FiUserCheck />, label: 'Users', adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const links = navItems.filter((i) => !i.adminOnly || user?.role === 'admin');

  return (
    <>
      <button className="md:hidden fixed top-4 left-4 z-50 bg-primary text-white p-2 rounded" onClick={() => setOpen(!open)}>
        {open ? <FiX size={20} /> : <FiMenu size={20} />}
      </button>

      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 text-gray-800 flex flex-col z-40 transform transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">SSES Portal</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">{user?.role?.replace('_', ' ')}</p>
          {user?.track && <p className="text-xs text-gray-400">{user.track}</p>}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {links.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${
                  isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-orange-50 hover:text-primary'
                }`}>
              {item.icon} {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">{user?.name}</p>
          <button onClick={handleLogout} className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors">
            <FiLogOut /> Logout
          </button>
        </div>
      </aside>
    </>
  );
}
