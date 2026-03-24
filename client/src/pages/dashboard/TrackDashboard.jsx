import { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { FiUsers, FiFileText, FiCheckCircle, FiAward, FiXCircle, FiTarget, FiSlash } from 'react-icons/fi';

const SUBJECT_COLORS = {
  'B.Tech': 'bg-blue-100 text-blue-700',
  'BCA':    'bg-violet-100 text-violet-700',
  'BBA':    'bg-amber-100 text-amber-700',
  'Bcom':   'bg-emerald-100 text-emerald-700',
  'Bio':    'bg-rose-100 text-rose-700',
  'Micro':  'bg-cyan-100 text-cyan-700',
};

const STAT_META = [
  { key: 'total',    label: 'Total',    icon: FiUsers,       gradient: 'from-blue-500 to-blue-600',    text: 'text-blue-600' },
  { key: 'applied',  label: 'Applied',  icon: FiFileText,    gradient: 'from-amber-500 to-orange-500', text: 'text-amber-600' },
  { key: 'verified', label: 'Verified', icon: FiCheckCircle, gradient: 'from-violet-500 to-purple-600',text: 'text-violet-600' },
  { key: 'admitted', label: 'Admitted', icon: FiAward,       gradient: 'from-emerald-500 to-green-600',text: 'text-emerald-600' },
  { key: 'rejected', label: 'Rejected', icon: FiXCircle,     gradient: 'from-rose-500 to-red-600',     text: 'text-rose-600' },
  { key: 'disabled', label: 'Disabled', icon: FiSlash,       gradient: 'from-gray-500 to-gray-600',    text: 'text-gray-600' },
];

export default function TrackDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);

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
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Track Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">{user?.track} — detailed overview</p>
        </div>
        <span className="text-sm bg-orange-50 text-primary font-bold px-3 py-1.5 rounded-full border border-orange-100">
          🏆 {stats.points} pts
        </span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {STAT_META.map(({ key, label, icon: Icon, gradient, text }) => (
          <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
              <p className={`text-3xl font-bold mt-0.5 ${text}`}>{stats[key] ?? 0}</p>
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
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SUBJECT_COLORS[subject] || 'bg-gray-100 text-gray-600'}`}>
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
    </div>
  );
}
