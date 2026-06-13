import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiUsers, FiUserCheck, FiChevronLeft, FiChevronRight, FiFlag, FiPieChart, FiChevronDown, FiMap, FiCheckSquare, FiEdit, FiSettings, FiActivity, FiX, FiBarChart2, FiPhone, FiDownload, FiMonitor, FiMenu } from 'react-icons/fi';
import { Capacitor } from '@capacitor/core';
import { useState } from 'react';
import useAuthStore from '../../store/authStore';
import { TRACKS, MAIN_TRACKS } from '../../utils/constants';
import logo from '../../assets/web/icon-512.png';

// ChatGPT-style sidebar panel toggle icon
const SidebarIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

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
      {/* Logo header with sidebar toggle — Gemini/ChatGPT style */}
      <div className={`hidden md:flex items-center px-3 py-4 border-b border-gray-100 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/dashboard')}>
              <img src={logo} alt="SSES" className="h-8 w-8 object-contain drop-shadow-sm" />
              <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400 tracking-tight">SSES</span>
            </div>
            <button
              onClick={onToggle}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50/80 border border-gray-100/50 text-gray-500 hover:text-primary hover:bg-orange-50/50 hover:border-primary/30 hover:shadow-[0_2px_8px_rgba(249,115,22,0.10)] transition-all duration-200 focus:outline-none group"
              title="Close sidebar"
            >
              <SidebarIcon size={18} />
            </button>
          </>
        ) : (
          <button
            onClick={onToggle}
            className="group relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-orange-50/50 transition-all duration-200 focus:outline-none"
            title="Open sidebar"
          >
            <img src={logo} alt="SSES" className="h-8 w-8 object-contain drop-shadow-sm group-hover:scale-110 transition-transform duration-200" />
            <div className="absolute left-14 px-2 py-1 bg-gray-800 text-white text-xs font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-sm border border-gray-700">
              Open sidebar
            </div>
          </button>
        )}
      </div>

      {/* Mobile close button */}
      <div className="md:hidden flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="SSES" className="h-7 w-7 object-contain" />
          <span className="text-sm font-bold text-gray-800 uppercase tracking-wider">Navigation</span>
        </div>
        <button onClick={onClose}
          className="p-2 rounded-lg bg-gray-50 hover:bg-gray-200 text-gray-500 transition-colors">
          <FiX size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto overscroll-contain custom-scrollbar">
        {filteredCategories.map((cat, catIdx) => (
          <div key={cat.title}>
            {!collapsed ? (
              <h3 className="px-3 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                {cat.title}
              </h3>
            ) : (
              catIdx > 0 && <div className="mx-auto mb-3 mt-1 w-8 border-t border-gray-200" />
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

        {!Capacitor.isNativePlatform() && (
          <a
            href="/downloads/SSES_Admission_Portal_Setup.exe"
            download="SSES_Admission_Portal_Setup.exe"
            className={`group relative flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg transition-all duration-200 font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-100 ${collapsed ? 'justify-center' : ''}`}
          >
            <FiMonitor size={18} className="transition-transform duration-200 group-hover:scale-110" />
            {!collapsed && <span className="text-sm">Download App</span>}
            {collapsed && (
              <div className="absolute left-14 px-2 py-1 bg-gray-800 text-white text-xs font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-sm border border-gray-700">
                Download App
              </div>
            )}
          </a>
        )}
      </div>

      <div className="p-3 border-t border-gray-100 bg-gray-50/50" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 16px))' }}>
        {!collapsed ? (
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-200 cursor-default group border border-transparent hover:border-gray-100">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 shadow-sm">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{user?.name}</p>
              <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-[10px] font-bold text-primary uppercase tracking-wider">
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center p-1">
            <div className="group relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20 shadow-sm cursor-default">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
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
      <aside className={`hidden md:flex fixed left-0 top-0 bg-white border-r border-gray-200 flex-col z-50 transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-64'} shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]`}
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
