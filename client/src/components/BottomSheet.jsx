import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';

export default function BottomSheet({ open, onClose, title, subtitle, children, maxWidth = 'max-w-lg', footer }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Small delay so CSS transition triggers after mount
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      document.body.style.overflow = 'hidden';
    } else {
      setVisible(false);
      // Wait for transition to finish before unmounting
      const t = setTimeout(() => { setMounted(false); document.body.style.overflow = ''; }, 320);
      return () => clearTimeout(t);
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!mounted) return null;

  const isMobile = window.innerWidth < 640;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`relative bg-white w-full ${maxWidth} flex flex-col shadow-2xl
          rounded-t-3xl sm:rounded-2xl
          max-h-[92vh] sm:max-h-[85vh]
          transition-all duration-300 ease-out`}
        style={{
          transform: visible
            ? 'translateY(0)'
            : isMobile ? 'translateY(100%)' : 'translateY(20px) scale(0.97)',
          opacity: visible ? 1 : 0,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        {(title || onClose) && (
          <div className="flex items-start justify-between px-5 pt-4 pb-3 sm:pt-5">
            <div>
              {title && <h3 className="font-bold text-gray-900 text-lg leading-tight">{title}</h3>}
              {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="ml-3 shrink-0 p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
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
            className="px-5 py-4 border-t border-gray-100 bg-white rounded-b-2xl"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 20px))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
