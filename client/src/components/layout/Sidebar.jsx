import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  FiHome, FiUsers, FiUserCheck, FiChevronLeft, FiChevronRight,
  FiFlag, FiPieChart, FiChevronDown, FiMap, FiCheckSquare,
  FiEdit, FiSettings, FiActivity, FiX, FiBarChart2,
} from 'react-icons/fi';
import { useState } from 'react';
import useAuthStore from '../../store/authStore';
import { TRACKS, MAIN_TRACKS } from '../../utils/constants';

const navItems = [
  { to: '/dashboard',     Icon: FiHome,       label: 'Dashboard' },
  { to: '/track-dashboard', Icon: FiPieChart,  label: 'My Track',      trackOnly: true },
  { to: '/students',      Icon: FiUsers,       label: 'Students' },
  { to: '/edit-requests', Icon: FiEdit,        label: 'Edit Requests',  adminOnly: true },
  { to: '/edit-requests', Icon: FiEdit,        label: 'Edit Requests',  trackOnly: true },
  { to: '/activity-log',  Icon: FiActivity,    label: 'Activity Log',   adminOnly: true },
  { to: '/activity-log',  Icon: FiActivity,    label: 'Activity Log',   trackOnly: true },
  { to: '/activity-log',  Icon: FiActivity,    label: 'Activity Log',   receptionistOnly: true },
  { to: '/daily-summary', Icon: FiBarChart2,   label: 'Daily Summary',  adminOnly: true },
  { to: '/daily-summary', Icon: FiBarChart2,   label: 'Daily Summary',  trackOnly: true },
  { to: '/daily-summary', Icon: FiBarChart2,   label: 'Daily Summary',  receptionistOnly: true },
  { to: '/targets',       Icon: FiFlag,        label: 'Targets',        adminOnly: true },
  { to: '/track-manager', Icon: FiSettings,    label: 'Track Manager',  adminOnly: true },
  { to: '/users',         Icon: FiUserCheck,   label: 'Users',          adminOnly: true },
  { to: '/attendance',    Icon: FiCheckSquare, label: 'Attendance',     adminOnly: true },
];

function NavItem({ to, Icon, label, collapsed, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={collapsed ? label : ''}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
        ${collapsed ? 'justify-center' : ''}
        ${isActive
          ? 'nav-active text-[var(--color-primary)]'
          : 'text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/5'
        }`
      }
    >
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose, collapsed, onToggle }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [trackMenuOpen, setTrackMenuOpen] = useState(location.pathname.startsWith('/admin-track'));

  const links = navItems.filter((i) => {
    if (i.adminOnly)      return user?.role === 'admin';
    if (i.trackOnly)      return user?.role === 'track_incharge' || user?.role === 'interviewer';
    if (i.receptionistOnly) return user?.role === 'receptionist';
    if (user?.role === 'receptionist') return i.to === '/dashboard' || i.to === '/students';
    if (user?.role === 'interviewer')  return ['/dashboard','/students','/track-dashboard','/activity-log','/daily-summary','/settings'].includes(i.to);
    return true;
  });

  const sidebarContent = (
    <div className="flex flex-col h-full relative">
      {/* Desktop collapse toggle */}
      <button
        onClick={onToggle}
        className="hidden md:flex absolute -right-3.5 top-8 z-50 w-7 h-7 rounded-full items-center justify-center text-[#9ca3af] hover:text-[var(--color-primary)] transition-colors"
        style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {collapsed ? <FiChevronRight size={12} /> : <FiChevronLeft size={12} />}
      </button>

      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-sm font-bold text-[#f3f4f6]">Navigation</span>
        <button onClick={onClose} className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/5 transition-colors">
          <FiX size={18} />
        </button>
      </div>

      {/* Logo area (desktop) */}
      {!collapsed && (
        <div className="hidden md:flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))', boxShadow: '0 0 12px var(--color-primary-glow)' }}>
            <span className="text-white text-xs font-black">S</span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#f3f4f6] leading-none">SSES Portal</p>
            <p className="text-[10px] text-[#6b7280] mt-0.5">Admission System</p>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="hidden md:flex justify-center py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))', boxShadow: '0 0 12px var(--color-primary-glow)' }}>
            <span className="text-white text-xs font-black">S</span>
          </div>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto mt-1">
        {/* Dashboard */}
        {links.filter(l => l.to === '/dashboard').map(({ to, Icon, label }) => (
          <NavItem key={to} to={to} Icon={Icon} label={label} collapsed={collapsed} onClick={onClose} />
        ))}

        {/* Admin Track Dashboards dropdown */}
        {user?.role === 'admin' && !collapsed && (
          <div>
            <button
              onClick={() => setTrackMenuOpen(o => !o)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${location.pathname.startsWith('/admin-track')
                  ? 'text-[var(--color-primary)] bg-[rgba(6,182,212,0.08)]'
                  : 'text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/5'
                }`}
            >
              <div className="flex items-center gap-3">
                <FiMap size={18} />
                <span>Track Dashboards</span>
              </div>
              <FiChevronDown size={13} className={`transition-transform duration-200 ${trackMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {trackMenuOpen && (
              <div className="ml-4 mt-0.5 space-y-0.5 pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                {MAIN_TRACKS.map((t) => (
                  <NavLink key={t} to={`/admin-track/${t}`} onClick={onClose}
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
                      ${isActive ? 'text-[var(--color-primary)] bg-[rgba(6,182,212,0.1)]' : 'text-[#6b7280] hover:text-[#f3f4f6] hover:bg-white/5'}`
                    }>
                    {t}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}
        {user?.role === 'admin' && collapsed && (
          <button
            onClick={() => navigate(`/admin-track/${MAIN_TRACKS[0]}`)}
            title="Track Dashboards"
            className={`w-full flex justify-center px-3 py-2.5 rounded-xl transition-all duration-200
              ${location.pathname.startsWith('/admin-track') ? 'text-[var(--color-primary)] bg-[rgba(6,182,212,0.08)]' : 'text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/5'}`}
          >
            <FiMap size={18} />
          </button>
        )}

        {/* Remaining links */}
        {links.filter(l => l.to !== '/dashboard').map(({ to, Icon, label }, idx) => (
          <NavItem key={`${to}-${idx}`} to={to} Icon={Icon} label={label} collapsed={collapsed} onClick={onClose} />
        ))}
      </nav>

      {/* Settings */}
      <div className="px-3 pb-1">
        <NavItem to="/settings" Icon={FiSettings} label="Settings" collapsed={collapsed} onClick={onClose} />
      </div>

      {/* User info */}
      <div className="p-3 mx-3 mb-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#f3f4f6] truncate">{user?.name}</p>
              <p className="text-[10px] text-[#6b7280] truncate">{user?.role}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const sidebarStyle = {
    background: 'rgba(11,15,25,0.95)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    backdropFilter: 'blur(20px)',
  };

  return (
    <>
      {/* Desktop */}
      <aside
        className={`hidden md:flex fixed left-0 flex-col z-40 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}
        style={{ ...sidebarStyle, top: 'calc(60px + env(safe-area-inset-top, 20px))', height: 'calc(100vh - 60px - env(safe-area-inset-top, 20px))' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-40 flex transition-all duration-300 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{ top: 'calc(60px + env(safe-area-inset-top, 20px))' }}
      >
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ background: 'rgba(0,0,0,0.7)', opacity: open ? 1 : 0, backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
        <aside
          className="relative w-64 h-full flex flex-col shadow-2xl transition-transform duration-300 ease-out"
          style={{ ...sidebarStyle, transform: open ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          {sidebarContent}
        </aside>
      </div>
    </>
  );
}
