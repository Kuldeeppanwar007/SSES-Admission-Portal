import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { FiUsers, FiFileText, FiAward, FiXCircle, FiTarget, FiSlash, FiChevronDown, FiGift, FiClock } from 'react-icons/fi';
import { TRACK_TOWNS } from '../../utils/constants';

// SSISM branch capacity limits
const SSISM_BRANCHES = [
  { label: 'BCA',           subject: 'BCA',   limit: 120, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', bar: 'bg-violet-500' },
  { label: 'BBA',           subject: 'BBA',   limit: 120, color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  bar: 'bg-amber-500'  },
  { label: 'BSC (BT)',      subject: 'Bio',   limit: 60,  color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-200',   bar: 'bg-rose-500'   },
  { label: 'BSC (MICRO)',   subject: 'Micro', limit: 60,  color: 'text-cyan-600',   bg: 'bg-cyan-50',   border: 'border-cyan-200',   bar: 'bg-cyan-500'   },
  { label: 'B.COM (CA)',    subject: 'Bcom',  limit: 60,  color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200',bar: 'bg-emerald-500'},
  { label: 'ITEG DIPLOMA',  subject: 'ITEG Diploma', limit: null,color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   bar: 'bg-blue-500'   },
];

function CapacityCard({ label, admitted, limit, color, bg, border, bar }) {
  const remaining = limit !== null ? Math.max(0, limit - admitted) : null;
  const pct       = limit ? Math.min(Math.round((admitted / limit) * 100), 100) : null;
  const isFull    = limit !== null && remaining === 0;
  return (
    <div className={`bg-white rounded-2xl border ${border} shadow-sm p-4 flex flex-col gap-2`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${color}`}>{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-800">{admitted}</p>
          <p className="text-xs text-gray-400">{limit !== null ? `of ${limit}` : 'No limit set'}</p>
        </div>
        {remaining !== null && (
          <p className={`text-sm font-bold ${isFull ? 'text-rose-500' : 'text-emerald-600'}`}>
            {isFull ? 'Full' : `${remaining} left`}
          </p>
        )}
      </div>
      {pct !== null && (
        <div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all duration-700 ${isFull ? 'bg-rose-500' : bar}`}
              style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">{pct}%</p>
        </div>
      )}
    </div>
  );
}

function SSISMCapacityCards({ trackWise }) {
  const admittedBySubject = {};
  (trackWise || []).forEach(({ subjects }) => {
    (subjects || []).forEach(({ subject, admitted }) => {
      admittedBySubject[subject] = (admittedBySubject[subject] || 0) + (admitted || 0);
    });
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">SSISM Branch Capacity</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SSISM_BRANCHES.map((b) => (
          <CapacityCard key={b.label} {...b} admitted={admittedBySubject[b.subject] || 0} />
        ))}
      </div>
    </div>
  );
}

const BTECH_BRANCHES = [
  { label: 'B.Tech (CS)',    subject: 'B.Tech(CS)',    limit: 60, color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   bar: 'bg-blue-500'   },
  { label: 'B.Tech (IT)',    subject: 'B.Tech(IT)',    limit: 60, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', bar: 'bg-indigo-500' },
  { label: 'B.Tech (ECE)',   subject: 'B.Tech(ECE)',   limit: 60, color: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-200',   bar: 'bg-teal-500'   },
  { label: 'B.Tech (AI/ML)', subject: 'B.Tech(AI/ML)', limit: 60, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', bar: 'bg-purple-500' },
];

function BTechCapacityCards({ trackWise }) {
  const admittedBySubject = {};
  (trackWise || []).forEach(({ subjects }) => {
    (subjects || []).forEach(({ subject, admitted }) => {
      admittedBySubject[subject] = (admittedBySubject[subject] || 0) + (admitted || 0);
    });
  });
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">B.Tech Branch Capacity</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BTECH_BRANCHES.map((b) => (
          <CapacityCard key={b.label} {...b} admitted={admittedBySubject[b.subject] || 0} />
        ))}
      </div>
    </div>
  );
}

