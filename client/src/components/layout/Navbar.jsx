import { FiMenu, FiWifiOff, FiSettings, FiUser, FiLogOut } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import logo from '../../assets/web/icon-512.png';
import NotificationBell from './NotificationBell';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [online, setOnline] = useState(navigator.onLine);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setShowLogoutModal(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 flex items-center px-4 justify-between shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top, 20px)', height: 'calc(56px + env(safe-area-inset-top, 20px))' }}>
        <div className="flex items-center gap-2">
          <button onClick={onMenuClick} className="md:hidden text-gray-600 p-1 mr-1">
            <FiMenu size={22} />
          </button>
          <img src={logo} alt="SSES" className="h-8 w-8 object-contain" />
          <span className="text-lg font-bold text-gray-900">SSES</span>
        </div>
        <div className="flex items-center gap-2">
          {!online && (
            <div className="flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-1 rounded-full">
              <FiWifiOff size={11} /> Offline
            </div>
          )}
          <NotificationBell />
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)}
              className="w-8 h-8 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-primary hover:bg-orange-100 transition-colors">
              <FiSettings size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <button onClick={() => { navigate('/profile'); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary transition-colors">
                  <FiUser size={15} /> View Profile
                </button>
                <button onClick={() => { setShowLogoutModal(true); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary transition-colors">
                  <FiLogOut size={15} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {showLogoutModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center">
                <FiLogOut size={22} className="text-primary" />
              </div>
              <h3 className="text-base font-bold text-gray-800">Logout karna chahte hain?</h3>
              <p className="text-sm text-gray-400">Aap portal se bahar ho jaayenge.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleLogout}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
