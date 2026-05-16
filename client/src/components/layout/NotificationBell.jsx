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

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setUnread(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();

  const panelStyle = {
    background: 'rgba(15,20,32,0.98)',
    border: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(24px)',
    boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-[#9ca3af] hover:text-[#f3f4f6] transition-colors"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <FiBell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center"
            style={{ background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.5)' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {mounted && (
        <>
          <div
            className="fixed inset-0 z-40 transition-opacity duration-300"
            style={{ background: 'rgba(0,0,0,0.5)', opacity: visible ? 1 : 0 }}
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed right-0 w-full max-w-sm z-50 flex flex-col md:absolute md:right-0 md:top-10 md:h-auto md:max-h-[85vh] md:rounded-2xl md:w-96 transition-all duration-300 ease-out"
            style={{
              ...panelStyle,
              top: 'calc(60px + env(safe-area-inset-top, 0px))',
              height: 'calc(100vh - 60px - env(safe-area-inset-top, 0px))',
              transform: visible ? 'translateX(0)' : 'translateX(100%)',
              opacity: visible ? 1 : 0,
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-6 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <h2 className="text-lg font-bold text-[#f3f4f6]">Notifications</h2>
                <p className="text-xs font-semibold text-[#6b7280] mt-0.5 tracking-wide">{unread} UNREAD</p>
              </div>
              <button onClick={() => setOpen(false)}
                className="p-2 rounded-xl text-[#9ca3af] hover:text-[#f3f4f6] transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <FiX size={16} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center text-[#6b7280] text-sm py-12">Koi notification nahi</p>
              ) : notifications.map((n) => (
                <div key={n._id} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03]"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <FiInfo size={16} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-[#f3f4f6]' : 'font-medium text-[#9ca3af]'}`}>
                        {n.title}
                      </p>
                      <span className="text-[11px] text-[#6b7280] shrink-0 mt-0.5">{formatDate(n.createdAt)}</span>
                    </div>
                    <p className="text-xs text-[#6b7280] mt-0.5 line-clamp-3">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="py-4 flex items-center justify-center"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 16px))' }}>
              <button onClick={markAllRead}
                className="flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#f3f4f6] transition-colors">
                <FiCheckCircle size={15} /> Mark all as read
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