const SUBJECT_COLORS = {
  'B.Tech(CS)': 'bg-blue-100 text-blue-700',
  'B.Tech(IT)': 'bg-indigo-100 text-indigo-700',
  'B.Tech(ECE)':'bg-teal-100 text-teal-700',
  'AI/ML':      'bg-purple-100 text-purple-700',
  'BCA':        'bg-violet-100 text-violet-700',
  'BBA':        'bg-amber-100 text-amber-700',
  'Bcom':       'bg-emerald-100 text-emerald-700',
  'Bio':        'bg-rose-100 text-rose-700',
  'Micro':      'bg-cyan-100 text-cyan-700',
};

const STAT_META = [
  { key: 'total',    label: 'Total Students', icon: FiUsers,       iconBg: 'bg-blue-100',    iconColor: 'text-blue-500',   text: 'text-blue-600' },
  { key: 'applied',  label: 'Applied',         icon: FiFileText,    iconBg: 'bg-amber-100',   iconColor: 'text-amber-500',  text: 'text-amber-600' },
  { key: 'admitted', label: 'Admitted',         icon: FiAward,       iconBg: 'bg-emerald-100', iconColor: 'text-emerald-500',text: 'text-emerald-600' },
  { key: 'rejected', label: 'Rejected',         icon: FiXCircle,     iconBg: 'bg-rose-100',    iconColor: 'text-rose-500',   text: 'text-rose-600' },
  { key: 'disabled', label: 'Disabled',         icon: FiSlash,       iconBg: 'bg-gray-100',    iconColor: 'text-gray-400',   text: 'text-gray-500' },
];

const BTECH_SUBJECTS = ['B.Tech(CS)', 'B.Tech(IT)', 'B.Tech(ECE)', 'B.Tech(AI/ML)'];
const SUBJECTS = ['B.Tech', 'BCA', 'BBA', 'Bcom', 'Bio', 'Micro'];
const SUBJECT_LABELS = { 'B.Tech': 'BTech', 'BCA': 'BCA', 'BBA': 'BBA', 'Bcom': 'BCom', 'Bio': 'Bio/BSc', 'Micro': 'Micro' };

const TRACK_GROUP = {
  'Satwas': 1, 'Harda': 1, 'Gopalpur': 1,
  'Khategaon': 2, 'Kannod': 2, 'Bherunda': 2,
  'Timarni': 3, 'Nemawar': 3, 'Narmadapuram': 3, 'Seoni Malva': 3,
};
const SUBJECT_POINTS_BY_GROUP = {
  'B.Tech': [180, 198, 225],
  'BCA':    [120, 132, 150],
  'BBA':    [130, 143, 163],
  'Bcom':   [130, 143, 163],
  'Bio':    [120, 132, 150],
  'Micro':  [120, 132, 150],
};
const getSubjectPoints = (track, subject) => {
  const g = (TRACK_GROUP[track] || 1) - 1;
  return (SUBJECT_POINTS_BY_GROUP[subject] || [0, 0, 0])[g];
};

