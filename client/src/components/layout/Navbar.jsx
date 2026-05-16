import { FiMenu, FiWifiOff, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
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
  const [logoutMounted, setLogoutMounted] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const menuRef = useRef(null);

  const openMenu = () => {
    setMenuMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setMenuVisible(true)));
    setMenuOpen(true);
  };
  const closeMenu = () => {
    setMenuVisible(false);
    setMenuOpen(false);
    setTimeout(() => setMenuMounted(false), 200);
  };
  const openLogout = () => {
    setLogoutMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setLogoutVisible(true)));
  };
  const closeLogout = () => {
    setLogoutVisible(false);
    setTimeout(() => setLogoutMounted(false), 250);
  };

  useEffect(() => {
    const on = () => setOnline(true);
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

  const handleLogout = () => { logout(); navigate('/login'); closeLogout(); };

  const navStyle = {
    background: 'rgba(11,15,25,0.92)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    backdropFilter: 'blur(20px)',
  };

  const dropdownStyle = {
    background: 'rgba(17,24,39,0.98)',
    border: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
  };

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center px-4 justify-between"
        style={{ ...navStyle, paddingTop: 'env(safe-area-inset-top, 20px)', height: 'calc(60px + env(safe-area-inset-top, 20px))' }}
      >
        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick} className="md:hidden p-2 rounded-lg text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/5 transition-colors">
            <FiMenu size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))', boxShadow: '0 0 10px var(--color-primary-glow)' }}>
              <span className="text-white text-[10px] font-black">S</span>
            </div>
            <span className="text-sm font-bold text-[#f3f4f6] hidden sm:block">SSES</span>
            <span className="text-[10px] text-[#6b7280] hidden sm:block font-medium">Admission Portal</span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {!online && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-amber-400"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <FiWifiOff size={11} /> Offline
            </div>
          )}

          <NotificationBell />

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => menuOpen ? closeMenu() : openMenu()}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-200 hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}>
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-medium text-[#d1d5db] hidden sm:block max-w-[100px] truncate">{user?.name}</span>
            </button>

            {menuMounted && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-2xl py-1.5 z-50 transition-all duration-200"
                style={{ ...dropdownStyle, opacity: menuVisible ? 1 : 0, transform: menuVisible ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.95)', transformOrigin: 'top right' }}
              >
                <div className="px-4 py-2.5 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs font-semibold text-[#f3f4f6] truncate">{user?.name}</p>
                  <p className="text-[10px] text-[#6b7280] truncate">{user?.email}</p>
                </div>
                <button onClick={() => { navigate('/profile'); closeMenu(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/5 transition-colors">
                  <FiUser size={14} /> View Profile
                </button>
                <button onClick={() => { navigate('/settings'); closeMenu(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-white/5 transition-colors">
                  <FiSettings size={14} /> Settings
                </button>
                {!isMobile && (
                  <button onClick={() => { openLogout(); closeMenu(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                    <FiLogOut size={14} /> Logout
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Logout modal */}
      {logoutMounted && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-6 transition-all duration-250"
          style={{ background: logoutVisible ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-xs p-6 rounded-2xl space-y-5 transition-all duration-250"
            style={{ ...dropdownStyle, opacity: logoutVisible ? 1 : 0, transform: logoutVisible ? 'scale(1)' : 'scale(0.92)' }}
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <FiLogOut size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#f3f4f6]">Confirm Logout</h3>
                <p className="text-sm text-[#6b7280] mt-1">You will be signed out of the portal.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={closeLogout} className="hud-btn-ghost flex-1">Cancel</button>
              <button onClick={handleLogout}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200"
                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 0 16px rgba(239,68,68,0.3)' }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
