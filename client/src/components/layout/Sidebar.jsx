import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiUsers, FiUserCheck, FiChevronLeft, FiChevronRight, FiFlag, FiPieChart, FiChevronDown, FiMap, FiCheckSquare, FiEdit, FiSettings, FiActivity, FiX, FiBarChart2, FiPhone } from 'react-icons/fi';
import { useState } from 'react';
import useAuthStore from '../../store/authStore';
import { TRACKS, MAIN_TRACKS } from '../../utils/constants';

const navItems = [
  { to: '/dashboard', Icon: FiHome, label: 'Dashboard' },
  { to: '/track-dashboard', Icon: FiPieChart, label: 'My Track', trackOnly: true },
  { to: '/students', Icon: FiUsers, label: 'Students' },
  { to: '/edit-requests', Icon: FiEdit, label: 'Edit Requests', adminOnly: true },
  { to: '/edit-requests', Icon: FiEdit, label: 'Edit Requests', trackOnly: true },
  { to: '/activity-log', Icon: FiActivity, label: 'Activity Log', adminOnly: true },
  { to: '/activity-log', Icon: FiActivity, label: 'Activity Log', trackOnly: true },
  { to: '/activity-log', Icon: FiActivity, label: 'Activity Log', receptionistOnly: true },
  { to: '/daily-summary', Icon: FiBarChart2, label: 'Daily Summary', adminOnly: true },
  { to: '/daily-summary', Icon: FiBarChart2, label: 'Daily Summary', trackOnly: true },
  { to: '/daily-summary', Icon: FiBarChart2, label: 'Daily Summary', receptionistOnly: true },
  { to: '/targets', Icon: FiFlag, label: 'Targets', adminOnly: true },
  { to: '/track-manager', Icon: FiSettings, label: 'Track Manager', adminOnly: true },
  { to: '/users', Icon: FiUserCheck, label: 'Users', adminOnly: true },
  { to: '/attendance', Icon: FiCheckSquare, label: 'Attendance', adminOnly: true },
  { to: '/ai-callbacks', Icon: FiPhone, label: 'AI Callbacks', adminOnly: true },
  { to: '/ai-callbacks', Icon: FiPhone, label: 'AI Callbacks', trackOnly: true },
];

export default function Sidebar({ open, onClose, collapsed, onToggle }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [trackMenuOpen, setTrackMenuOpen] = useState(location.pathname.startsWith('/admin-track'));
  const links = navItems.filter((i) => {
    if (i.adminOnly) return user?.role === 'admin';
    if (i.trackOnly) return user?.role === 'track_incharge' || user?.role === 'interviewer';
    if (i.receptionistOnly) return user?.role === 'receptionist';
    if (user?.role === 'receptionist') return i.to === '/dashboard' || i.to === '/students';
    if (user?.role === 'interviewer') return i.to === '/dashboard' || i.to === '/students' || i.to === '/track-dashboard' || i.to === '/activity-log' || i.to === '/daily-summary' || i.to === '/settings';
    return true;
  });

  const sidebarContent = (
    <div className="flex flex-col h-full relative">
      <button
        onClick={onToggle}
        className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-50 w-8 h-8 bg-white border border-gray-200 rounded-full items-center justify-center shadow text-gray-500 hover:text-primary hover:border-primary transition-colors">
        {collapsed ? <FiChevronRight size={13} /> : <FiChevronLeft size={13} />}
      </button>

      {/* Mobile close button */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-700">Menu</span>
        </div>
        <button onClick={onClose}
          className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
          <FiX size={18} />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 mt-2 overflow-y-auto">
        {/* Dashboard */}
        {links.filter(l => l.to === '/dashboard').map(({ to, Icon, label }) => (
          <NavLink key={to} to={to} onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-lg transition-colors font-medium ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-primary/10 hover:text-primary'}`}
            title={collapsed ? label : ''}>
            <Icon size={20} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {/* Admin — Track Dashboards dropdown (right after Dashboard) */}
        {user?.role === 'admin' && !collapsed && (
          <div>
            <button onClick={() => setTrackMenuOpen((o) => !o)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg transition-colors font-medium ${
                location.pathname.startsWith('/admin-track') ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-primary/10 hover:text-primary'
              }`}>
              <div className="flex items-center gap-3">
                <FiMap size={20} />
                <span>Track Dashboards</span>
              </div>
              <FiChevronDown size={14} className={`transition-transform duration-200 ${trackMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {trackMenuOpen && (
              <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-orange-100 pl-3">
                {MAIN_TRACKS.map((t) => (
                  <NavLink key={t} to={`/admin-track/${t}`} onClick={onClose}
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive ? 'bg-primary text-white font-semibold' : 'text-gray-500 hover:bg-primary/10 hover:text-primary'
                      }`}>
                    {t}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}
        {user?.role === 'admin' && collapsed && (
          <button onClick={() => navigate(`/admin-track/${MAIN_TRACKS[0]}`)} title="Track Dashboards"
            className={`w-full flex justify-center px-3 py-3 rounded-lg transition-colors ${
              location.pathname.startsWith('/admin-track') ? 'bg-primary text-white' : 'text-gray-600 hover:bg-primary/10 hover:text-primary'
            }`}>
            <FiMap size={20} />
          </button>
        )}

        {/* Remaining links */}
        {links.filter(l => l.to !== '/dashboard').map(({ to, Icon, label }, idx) => (
          <NavLink key={`${to}-${idx}`} to={to} onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-lg transition-colors font-medium ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-primary/10 hover:text-primary'}`}
            title={collapsed ? label : ''}>
            <Icon size={20} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-1">
        <NavLink to="/settings" onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-3 rounded-lg transition-colors font-medium ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-primary/10 hover:text-primary'}`}
          title={collapsed ? 'Settings' : ''}>
          <FiSettings size={20} />
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>

      <div className="p-3 border-t border-gray-200" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 16px))' }}>
        {!collapsed && (
          <>
            <p className="text-sm text-gray-700 font-medium mb-0.5">{user?.name}</p>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className={`hidden md:flex fixed left-0 bg-white border-r border-gray-200 flex-col z-40 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}
        style={{ top: 'calc(56px + env(safe-area-inset-top, 20px))', height: 'calc(100vh - 56px - env(safe-area-inset-top, 20px))' }}>
        {sidebarContent}
      </aside>

      <div className={`md:hidden fixed inset-0 z-40 flex transition-all duration-300 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{ top: 'calc(56px + env(safe-area-inset-top, 20px))' }}>
        <div
          className="absolute inset-0 bg-black transition-opacity duration-300"
          style={{ opacity: open ? 0.4 : 0 }}
          onClick={onClose}
        />
        <aside
          className="relative w-64 bg-white h-full flex flex-col shadow-xl transition-transform duration-300 ease-out"
          style={{ transform: open ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          {sidebarContent}
        </aside>
      </div>
    </>
  );
}
