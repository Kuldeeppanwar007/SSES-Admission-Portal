import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { FiUsers, FiFileText, FiAward, FiXCircle, FiTarget, FiSlash, FiTrendingUp, FiMapPin, FiPhone, FiClipboard, FiExternalLink, FiCheckCircle, FiUserX } from 'react-icons/fi';
import { Geolocation } from '@capacitor/geolocation';
import BottomSheet from '../../components/BottomSheet';

const STATUS_COLORS = {
  Applied:  'bg-yellow-100 text-yellow-700',
  Calling:  'bg-purple-100 text-purple-700',
  Verified: 'bg-blue-100 text-blue-700',
  Admitted: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
  Disabled: 'bg-gray-100 text-gray-600',
  'Admission Cancel': 'bg-rose-100 text-rose-700 border border-rose-200',
};

const FUNNEL_COLORS = {
  'Call Completed':        'bg-purple-50 text-purple-700 border-purple-100',
  'Lead Interested':       'bg-blue-50 text-blue-700 border-blue-100',
  'Visit Scheduled':       'bg-amber-50 text-amber-700 border-amber-100',
  'Visit Completed':       'bg-orange-50 text-primary border-orange-100',
  'Admission Closed':      'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Call Not Received':     'bg-rose-50 text-rose-600 border-rose-100',
  'Wrong Number':          'bg-red-50 text-red-600 border-red-100',
  'Switch Off':            'bg-gray-50 text-gray-600 border-gray-200',
  'Repeated No Response':  'bg-orange-50 text-orange-600 border-orange-100',
  'Not Interested':        'bg-red-50 text-red-700 border-red-200',
  'Joined Elsewhere':      'bg-slate-50 text-slate-600 border-slate-200',
};

const SUBJECT_COLORS = {
  'B.Tech': 'bg-blue-100 text-blue-700',
  'BCA':    'bg-violet-100 text-violet-700',
  'BBA':    'bg-amber-100 text-amber-700',
  'Bcom':   'bg-emerald-100 text-emerald-700',
  'Bio':    'bg-rose-100 text-rose-700',
  'Micro':  'bg-cyan-100 text-cyan-700',
};

const STAT_META = [
  { key: 'total',             label: 'Total',             icon: FiUsers,     iconBg: 'bg-blue-50/80',    iconColor: 'text-blue-500',   text: 'text-blue-600',    border: 'border-blue-100', hoverShadow: 'hover:shadow-[0_12px_24px_-4px_rgba(59,130,246,0.12)] hover:border-blue-300 hover:bg-blue-50/10', href: '/students' },
  { key: 'applied',            label: 'Not Calling',       icon: FiFileText,  iconBg: 'bg-amber-50/80',   iconColor: 'text-amber-500',  text: 'text-amber-600',   border: 'border-amber-100', hoverShadow: 'hover:shadow-[0_12px_24px_-4px_rgba(245,158,11,0.12)] hover:border-amber-300 hover:bg-amber-50/10', href: '/students?status=Applied' },
  { key: 'calling',            label: 'Calling',           icon: FiPhone,     iconBg: 'bg-sky-50/80',     iconColor: 'text-sky-500',    text: 'text-sky-600',     border: 'border-sky-100', hoverShadow: 'hover:shadow-[0_12px_24px_-4px_rgba(14,165,233,0.12)] hover:border-sky-300 hover:bg-sky-50/10', href: '/students?status=Calling' },
  { key: 'interviewAttempts',  label: 'Interview Attempts',icon: FiClipboard, iconBg: 'bg-violet-50/80',  iconColor: 'text-violet-500', text: 'text-violet-600',  border: 'border-violet-100', hoverShadow: 'hover:shadow-[0_12px_24px_-4px_rgba(139,92,246,0.12)] hover:border-violet-300 hover:bg-violet-50/10', href: '/students?interviewFilter=hasAttempts' },
  { key: 'finalCleared',       label: 'Final Interview Cleared',     icon: FiCheckCircle, iconBg: 'bg-green-50/80', iconColor: 'text-green-500',  text: 'text-green-600',   border: 'border-green-100', hoverShadow: 'hover:shadow-[0_12px_24px_-4px_rgba(34,197,94,0.12)] hover:border-green-300 hover:bg-green-50/10', href: '/students?interviewFilter=finalCleared' },
  { key: 'admitted',           label: 'Admission Done',          icon: FiAward,     iconBg: 'bg-emerald-50/80', iconColor: 'text-emerald-500',text: 'text-emerald-600', border: 'border-emerald-100', hoverShadow: 'hover:shadow-[0_12px_24px_-4px_rgba(16,185,129,0.12)] hover:border-emerald-300 hover:bg-emerald-50/10', href: '/students?status=Admitted' },
  { key: 'rejected',           label: 'Rejected',          icon: FiXCircle,   iconBg: 'bg-rose-50/80',    iconColor: 'text-rose-500',   text: 'text-rose-600',    border: 'border-rose-100', hoverShadow: 'hover:shadow-[0_12px_24px_-4px_rgba(244,63,94,0.12)] hover:border-rose-300 hover:bg-rose-50/10', href: '/students?status=Rejected' },
  { key: 'admissionCancel',    label: 'Admission Cancel',   icon: FiUserX,     iconBg: 'bg-red-50/80',     iconColor: 'text-red-500',    text: 'text-red-600',     border: 'border-red-100', hoverShadow: 'hover:shadow-[0_12px_24px_-4px_rgba(239,68,68,0.12)] hover:border-red-300 hover:bg-red-50/10', href: '/students?status=Admission+Cancel' },
  { key: 'disabled',           label: 'Disabled',          icon: FiSlash,     iconBg: 'bg-gray-50/80',    iconColor: 'text-gray-400',   text: 'text-gray-500',    border: 'border-gray-200', hoverShadow: 'hover:shadow-[0_12px_24px_-4px_rgba(107,114,128,0.12)] hover:border-gray-300 hover:bg-gray-50/10', href: '/students?tab=disabled' },
];

