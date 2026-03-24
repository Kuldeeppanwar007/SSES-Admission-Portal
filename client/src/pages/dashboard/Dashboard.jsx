import { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FiUsers, FiFileText, FiCheckCircle, FiAward, FiXCircle, FiTarget } from 'react-icons/fi';

const SUBJECT_COLORS = {
  'B.Tech': 'bg-blue-100 text-blue-700',
  'BCA':    'bg-violet-100 text-violet-700',
  'BBA':    'bg-amber-100 text-amber-700',
  'Bcom':   'bg-emerald-100 text-emerald-700',
  'Bio':    'bg-rose-100 text-rose-700',
  'Micro':  'bg-cyan-100 text-cyan-700',
};

const STAT_META = [
  { key: 'total',    label: 'Total Students', icon: FiUsers,       gradient: 'from-blue-500 to-blue-600',   bg: 'bg-blue-50',   text: 'text-blue-600' },
  { key: 'applied',  label: 'Applied',         icon: FiFileText,    gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-50',  text: 'text-amber-600' },
  { key: 'verified', label: 'Verified',         icon: FiCheckCircle, gradient: 'from-violet-500 to-purple-600',bg: 'bg-violet-50', text: 'text-violet-600' },
  { key: 'admitted', label: 'Admitted',         icon: FiAward,       gradient: 'from-emerald-500 to-green-600',bg: 'bg-emerald-50',text: 'text-emerald-600' },
  { key: 'rejected', label: 'Rejected',         icon: FiXCircle,     gradient: 'from-rose-500 to-red-600',    bg: 'bg-rose-50',   text: 'text-rose-600' },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/students/stats')
      .then((r) => setStats(r.data))
      .catch(() => toast.error('Failed to load stats'));
  }, []);

  if (!stats) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">Overview of all admissions</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAT_META.map(({ key, label, icon: Icon, gradient, bg, text }) => (
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

      {/* Track-wise */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Track-wise Progress</h3>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {(stats.trackWise || []).length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <FiAward size={22} className="text-primary" />
            </div>
            <p className="text-gray-500 text-sm">No targets set yet.</p>
            <p className="text-gray-400 text-xs mt-1">Go to <span className="text-primary font-semibold">Targets</span> page to set targets.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {(stats.trackWise || []).map(({ track, subjects = [], points }) => {
              const totalTarget = subjects.reduce((s, x) => s + x.target, 0);
              const totalAdmitted = subjects.reduce((s, x) => s + x.admitted, 0);
              const pct = totalTarget > 0 ? Math.round((totalAdmitted / totalTarget) * 100) : 0;
              const pctColor = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';

              return (
                <div key={track} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  {/* Card Header — same as Targets page */}
                  <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{track}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {totalAdmitted} / {totalTarget} admitted
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-orange-50 text-primary font-bold px-2 py-0.5 rounded-full border border-orange-100">
                        🏆 {points || 0}
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                        <FiTarget size={15} className="text-primary" />
                      </div>
                    </div>
                  </div>

                  {/* Overall progress bar */}
                  <div className="px-5 pt-3 pb-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Overall Progress</span>
                      <span className="font-semibold text-gray-600">{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all duration-700 ${pctColor}`}
                        style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>

                  {/* Subject rows — same style as Targets page */}
                  <div className="divide-y divide-gray-50 mt-2">
                    {subjects.map(({ subject, target, admitted }) => {
                      const sPct = target > 0 ? Math.round((admitted / target) * 100) : 0;
                      return (
                        <div key={subject} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/70 transition-colors">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SUBJECT_COLORS[subject] || 'bg-gray-100 text-gray-600'}`}>
                            {subject}
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="w-20 bg-gray-100 rounded-full h-1.5 hidden sm:block">
                              <div className="h-1.5 rounded-full bg-primary/60 transition-all duration-500"
                                style={{ width: `${Math.min(sPct, 100)}%` }} />
                            </div>
                            <span className="text-xs font-bold tabular-nums text-gray-700">{admitted}/{target}</span>
                            <span className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                              sPct >= 75 ? 'bg-emerald-50 text-emerald-600' :
                              sPct >= 40 ? 'bg-amber-50 text-amber-600' :
                              'bg-rose-50 text-rose-500'
                            }`}>{sPct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
