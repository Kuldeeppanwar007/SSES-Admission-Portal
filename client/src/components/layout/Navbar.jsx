import { FiMenu, FiWifiOff, FiUser, FiLogOut } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import logo from '../../assets/web/icon-512.png';
import NotificationBell from './NotificationBell';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

const isMobile = Capacitor.isNativePlatform();

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [online, setOnline] = useState(navigator.onLine);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutMounted, setLogoutMounted] = useState(false);
  const menuRef = useRef(null);

  const openMenu = () => {
    setMenuMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setMenuVisible(true)));
    setMenuOpen(true);
  };
  const closeMenu = () => {
    setMenuVisible(false);
    setMenuOpen(false);
    setTimeout(() => setMenuMounted(false), 300);
  };
  const openLogout = () => {
    setLogoutMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setLogoutVisible(true)));
    setShowLogoutModal(true);
  };
  const closeLogout = () => {
    setLogoutVisible(false);
    setShowLogoutModal(false);
    setTimeout(() => setLogoutMounted(false), 300);
  };

  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) closeMenu(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
    closeLogout();
  };

  return (
    <>
      <nav className="relative bg-white/90 md:bg-white/70 backdrop-blur-xl border-b border-gray-100 md:border md:border-white/50 rounded-none md:rounded-2xl flex items-center px-4 md:px-5 pb-[9px] md:pb-3 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all z-50"
        style={{ paddingTop: 'calc(9px + env(safe-area-inset-top, 0px))' }}>
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={onMenuClick} className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50/80 border border-gray-100/50 text-gray-600 hover:bg-gray-100 hover:text-primary transition-all duration-200">
            <FiMenu size={20} />
          </button>
          
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/dashboard')}>
            <img src={logo} alt="SSES" className="h-8 w-8 object-contain drop-shadow-sm" />
            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400 tracking-tight hidden sm:block">SSES</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4 ml-auto">
          {!online && (
            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold tracking-wide uppercase px-2.5 py-1.5 rounded-lg shadow-sm">
              <FiWifiOff size={12} /> <span className="hidden md:inline">Offline</span>
            </div>
          )}
          
          <div className="bg-white/50 p-1 rounded-xl shadow-sm border border-gray-100/50">
             <NotificationBell />
          </div>
          
          <div className="relative" ref={menuRef}>
            <button onClick={() => menuOpen ? closeMenu() : openMenu()}
              className="flex items-center gap-2.5 rounded-full bg-white/80 border border-gray-100 p-1 pr-3 md:pr-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-gray-600 hover:text-primary hover:border-primary/30 hover:bg-orange-50/50 hover:shadow-[0_4px_16px_rgba(249,115,22,0.12)] transition-all duration-300 focus:outline-none">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 shadow-sm">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex flex-col items-start hidden sm:flex max-w-[120px]">
                 <span className="text-xs font-bold text-gray-800 truncate w-full">{user?.name}</span>
                 <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate w-full">{user?.role?.replace('_', ' ')}</span>
              </div>
            </button>
            
            {menuMounted && (
              <div
                className="absolute right-0 mt-3 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100 p-2 z-50 transition-all duration-300 ease-out origin-top-right"
                style={{ opacity: menuVisible ? 1 : 0, transform: menuVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-10px)' }}
              >
                <div className="px-3 py-2.5 mb-1.5 border-b border-gray-50 bg-gray-50/50 rounded-xl">
                  <p className="text-xs font-bold text-gray-900 truncate">{user?.name}</p>
                  <p className="text-[10px] text-gray-500 truncate mt-0.5">{user?.email}</p>
                </div>
                
                <button onClick={() => { navigate('/profile'); closeMenu(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-orange-50/60 hover:text-primary transition-all duration-200 group">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                    <FiUser size={15} />
                  </div>
                  View Profile
                </button>
                
                <button onClick={() => { openLogout(); closeMenu(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 group">
                  <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform duration-300">
                    <FiLogOut size={15} />
                  </div>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {logoutMounted && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4 transition-all duration-300 ease-out"
          style={{ backgroundColor: logoutVisible ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)', backdropFilter: logoutVisible ? 'blur(8px)' : 'blur(0px)' }}
        >
          <div
            className="bg-white rounded-[28px] shadow-2xl w-full max-w-[340px] p-6 space-y-6 transition-all duration-300 ease-out border border-white/50"
            style={{ opacity: logoutVisible ? 1 : 0, transform: logoutVisible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)' }}
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 flex items-center justify-center shadow-inner">
                <FiLogOut size={28} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Sign out of SSES?</h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">You will need to login again to access your personalized dashboard and reports.</p>
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button onClick={closeLogout}
                className="flex-1 bg-white border border-gray-200 text-gray-700 py-3.5 rounded-xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm">
                Cancel
              </button>
              <button onClick={handleLogout}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-3.5 rounded-xl text-sm font-bold hover:from-red-600 hover:to-red-700 shadow-[0_4px_12px_rgba(239,68,68,0.3)] hover:shadow-[0_6px_16px_rgba(239,68,68,0.4)] hover:-translate-y-0.5 transition-all duration-200">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
