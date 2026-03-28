import { useState, useRef, useEffect } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export default function DatePicker({ value, onChange, max, min, label, className = '' }) {
  const today     = new Date(); today.setHours(0,0,0,0);
  const maxDate   = max ? new Date(max) : today;
  const minDate   = min ? new Date(min) : null;

  const parsed    = value ? new Date(value) : null;
  const [open, setOpen]       = useState(false);
  const [viewYear, setViewYear]   = useState((parsed || today).getFullYear());
  const [viewMonth, setViewMonth] = useState((parsed || today).getMonth());
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDate = (d) => {
    const iso = d.toISOString().slice(0, 10);
    onChange(iso);
    setOpen(false);
  };

  const isDisabled = (d) => {
    if (d > maxDate) return true;
    if (minDate && d < minDate) return true;
    return false;
  };

  // Build calendar days
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  const displayValue = parsed
    ? parsed.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  return (
    <div className={`relative ${className}`} ref={ref}>
      {/* Input */}
      <div
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-primary focus-within:ring-2 focus-within:ring-primary bg-white select-none"
      >
        <FiCalendar size={14} className="text-gray-400 shrink-0" />
        <span className={displayValue ? 'text-gray-800' : 'text-gray-400'}>
          {displayValue || (label || 'Select Date')}
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-64">
          {/* Month/Year nav */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">
              <FiChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-gray-700">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">
              <FiChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const disabled = isDisabled(d);
              const selected = parsed && d.toDateString() === parsed.toDateString();
              const isToday  = d.toDateString() === today.toDateString();
              return (
                <button
                  key={d.getDate()} type="button"
                  disabled={disabled}
                  onClick={() => selectDate(d)}
                  className={`text-xs rounded-lg py-1.5 font-medium transition-colors
                    ${selected  ? 'bg-primary text-white'          : ''}
                    ${!selected && isToday ? 'border border-primary text-primary' : ''}
                    ${!selected && !isToday && !disabled ? 'hover:bg-orange-50 text-gray-700' : ''}
                    ${disabled  ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
