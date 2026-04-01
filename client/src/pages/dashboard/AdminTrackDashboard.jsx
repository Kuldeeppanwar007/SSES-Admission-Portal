import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { TRACKS } from '../../utils/constants';
import { FiUsers, FiFileText, FiAward, FiXCircle, FiTarget, FiSlash, FiChevronDown, FiTrendingUp } from 'react-icons/fi';

const SUBJECT_COLORS = {
  'B.Tech': 'bg-blue-100 text-blue-700',
  'BCA':    'bg-violet-100 text-violet-700',
  'BBA':    'bg-amber-100 text-amber-700',
  'Bcom':   'bg-emerald-100 text-emerald-700',
  'Bio':    'bg-rose-100 text-rose-700',
  'Micro':  'bg-cyan-100 text-cyan-700',
};

const STATUS_COLORS = {
  Applied:  'bg-yellow-100 text-yellow-700',
  Calling:  'bg-purple-100 text-purple-700',
  Verified: 'bg-blue-100 text-blue-700',
  Admitted: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
  Disabled: 'bg-gray-100 text-gray-600',
};

const FUNNEL_COLORS = {
  'Call Completed':   'bg-purple-50 text-purple-700 border-purple-100',
  'Lead Interested':  'bg-blue-50 text-blue-700 border-blue-100',
  'Visit Scheduled':  'bg-amber-50 text-amber-700 border-amber-100',
  'Visit Completed':  'bg-orange-50 text-primary border-orange-100',
  'Admission Closed': 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const STAT_META = [
  { key: 'total',    label: 'Total',    icon: FiUsers,    iconBg: 'bg-blue-100',    iconColor: 'text-blue-500',   text: 'text-blue-600' },
  { key: 'applied',  label: 'Applied',  icon: FiFileText, iconBg: 'bg-amber-100',   iconColor: 'text-amber-500',  text: 'text-amber-600' },
  { key: 'admitted', label: 'Admitted', icon: FiAward,    iconBg: 'bg-emerald-100', iconColor: 'text-emerald-500',text: 'text-emerald-600' },
  { key: 'rejected', label: 'Rejected', icon: FiXCircle,  iconBg: 'bg-rose-100',    iconColor: 'text-rose-500',   text: 'text-rose-600' },
  { key: 'disabled', label: 'Disabled', icon: FiSlash,    iconBg: 'bg-gray-100',    iconColor: 'text-gray-400',   text: 'text-gray-500' },
];

export default function AdminTrackDashboard() {
  const { track } = useParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setStats(null);
    api.get('/students/track-stats', { params: { track } })
      .then((r) => setStats(r.data))
      .catch(() => toast.error('Failed to load track stats'));
  }, [track]);

  const totalTarget = stats?.subjects.reduce((s, x) => s + x.target, 0) || 0;
  const totalAdmitted = stats?.subjects.reduce((s, x) => s + x.admitted, 0) || 0;
  const overallPct = totalTarget > 0 ? Math.round((totalAdmitted / totalTarget) * 100) : 0;
  const pctColor = overallPct >= 75 ? 'bg-emerald-500' : overallPct >= 40 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">{track} — Track Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Individual track overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm bg-orange-50 text-primary font-bold px-3 py-1.5 rounded-full border border-orange-100 shrink-0">
            🏆 {stats?.points || 0} pts
          </span>
          <div className="relative">
            <select value={track}
              onChange={(e) => navigate(`/admin-track/${e.target.value}`)}
              className="appearance-none border border-gray-200 rounded-xl px-3 py-2 pr-8 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 cursor-pointer">
              {TRACKS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <FiChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {!stats ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {STAT_META.map(({ key, label, icon: Icon, iconBg, iconColor, text }) => (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
                  <Icon size={18} className={iconColor} />
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

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800 text-sm">{stats.track}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{totalAdmitted} / {totalTarget} admitted</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                  <FiTarget size={15} className="text-primary" />
                </div>
              </div>

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
                        <span className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md ${sBadgeColor}`}>{sPct}%</span>
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
                {(stats.statusBreakdown || []).sort((a,b) => b.count - a.count).map(({ status, count }) => (
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
                {/* Calling points row */}
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
                {(stats.funnelBreakdown || []).sort((a,b) => b.totalPoints - a.totalPoints).map(({ stage, count, pointsPerStudent, totalPoints }) => (
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
        </>
      )}
    </div>
  );
}
