import { useState, useEffect, useRef } from 'react';
import { FiBell, FiX, FiInfo, FiCheckCircle } from 'react-icons/fi';
import api from '../../api/axios';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef(null);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      setUnread(data.unreadCount);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Open/close with animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
      >
        <FiBell size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {mounted && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/20 transition-opacity duration-300"
            style={{ opacity: visible ? 1 : 0 }}
            onClick={() => setOpen(false)}
          />

          {/* Panel — mobile: slide from right, desktop: dropdown */}
          <div
            className="fixed right-0 w-full max-w-sm bg-white z-50 flex flex-col shadow-2xl
                        md:absolute md:right-0 md:top-10 md:h-auto md:max-h-[85vh] md:rounded-2xl md:w-96
                        transition-all duration-300 ease-out"
            style={{
              top: 'calc(56px + env(safe-area-inset-top, 0px))',
              height: 'calc(100vh - 56px - env(safe-area-inset-top, 0px))',
              // Mobile: slide from right; Desktop: fade + slide down
              transform: visible ? 'translateX(0)' : 'translateX(100%)',
              opacity: visible ? 1 : 0,
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-6 pb-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
                <p className="text-xs font-semibold text-gray-400 mt-0.5 tracking-wide">
                  {unread} UNREAD
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <FiX size={18} className="text-gray-600" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-12">Koi notification nahi</p>
              ) : notifications.map((n) => (
                <div key={n._id} className="flex items-start gap-3 px-5 py-4">
                  <div className="shrink-0 h-10 w-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                    <FiInfo size={18} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {n.title}
                      </p>
                      <span className="text-[11px] text-gray-400 shrink-0 mt-0.5 font-medium">
                        {formatDate(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-3">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div
              className="border-t border-gray-100 py-4 flex items-center justify-center"
              style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 16px))' }}
            >
              <button
                onClick={markAllRead}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <FiCheckCircle size={16} />
                <span>Mark all as read</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
