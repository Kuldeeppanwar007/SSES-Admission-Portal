import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiUsers, FiUserCheck, FiChevronLeft, FiChevronRight, FiFlag, FiPieChart, FiChevronDown, FiMap, FiCheckSquare, FiEdit, FiSettings, FiActivity, FiX, FiBarChart2, FiPhone } from 'react-icons/fi';
import { useState } from 'react';
import useAuthStore from '../../store/authStore';
import { TRACKS, MAIN_TRACKS } from '../../utils/constants';

const navCategories = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', Icon: FiHome, label: 'Dashboard' },
      { to: '/track-dashboard', Icon: FiPieChart, label: 'My Track', trackOnly: true },
    ]
  },
  {
    title: 'Management',
    items: [
      { to: '/students', Icon: FiUsers, label: 'Students' },
      { to: '/attendance', Icon: FiCheckSquare, label: 'Attendance', adminOnly: true },
      { to: '/edit-requests', Icon: FiEdit, label: 'Edit Requests', adminOnly: true },
      { to: '/edit-requests', Icon: FiEdit, label: 'Edit Requests', trackOnly: true },
    ]
  },
  {
    title: 'Reports & Logs',
    items: [
      { to: '/daily-summary', Icon: FiBarChart2, label: 'Daily Summary', adminOnly: true },
      { to: '/daily-summary', Icon: FiBarChart2, label: 'Daily Summary', trackOnly: true },
      { to: '/daily-summary', Icon: FiBarChart2, label: 'Daily Summary', receptionistOnly: true },
      { to: '/activity-log', Icon: FiActivity, label: 'Activity Log', adminOnly: true },
      { to: '/activity-log', Icon: FiActivity, label: 'Activity Log', trackOnly: true },
      { to: '/activity-log', Icon: FiActivity, label: 'Activity Log', receptionistOnly: true },
      { to: '/ai-callbacks', Icon: FiPhone, label: 'AI Callbacks', adminOnly: true },
      { to: '/ai-callbacks', Icon: FiPhone, label: 'AI Callbacks', trackOnly: true },
    ]
  },
  {
    title: 'System',
    items: [
      { to: '/targets', Icon: FiFlag, label: 'Targets', adminOnly: true },
      { to: '/track-manager', Icon: FiSettings, label: 'Track Manager', adminOnly: true },
      { to: '/users', Icon: FiUserCheck, label: 'Users', adminOnly: true },
    ]
  }
];