function PointsTable({ trackWise }) {
  const [open, setOpen] = useState(true);

  // Server se jo actual points aaye hain (TrackPoints collection) unhe use karo
  // Per-subject breakdown ke liye: admitted * (total points / total admitted) nahi,
  // balki sirf total points dikhao — subject-wise breakdown accurate nahi hogi
  // isliye subject column mein admitted count dikhao, Total mein actual DB points
  const tracks = [...trackWise].sort((a, b) => (b.points || 0) - (a.points || 0));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎮</span>
          <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Final Points Table (Tracks as Rows)</span>
        </div>
        <FiChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-gray-50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Center ↓ / Course →</th>
                {SUBJECTS.map((s) => (
                  <th key={s} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    {SUBJECT_LABELS[s]}
                  </th>
                ))}
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tracks.map(({ track, subjects, points, admissionPoints }) => {
                const subjectMap = {};
                (subjects || []).forEach(({ subject, admitted }) => {
                  if (BTECH_SUBJECTS.includes(subject)) {
                    subjectMap['B.Tech'] = (subjectMap['B.Tech'] || 0) + (admitted || 0);
                  } else {
                    subjectMap[subject] = (subjectMap[subject] || 0) + (admitted || 0);
                  }
                });
                return (
                  <tr key={track} className="hover:bg-orange-50/30 transition-colors">
                    <td className="px-5 py-3 font-bold text-gray-800 whitespace-nowrap">
                      {track.toUpperCase()}
                    </td>
                    {SUBJECTS.map((s) => {
                      const admitted = subjectMap[s] || 0;
                      return (
                        <td key={s} className="px-5 py-3 tabular-nums">
                          <span className={admitted > 0 ? 'font-bold text-gray-800' : 'text-gray-300'}>
                            {admitted > 0 ? admitted : '—'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-5 py-3 font-bold text-primary tabular-nums">
                      {admissionPoints || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const RANK_STYLES = [
  { bg: 'bg-amber-400',  text: 'text-white', emoji: '🥇' },
  { bg: 'bg-gray-300',   text: 'text-white', emoji: '🥈' },
  { bg: 'bg-orange-400', text: 'text-white', emoji: '🥉' },
];

function LeaderboardSection({ stats, user }) {
  const [open, setOpen] = useState(false);

  const sorted = [...stats.trackWise].sort((a, b) => (b.points || 0) - (a.points || 0));
  const maxScore = sorted.reduce((m, t) => Math.max(m, t.points || 0), 1);
  const myRank = user?.role === 'track_incharge'
    ? sorted.findIndex((t) => t.track === user.track) + 1
    : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Points Leaderboard</span>
          {myRank && (
            <span className="text-xs bg-orange-50 text-primary font-bold px-2 py-0.5 rounded-full border border-orange-100">
              Your Rank #{myRank}
            </span>
          )}
        </div>
        <FiChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-gray-50">
          {sorted.map(({ track, points, calledCount, totalCount }, i) => {
            const isMe = user?.role === 'track_incharge' && user?.track === track;
            const rank = RANK_STYLES[i] || { bg: 'bg-gray-100', text: 'text-gray-500', emoji: null };
            const barW = Math.round(((points || 0) / maxScore) * 100);
            // breakdown from stats
            const tw = stats.trackWise.find(t => t.track === track) || {};
            const admissionPts = tw.admissionPoints || 0;
            const callingPts   = tw.callingPoints   || 0;
            const funnelPts    = tw.funnelPoints    || 0;
            return (
              <div key={track}
                className={`px-5 py-3 border-b border-gray-50 last:border-0 transition-colors ${
                  isMe ? 'bg-orange-50/60' : 'hover:bg-gray-50/60'
                }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${rank.bg} ${rank.text}`}>
                    {rank.emoji || i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${isMe ? 'text-primary' : 'text-gray-800'}`}>{track}</span>
                      {isMe && <span className="text-xs bg-orange-100 text-primary font-bold px-1.5 py-0.5 rounded-full">You</span>}
                      {totalCount > 0 && <span className="text-xs text-gray-400">📞 {calledCount}/{totalCount}</span>}
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                      <div className={`h-1.5 rounded-full transition-all duration-700 ${isMe ? 'bg-primary' : 'bg-gray-400'}`}
                        style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${isMe ? 'text-primary' : 'text-gray-700'}`}>
                      {points || 0} <span className="text-xs font-medium text-gray-400">pts</span>
                    </p>
                  </div>
                </div>
                {/* Breakdown row — admin only */}
                {user?.role === 'admin' && (
                  <div className="flex gap-3 mt-2 ml-11 flex-wrap">
                    <span className="text-[11px] text-gray-500">
                      🏅 Admission: <span className="font-semibold text-gray-700">{admissionPts}</span>
                    </span>
                    <span className="text-[11px] text-gray-500">
                      📞 Calling: <span className="font-semibold text-gray-700">{callingPts}</span>
                    </span>
                    <span className="text-[11px] text-gray-500">
                      📈 Funnel: <span className="font-semibold text-gray-700">{Math.max(0, funnelPts)}</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [bonusHistory, setBonusHistory] = useState([]);
  const [distributing, setDistributing] = useState(false);

  const fetchStats = () =>
    api.get('/students/stats').then((r) => setStats(r.data)).catch(() => toast.error('Failed to load stats'));

  const fetchBonusHistory = () =>
    api.get('/students/weekly-bonus-history').then((r) => setBonusHistory(r.data)).catch(() => {});

  useEffect(() => {
    fetchStats();
    if (user?.role === 'admin') fetchBonusHistory();
  }, []);

  const handleManualBonus = async () => {
    setDistributing(true);
    try {
      const { data } = await api.post('/students/weekly-bonus-manual', {});
      toast.success(data.message);
      fetchStats();
      fetchBonusHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to distribute bonus');
    } finally { setDistributing(false); }
  };

  const handleRecalculate = async () => {
    if (!window.confirm('Sab track points scratch se recalculate honge. Continue?')) return;
    try {
      const { data } = await api.post('/students/recalculate-points', {});
      toast.success(data.message);
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  if (!stats) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Overview of all admissions</p>
        </div>
        {user?.role === 'admin' && (
          <div />
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAT_META.map(({ key, label, icon: Icon, iconBg, iconColor, text }) => {
          const isClickable = user?.role === 'admin';
          const href = key === 'disabled'
            ? '/students?tab=disabled'
            : key === 'total'
            ? '/students'
            : `/students?status=${key.charAt(0).toUpperCase() + key.slice(1)}`;
          return (
            <div key={key}
              onClick={() => isClickable && navigate(href)}
              className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow ${
                isClickable ? 'cursor-pointer hover:border-orange-200' : ''
              }`}>
              <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
                <Icon size={18} className={iconColor} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                <p className={`text-3xl font-bold mt-0.5 ${text}`}>{stats[key] ?? 0}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* SSISM Branch Capacity */}
      <SSISMCapacityCards trackWise={stats.trackWise || []} />

      {/* B.Tech Branch Capacity */}
      <BTechCapacityCards trackWise={stats.trackWise || []} />

      {/* Points Table */}
      {(stats.trackWise || []).length > 0 && (
        <PointsTable trackWise={stats.trackWise} />
      )}

      {/* Points Leaderboard */}
      {(stats.trackWise || []).some((t) => t.points > 0) && (
        <LeaderboardSection stats={stats} user={user} />
      )}

      {/* Admin — Manual Weekly Bonus */}
      {user?.role === 'admin' && (() => {
        const thisWeekStart = (() => {
          const now = new Date();
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const m = new Date(now); m.setDate(diff); m.setHours(0,0,0,0);
          return m.toDateString();
        })();
        const alreadyDone = bonusHistory.some((w) => new Date(w.weekStart).toDateString() === thisWeekStart);
        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                  <FiGift size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Weekly Bonus Distribution</p>
                  <p className="text-xs text-gray-400">Top 3 tracks — 🥇 +200 &nbsp;🥈 +150 &nbsp;🥉 +100 pts</p>
                </div>
              </div>
              <button onClick={handleManualBonus} disabled={distributing || alreadyDone}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shrink-0 ${
                  alreadyDone
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                    : 'bg-primary text-white hover:bg-primary-dark shadow-orange-200 disabled:opacity-60'
                }`}>
                <FiGift size={14} />
                <span className="hidden sm:inline">{alreadyDone ? 'Already Distributed This Week' : distributing ? 'Distributing...' : 'Distribute Now'}</span>
                <span className="sm:hidden">{alreadyDone ? 'Done' : distributing ? '...' : 'Distribute'}</span>
              </button>
            </div>

            {/* Bonus History */}
            {bonusHistory.length > 0 && (
              <div className="divide-y divide-gray-50">
                {bonusHistory.map((week) => (
                  <div key={week._id} className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <FiClock size={12} />
                      <span>Week of {new Date(week.weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {week.bonuses.map((b) => (
                        <span key={b.track} className="text-xs bg-orange-50 text-primary border border-orange-100 px-2 py-0.5 rounded-full font-semibold">
                          {b.rank === 1 ? '🥇' : b.rank === 2 ? '🥈' : '🥉'} {b.track} +{b.points}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

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
              const isClickable = user?.role === 'admin';

              return (
                <div key={track}
                  onClick={() => isClickable && navigate(`/admin-track/${track}`)}
                  className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow ${
                    isClickable ? 'cursor-pointer hover:border-orange-200' : ''
                  }`}>
                  {/* Card Header */}
                  <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-bold text-gray-800 text-sm">{track}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-orange-50 text-primary font-bold px-2 py-0.5 rounded-full border border-orange-100">
                          🏆 {points || 0}
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                          <FiTarget size={15} className="text-primary" />
                        </div>
                      </div>
                    </div>
                    {/* Towns */}
                    {(TRACK_TOWNS[track] || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {(TRACK_TOWNS[track] || []).map((town) => (
                          <span key={town} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-primary border border-orange-100">
                            {town}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400">{totalAdmitted} / {totalTarget} admitted</p>
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
