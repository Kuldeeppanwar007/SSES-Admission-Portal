import { NavLink, useNavigate } from 'react-router-dom';
import { FiHome, FiUsers, FiUserCheck, FiLogOut, FiChevronLeft, FiChevronRight, FiFlag, FiPieChart } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';

const navItems = [
  { to: '/dashboard', Icon: FiHome, label: 'Dashboard' },
  { to: '/track-dashboard', Icon: FiPieChart, label: 'My Track', trackOnly: true },
  { to: '/students', Icon: FiUsers, label: 'Students' },
  { to: '/targets', Icon: FiFlag, label: 'Targets', adminOnly: true },
  { to: '/users', Icon: FiUserCheck, label: 'Users', adminOnly: true },
];

export default function Sidebar({ open, onClose, collapsed, onToggle }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };
  const links = navItems.filter((i) => {
    if (i.adminOnly) return user?.role === 'admin';
    if (i.trackOnly) return user?.role === 'track_incharge';
    return true;
  });

  const sidebarContent = (
    <div className="flex flex-col h-full relative">
      <button
        onClick={onToggle}
        className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-50 w-8 h-8 bg-white border border-gray-200 rounded-full items-center justify-center shadow text-gray-500 hover:text-primary hover:border-primary transition-colors">
        {collapsed ? <FiChevronRight size={13} /> : <FiChevronLeft size={13} />}
      </button>

      <nav className="flex-1 p-3 space-y-1 mt-2">
        {links.map(({ to, Icon, label }) => (
          <NavLink key={to} to={to} onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-lg transition-colors font-medium ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-orange-50 hover:text-primary'}`}
            title={collapsed ? label : ''}>
            <Icon size={20} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-200">
        {!collapsed && (
          <>
            <p className="text-sm text-gray-700 font-medium mb-0.5">{user?.name}</p>
            <p className="text-xs text-gray-400 mb-3">{user?.email}</p>
          </>
        )}
        <button onClick={handleLogout}
          className={`flex items-center gap-2 text-gray-500 hover:text-primary transition-colors text-sm ${collapsed ? 'justify-center w-full' : ''}`}
          title={collapsed ? 'Logout' : ''}>
          <FiLogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className={`hidden md:flex fixed left-0 bg-white border-r border-gray-200 flex-col z-40 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}
        style={{ top: 'calc(56px + env(safe-area-inset-top, 20px))', height: 'calc(100vh - 56px - env(safe-area-inset-top, 20px))' }}>
        {sidebarContent}
      </aside>

      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex"
          style={{ top: 'calc(56px + env(safe-area-inset-top, 20px))' }}>
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose} />
          <aside className="relative w-64 bg-white h-full flex flex-col shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