export default function Sidebar({ open, onClose, collapsed, onToggle }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [trackMenuOpen, setTrackMenuOpen] = useState(location.pathname.startsWith('/admin-track'));

  const filteredCategories = navCategories.map(cat => ({
    ...cat,
    items: cat.items.filter(i => {
      if (i.adminOnly) return user?.role === 'admin';
      if (i.trackOnly) return user?.role === 'track_incharge' || user?.role === 'interviewer';
      if (i.receptionistOnly) return user?.role === 'receptionist';
      if (user?.role === 'receptionist') return i.to === '/dashboard' || i.to === '/students';
      if (user?.role === 'interviewer') return i.to === '/dashboard' || i.to === '/students' || i.to === '/track-dashboard' || i.to === '/activity-log' || i.to === '/daily-summary' || i.to === '/settings';
      return true;
    })
  })).filter(cat => cat.items.length > 0);

  const sidebarContent = (
    <div className="flex flex-col h-full relative">
      <button
        onClick={onToggle}
        className="hidden md:flex absolute -right-4 top-8 z-50 w-8 h-8 bg-white border border-gray-200 rounded-xl items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-gray-500 hover:text-primary hover:border-primary/40 hover:bg-orange-50/30 hover:shadow-[0_4px_16px_rgba(249,115,22,0.12)] transition-all duration-300 focus:outline-none group">
        {collapsed ? (
          <FiChevronRight size={18} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform duration-300" />
        ) : (
          <FiChevronLeft size={18} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform duration-300" />
        )}
      </button>

      {/* Mobile close button */}
      <div className="md:hidden flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <span className="text-sm font-bold text-gray-800 uppercase tracking-wider">Navigation</span>
        <button onClick={onClose}
          className="p-2 rounded-lg bg-gray-50 hover:bg-gray-200 text-gray-500 transition-colors">
          <FiX size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto overscroll-contain custom-scrollbar">
        {filteredCategories.map((cat, catIdx) => (
          <div key={cat.title}>
            {!collapsed && (
              <h3 className="px-3 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                {cat.title}
              </h3>
            )}
            <div className="space-y-1">
              {cat.items.map(({ to, Icon, label }) => (
                <NavLink key={to} to={to} onClick={onClose}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 font-medium ${
                      collapsed ? 'justify-center' : ''
                    } ${
                      isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }>
                  {({ isActive }) => (
                    <>
                      {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-primary rounded-r-md" />}
                      <Icon size={18} className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                      {!collapsed && <span>{label}</span>}
                      {collapsed && (
                        <div className="absolute left-14 px-2 py-1 bg-gray-800 text-white text-xs font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-sm border border-gray-700">
                          {label}
                        </div>
                      )}
                    </>
                  )}
                </NavLink>
              ))}

              {/* Inject Track Dashboards dropdown right after Dashboard if admin */}
              {cat.title === 'Overview' && user?.role === 'admin' && (
                <>
                  {!collapsed ? (
                    <div>
                      <button onClick={() => setTrackMenuOpen((o) => !o)}
                        className={`group relative w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 font-medium ${
                          location.pathname.startsWith('/admin-track') 
                            ? 'bg-primary/10 text-primary' 
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}>
                        {location.pathname.startsWith('/admin-track') && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-primary rounded-r-md" />}
                        <div className="flex items-center gap-3">
                          <FiMap size={18} className={`transition-transform duration-200 ${location.pathname.startsWith('/admin-track') ? 'scale-110' : 'group-hover:scale-110'}`} />
                          <span>Track Dashboards</span>
                        </div>
                        <FiChevronDown size={16} className={`transition-transform duration-300 ${trackMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${trackMenuOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                        <div className="ml-5 mt-1 space-y-1 border-l-2 border-gray-100 pl-2">
                          {MAIN_TRACKS.map((t) => (
                            <NavLink key={t} to={`/admin-track/${t}`} onClick={onClose}
                              className={({ isActive }) =>
                                `block px-3 py-2 rounded-md text-sm font-medium transition-all ${
                                  isActive ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                                }`
                              }>
                              {t}
                            </NavLink>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => {
                        navigate(`/admin-track/${MAIN_TRACKS[0]}`);
                        onClose && onClose();
                      }}
                      className={`group relative w-full flex justify-center px-3 py-2.5 rounded-lg transition-all duration-200 ${
                        location.pathname.startsWith('/admin-track') ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}>
                      {location.pathname.startsWith('/admin-track') && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-primary rounded-r-md" />}
                      <FiMap size={18} className={`transition-transform duration-200 ${location.pathname.startsWith('/admin-track') ? 'scale-110' : 'group-hover:scale-110'}`} />
                      <div className="absolute left-14 px-2 py-1 bg-gray-800 text-white text-xs font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-sm border border-gray-700">
                        Track Dashboards
                      </div>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-2 pt-2 border-t border-gray-100">
        <NavLink to="/settings" onClick={onClose}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 font-medium ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`
          }>
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-primary rounded-r-md" />}
              <FiSettings size={18} className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
              {!collapsed && <span>Settings</span>}
              {collapsed && (
                <div className="absolute left-14 px-2 py-1 bg-gray-800 text-white text-xs font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-sm border border-gray-700">
                  Settings
                </div>
              )}
            </>
          )}
        </NavLink>
      </div>

      <div className="p-3 border-t border-gray-100 bg-gray-50/50" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 16px))' }}>
        {!collapsed ? (
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all duration-200 cursor-default group border border-transparent hover:border-gray-100">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20 shadow-sm">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center p-1">
            <div className="group relative w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20 shadow-sm cursor-default">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              <div className="absolute left-12 px-2 py-1 bg-gray-800 text-white text-xs font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-sm border border-gray-700">
                {user?.name}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className={`hidden md:flex fixed left-0 top-0 bg-white border-r border-gray-200 flex-col z-40 transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-64'} shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]`}
        style={{ height: '100vh', paddingTop: 'env(safe-area-inset-top, 16px)' }}>
        {sidebarContent}
      </aside>

      <div className={`md:hidden fixed inset-0 z-50 flex transition-all duration-300 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div
          className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300"
          style={{ opacity: open ? 1 : 0 }}
          onClick={onClose}
        />
        <aside
          className="relative w-[280px] bg-white h-full flex flex-col shadow-2xl transition-transform duration-300 ease-out"
          style={{ transform: open ? 'translateX(0)' : 'translateX(-100%)', paddingTop: 'env(safe-area-inset-top, 16px)' }}
        >
          {sidebarContent}
        </aside>
      </div>
    </>
  );
}
