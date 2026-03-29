import { FiMenu, FiWifiOff } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import logo from '../../assets/web/icon-512.png';
import NotificationBell from './NotificationBell';
import { useState, useEffect } from 'react';

export default function Navbar({ onMenuClick }) {
  const { user } = useAuthStore();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
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
      </div>
    </nav>
  );
}