const MAX_ACCURACY_M = 500; // 500m se zyada inaccurate reading reject
const MAX_RETRIES = 3;

async function fetchLiveLocation() {
  // Step 1: Request permission explicitly
  try {
    const perm = await Geolocation.requestPermissions();
    if (perm.location !== 'granted' && perm.location !== 'limited') {
      throw new Error('GPS permission denied. Please allow location access.');
    }
  } catch (permErr) {
    if (permErr.message?.includes('denied')) throw permErr;
  }

  // Step 2: Warm-up call
  try {
    await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
  } catch (_) { /* ignore */ }

  // Step 3: Retry loop — accurate reading milne tak try karo
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
      const accuracy = pos.coords.accuracy;
      if (accuracy <= MAX_ACCURACY_M) {
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy, source: 'GPS' };
      }
      // Last attempt pe bhi inaccurate — reject karo
      if (attempt === MAX_RETRIES) {
        throw new Error(`GPS accuracy bahut kam hai (${Math.round(accuracy)}m). Khule jagah jaayein aur dobara try karein.`);
      }
      // Thoda wait karo GPS settle hone ke liye
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      if (err.message?.includes('GPS accuracy')) throw err;
      if (attempt === MAX_RETRIES) break; // fall through to browser
    }
  }

  // Step 4: Browser fallback (web ke liye)
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const accuracy = p.coords.accuracy;
        if (accuracy > MAX_ACCURACY_M) {
          reject(new Error(`Location accuracy bahut kam hai (${Math.round(accuracy)}m). Khule jagah jaayein aur dobara try karein.`));
        } else {
          resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy, source: 'Browser' });
        }
      },
      () => reject(new Error('Location permission denied. Please enable GPS.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function AttendanceButton() {
  const [loading, setLoading] = useState(false);
  const [marked, setMarked] = useState(false);
  const [locInfo, setLocInfo] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const handleAttendance = async () => {
    setLoading(true);
    setAttempt(0);
    try {
      const loc = await fetchLiveLocation();
      await api.post('/attendance/mark', {
        latitude: loc.latitude,
        longitude: loc.longitude,
        locationSource: loc.source,
        accuracy: loc.accuracy,
      });
      setMarked(true);
      setLocInfo(loc);
      toast.success(`Attendance marked! (±${Math.round(loc.accuracy)}m accuracy)`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleAttendance}
        disabled={loading || marked}
        className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border transition-colors
          disabled:opacity-60 disabled:cursor-not-allowed
          bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
      >
        <FiMapPin size={14} />
        {loading ? 'Locating...' : marked ? 'Attendance Marked ✓' : 'Mark Attendance'}
      </button>
      {locInfo && (
        <a
          href={`https://maps.google.com/?q=${locInfo.latitude},${locInfo.longitude}`}
          target="_blank" rel="noreferrer"
          className="text-xs text-emerald-600 hover:underline"
        >
          📍 {locInfo.latitude.toFixed(5)}, {locInfo.longitude.toFixed(5)}
        </a>
      )}
    </div>
  );
}

export default function TrackDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [interviewDrawer, setInterviewDrawer] = useState(false);
  const [interviewStudents, setInterviewStudents] = useState([]);
  const [interviewLoading, setInterviewLoading] = useState(false);

  const openInterviewDrawer = async () => {
    setInterviewDrawer(true);
    if (interviewStudents.length > 0) return;
    setInterviewLoading(true);
    try {
      const { data } = await api.get('/students', {
        params: { interviewFilter: 'hasAttempts', limit: 50, page: 1 },
      });
      const students = data.students || [];

      // Fetch last interview date for each student
      if (students.length > 0) {
        const ids = students.map(s => s._id);
        const { data: lastDates } = await api.post('/interviews/last-dates', { studentIds: ids });
        const dateMap = {};
        (lastDates || []).forEach(({ studentId, lastDate }) => { dateMap[studentId] = lastDate; });
        const today = new Date();
        setInterviewStudents(students.map(s => {
          const lastDate = dateMap[s._id];
          const daysSince = lastDate
            ? Math.floor((today - new Date(lastDate)) / (1000 * 60 * 60 * 24))
            : null;
          return { ...s, lastInterviewDate: lastDate || null, daysSince };
        }));
      } else {
        setInterviewStudents([]);
      }
    } catch {
      toast.error('Failed to load students');
    } finally {
      setInterviewLoading(false);
    }
  };

  useEffect(() => {
    api.get('/students/track-stats')
      .then((r) => setStats(r.data))
      .catch(() => toast.error('Failed to load track stats'));
  }, []);

  if (!stats) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  );

  const totalTarget = stats.subjects.reduce((s, x) => s + x.target, 0);
  const totalAdmitted = stats.subjects.reduce((s, x) => s + x.admitted, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalAdmitted / totalTarget) * 100) : 0;
  const pctColor = overallPct >= 75 ? 'bg-emerald-500' : overallPct >= 40 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="space-y-8">

      {/* Interview Attempts Drawer */}
      <BottomSheet
        open={interviewDrawer}
        onClose={() => setInterviewDrawer(false)}
        title="Interview Attempts"
        subtitle={`${stats.interviewAttempts || 0} students — ${user?.track}`}
        maxWidth="max-w-2xl"
      >
        {interviewLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : interviewStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
            <FiClipboard size={36} />
            <p className="text-sm">Koi student nahi mila</p>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {interviewStudents.map((s, i) => (
              <div key={s._id}
                onClick={() => navigate(`/students/${s._id}`)}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-orange-50/40 hover:border-orange-200 transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-600 shrink-0">
                  {s.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 truncate">{s.fatherName} · {s.trackName || s.track}</p>
                  {s.lastInterviewDate && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Last: {new Date(s.lastInterviewDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      <span className={`ml-1.5 font-semibold ${
                        s.daysSince <= 7 ? 'text-emerald-600' :
                        s.daysSince <= 30 ? 'text-amber-600' : 'text-rose-500'
                      }`}>({s.daysSince}d ago)</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                    {s.status}
                  </span>
                  {s.interviewCount > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
                      Round {s.interviewCount}
                    </span>
                  )}
                  <FiExternalLink size={13} className="text-gray-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">My Track Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">{user?.track} — detailed overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm bg-orange-50 text-primary font-bold px-3 py-1.5 rounded-full border border-orange-100 shrink-0">
            🏆 {stats.points} pts
          </span>
          <AttendanceButton />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-4">
        {STAT_META.map(({ key, label, icon: Icon, iconBg, iconColor, text, border, hoverShadow, href }) => (
          <div key={key}
            onClick={() => key === 'interviewAttempts' ? openInterviewDrawer() : navigate(href)}
            className={`group relative h-[130px] bg-white rounded-2xl border ${border} ${hoverShadow} shadow-sm p-4 flex flex-col transition-all duration-300 hover:-translate-y-1 cursor-pointer`}>
            <div className="flex items-start justify-between w-full">
              <div className={`w-10 h-10 rounded-xl ${iconBg} border border-transparent group-hover:border-white/50 flex items-center justify-center transition-all duration-300`}>
                <Icon size={18} className={`${iconColor} group-hover:scale-110 transition-transform duration-300`} />
              </div>
            </div>
            <div className="mt-2.5">
              <p className={`text-[10px] font-bold uppercase tracking-wide leading-tight ${text}`}>{label}</p>
            </div>
            <div className="absolute bottom-[10px] left-4">
              <p className="text-2xl font-bold text-gray-800">{stats[key] ?? 0}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Subject-wise Target Progress */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Subject-wise Target Progress</h3>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          {/* Card Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-800 text-sm">{stats.track}</p>
              <p className="text-xs text-gray-400 mt-0.5">{totalAdmitted} / {totalTarget} admitted</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
              <FiTarget size={15} className="text-primary" />
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-400 font-medium">Overall Progress</span>
              <span className="font-bold text-gray-700">{overallPct}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div className={`h-2.5 rounded-full transition-all duration-700 ${pctColor}`}
                style={{ width: `${Math.min(overallPct, 100)}%` }} />
            </div>
          </div>

          {/* Subject rows */}
          <div className="divide-y divide-gray-50 mt-2">
            {stats.subjects.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No targets set for this track yet.</div>
            ) : stats.subjects.map(({ subject, target, admitted }) => {
              const sPct = target > 0 ? Math.round((admitted / target) * 100) : 0;
              const sBadgeColor = sPct >= 75 ? 'bg-emerald-50 text-emerald-600' : sPct >= 40 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-500';
              return (
                <div key={subject} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/70 transition-colors">
                  <span
                    onClick={() => navigate(`/students?subjectFilter=${encodeURIComponent(subject)}&status=Admitted&track=${encodeURIComponent(stats.track)}`)}
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${SUBJECT_COLORS[subject] || 'bg-gray-100 text-gray-600'}`}>
                    {subject}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-100 rounded-full h-1.5 hidden sm:block">
                      <div className="h-1.5 rounded-full bg-primary/60 transition-all duration-500"
                        style={{ width: `${Math.min(sPct, 100)}%` }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums text-gray-700">{admitted}/{target}</span>
                    <span className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md ${sBadgeColor}`}>
                      {sPct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status + Funnel Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <FiUsers size={15} className="text-primary" />
            <p className="text-sm font-bold text-gray-800">Status Breakdown</p>
          </div>
          <div className="divide-y divide-gray-50">
            {(stats.statusBreakdown || []).sort((a, b) => b.count - a.count).map(({ status, count }) => (
              <div key={status} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
                  {status}
                </span>
                <span className="text-sm font-bold text-gray-800 tabular-nums">{count} students</span>
              </div>
            ))}
            {(stats.statusBreakdown || []).length === 0 && (
              <p className="px-5 py-6 text-center text-gray-400 text-sm">No data</p>
            )}
          </div>
        </div>

        {/* Funnel Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <FiTrendingUp size={15} className="text-primary" />
            <p className="text-sm font-bold text-gray-800">Funnel Stage Breakdown</p>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.callingPointsCount > 0 && (
              <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-100">
                    Calling (with remark)
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800 tabular-nums">{stats.callingPointsCount} students</p>
                  <p className="text-xs text-primary font-semibold">+{stats.callingPointsCount * 5} pts</p>
                </div>
              </div>
            )}
            {(stats.funnelBreakdown || []).sort((a, b) => b.totalPoints - a.totalPoints).map(({ stage, count, pointsPerStudent, totalPoints }) => (
              <div key={stage} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${FUNNEL_COLORS[stage] || 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                    {stage}
                  </span>
                  <span className="text-xs text-gray-400">(×{pointsPerStudent} pts)</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800 tabular-nums">{count} students</p>
                  <p className="text-xs text-primary font-semibold">+{totalPoints} pts</p>
                </div>
              </div>
            ))}
            {(stats.funnelBreakdown || []).length === 0 && !stats.callingPointsCount && (
              <p className="px-5 py-6 text-center text-gray-400 text-sm">No funnel data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
