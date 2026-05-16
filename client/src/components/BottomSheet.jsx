import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';

export default function BottomSheet({ open, onClose, title, subtitle, children, maxWidth = 'max-w-lg', footer }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      document.body.style.overflow = 'hidden';
    } else {
      setVisible(false);
      const t = setTimeout(() => { setMounted(false); document.body.style.overflow = ''; }, 320);
      return () => clearTimeout(t);
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!mounted) return null;

  const isMobile = window.innerWidth < 640;

  const sheetStyle = {
    background: 'rgba(15,20,32,0.98)',
    border: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(24px)',
    boxShadow: '0 -8px 48px rgba(0,0,0,0.7)',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`relative w-full ${maxWidth} flex flex-col rounded-t-3xl sm:rounded-2xl max-h-[92vh] sm:max-h-[85vh] transition-all duration-300 ease-out`}
        style={{
          ...sheetStyle,
          transform: visible ? 'translateY(0)' : isMobile ? 'translateY(100%)' : 'translateY(20px) scale(0.97)',
          opacity: visible ? 1 : 0,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Accent line */}
        <div className="absolute top-0 left-8 right-8 h-px rounded-full" style={{ background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)', opacity: 0.5 }} />

        {/* Header */}
        {(title || onClose) && (
          <div className="flex items-start justify-between px-5 pt-4 pb-3 sm:pt-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              {title && <h3 className="font-bold text-[#f3f4f6] text-lg leading-tight">{title}</h3>}
              {subtitle && <p className="text-sm text-[#6b7280] mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="ml-3 shrink-0 p-1.5 rounded-xl text-[#9ca3af] hover:text-[#f3f4f6] transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <FiX size={16} />
            </button>
          </div>
        )}

        {/* Content */}
        <div
          className="overflow-y-auto flex-1 px-5 pb-4"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 20px))' }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="px-5 py-4 rounded-b-2xl"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 20px))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
