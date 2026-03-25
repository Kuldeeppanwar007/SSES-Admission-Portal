import { FiMenu } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import logo from '../../assets/web/icon-512.png';

export default function Navbar({ onMenuClick }) {
  const { user } = useAuthStore();

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
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">{user?.name}</p>
          <p className="text-xs text-gray-400 capitalize">{user?.role?.replace('_', ' ')}</p>
        </div>
      </div>
    </nav>
  );
}
