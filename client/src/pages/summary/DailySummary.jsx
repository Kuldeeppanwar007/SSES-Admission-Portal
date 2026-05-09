import { useState, useEffect } from 'react';
import { FiCalendar, FiUsers, FiEdit, FiCheckCircle, FiActivity, FiPhone, FiAward, FiTrendingUp, FiRefreshCw, FiX, FiChevronDown, FiFilter } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const PRIMARY = '#f97316';
const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b'];

/* ─── Slide-in Drawer ─── */
function Drawer({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className={`fixed inset-0 z-50 transition-all duration-300 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      {/* Overlay */}
      <div className={`absolute inset-0 bg-black/20 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />

      {/* Panel — notification style */}
      <div
        className="fixed right-0 w-full max-w-sm bg-white z-50 flex flex-col shadow-2xl
                   md:max-w-2xl
                   transition-all duration-300 ease-out"
        style={{
          top: 'calc(56px + env(safe-area-inset-top, 0px))',
          height: 'calc(100vh - 56px - env(safe-area-inset-top, 0px))',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            <FiX size={18} className="text-gray-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ─── Reception Entries Table inside Drawer ─── */
function ReceptionDrawerTable({ list, emptyMsg }) {
  if (!list?.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-300 gap-2">
      <FiUsers size={36} />
      <p className="text-sm">{emptyMsg}</p>
    </div>
  );
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-gray-50 z-10">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">#</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Form No.</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Student</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Town</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Branch</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Interviewer</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Entered By</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Time</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {list.map((e, i) => (
          <tr key={e._id || i} className={`transition-colors ${e.studentId?.finalInterview?.result === 'Pass' ? 'bg-green-50 hover:bg-green-100/70' : 'hover:bg-sky-50/30'}`}>
            <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
            <td className="px-4 py-3 font-semibold text-gray-800">{e.admissionFormNo}</td>
            <td className="px-4 py-3 text-gray-700 text-xs font-medium">{e.studentId?.name || '—'}</td>
            <td className="px-4 py-3">
              <span className="text-xs bg-orange-50 text-orange-600 font-semibold px-2 py-0.5 rounded-full">{e.town}</span>
            </td>
            <td className="px-4 py-3 text-gray-600 text-xs">{e.branch || '—'}</td>
            <td className="px-4 py-3 text-gray-600 text-xs">{e.interviewer?.name || '—'}</td>
            <td className="px-4 py-3 text-gray-500 text-xs">{e.enteredBy?.name || '—'}</td>
            <td className="px-4 py-3 text-gray-400 text-xs">
              {new Date(e.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── Student Detail Table inside Drawer ─── */
function DrawerTable({ list, byField, emptyMsg }) {
  if (!list?.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-300 gap-2">
      <FiUsers size={36} />
      <p className="text-sm">{emptyMsg}</p>
    </div>
  );
  const hasResult = list.some(r => r.result);
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-gray-50 z-10">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">#</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Student</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Father</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Branch</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Mobile</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">{byField}</th>
          {hasResult && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Result</th>}
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Time</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {list.map((row, i) => (
          <tr key={i} className={`transition-colors ${row.finalCleared ? 'bg-green-50 hover:bg-green-100/70' : 'hover:bg-orange-50/30'}`}>
            <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {row.name?.[0]?.toUpperCase()}
                </div>
                <span className="font-medium text-gray-800">{row.name}</span>
              </div>
            </td>
            <td className="px-4 py-3 text-gray-500 text-xs">{row.fatherName || '-'}</td>
            <td className="px-4 py-3">
              <span className="text-xs bg-orange-50 text-orange-600 font-semibold px-2 py-0.5 rounded-full">{row.branch || row.track || '-'}</span>
            </td>
            <td className="px-4 py-3 text-gray-500 font-mono text-xs">{row.mobileNo || '-'}</td>
            <td className="px-4 py-3 text-gray-600 text-xs">{row.admittedBy || row.calledBy || row.by || '-'}</td>
            {hasResult && (
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  row.result === 'Pass' ? 'bg-green-100 text-green-700' :
                  row.result === 'Fail' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                }`}>{row.result || '-'} {row.totalMark ? `(${row.totalMark})` : ''}</span>
              </td>
            )}
            <td className="px-4 py-3 text-gray-400 text-xs">
              {new Date(row.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── Stat Card ─── */
function StatCard({ label, value, icon: Icon, iconBg, iconColor, sub, onClick }) {
  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 ${onClick ? 'cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={17} className={iconColor} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-400 mt-1">{onClick ? <span className="text-primary font-medium group-hover:underline">View details →</span> : sub}</p>
      </div>
    </div>
  );
}

/* ─── Progress Bar Row (clickable) ─── */
function ProgressRow({ label, value, max, color, onClick }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div onClick={onClick} className={`flex items-center gap-3 ${onClick ? 'cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors' : ''}`}>
      <span className="text-sm text-gray-600 w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
        <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-semibold w-8 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>)}
    </div>
  );
};

/* ══════════════════════════════════════════ */
export default function DailySummary() {
  const { user } = useAuthStore();
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState('single'); // 'single' | 'range'
  const [date, setDate] = useState(today);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [summary, setSummary] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [receptionEntries, setReceptionEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('admitted');
  const [drawer, setDrawer] = useState({ open: false, title: '', subtitle: '', list: [], byField: '', emptyMsg: '', type: 'student' });
  const [admissionOpen, setAdmissionOpen] = useState(true);
  const [callingOpen, setCallingOpen] = useState(true);
  const [branchFilter, setBranchFilter] = useState('');

  useEffect(() => { fetchData(); }, [date, fromDate, toDate, mode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (mode === 'range' && (!fromDate || !toDate)) { setLoading(false); return; }
      const params = mode === 'range' ? `from=${fromDate}&to=${toDate}` : `date=${date}`;
      const fetchDate = mode === 'range' ? (fromDate || today) : date;
      const requests = [
        api.get(`/daily-summary?${params}`),
        api.get('/daily-summary/weekly'),
        api.get(`/reception?${params}`),
      ];
      const [s, w, r] = await Promise.all(requests);
      setSummary(s.data);
      setWeeklyData(w.data);
      setReceptionEntries(r?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  const openDrawer = (title, subtitle, list, byField, emptyMsg, type = 'student') =>
    setDrawer({ open: true, title, subtitle, list: list || [], byField, emptyMsg, type });
  const closeDrawer = () => setDrawer(d => ({ ...d, open: false }));

  const weeklyChartData = weeklyData?.data?.map((d, i) => ({
    date: weeklyData.days[i].slice(5),
    Students: d.studentsAdded,
    Changes: d.statusChanges,
    Interviews: d.interviews,
  })) || [];

  const donutData = summary?.statusBreakdown?.map(s => ({ name: s._id || 'Unknown', value: s.count })) || [];
  const totalDonut = donutData.reduce((a, b) => a + b.value, 0);
  const maxAdmitted = Math.max(...(summary?.branchWiseAdmitted?.map(b => b.count) || [1]), 1);
  const maxCalling  = Math.max(...(summary?.branchWiseCalling?.map(b => b.count) || [1]), 1);
  const activeList  = activeTab === 'admitted' ? summary?.admittedList : summary?.callingList;
  const receptionBranches = [...new Set(receptionEntries.map(e => e.branch).filter(Boolean))].sort();
  const filteredReceptionEntries = branchFilter
    ? receptionEntries.filter(e => e.branch === branchFilter)
    : receptionEntries;
  const displayDate = mode === 'range'
    ? (fromDate && toDate
        ? fromDate === toDate
          ? new Date(fromDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : `${new Date(fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} → ${new Date(toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : 'Select date range')
    : new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      <p className="text-sm text-gray-400">Loading summary...</p>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Drawer ── */}
      <Drawer open={drawer.open} onClose={closeDrawer} title={drawer.title} subtitle={drawer.subtitle}>
        {drawer.type === 'reception'
          ? <ReceptionDrawerTable list={drawer.list} emptyMsg={drawer.emptyMsg} />
          : <DrawerTable list={drawer.list} byField={drawer.byField} emptyMsg={drawer.emptyMsg} />}
      </Drawer>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Daily Summary</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {displayDate}
            {user?.role === 'track_incharge' && user?.track && (
              <span className="ml-2 bg-orange-50 text-primary border border-orange-100 font-semibold px-2 py-0.5 rounded-full">
                {user.track} only
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={fetchData} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-primary hover:border-primary transition-colors">
            <FiRefreshCw size={15} />
          </button>
          {/* Mode Toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            <button
              onClick={() => setMode('single')}
              className={`px-3 py-2 transition-colors ${
                mode === 'single' ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >Single</button>
            <button
              onClick={() => setMode('range')}
              className={`px-3 py-2 transition-colors ${
                mode === 'range' ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >Range</button>
          </div>
          {/* Date Input(s) */}
          {mode === 'single' ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
              <FiCalendar size={14} className="text-gray-400" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="text-sm text-gray-700 outline-none bg-transparent" />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
              <FiCalendar size={14} className="text-gray-400" />
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="text-sm text-gray-700 outline-none bg-transparent" />
              <span className="text-gray-400 text-xs">→</span>
              <input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)}
                className="text-sm text-gray-700 outline-none bg-transparent" />
            </div>
          )}
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Students Added" value={summary?.studentsAdded || 0} icon={FiUsers}
          iconBg="bg-blue-50" iconColor="text-blue-500"
          onClick={() => openDrawer('Students Added Today', `${date} — ${summary?.studentsAdded || 0} new students`,
            summary?.studentsAddedList, 'Added By', 'No students added today')}
        />
        <StatCard label="Admitted Today" value={summary?.admittedList?.length || 0} icon={FiAward}
          iconBg="bg-green-50" iconColor="text-green-500"
          onClick={() => openDrawer('Admitted Students', `${date} — ${summary?.admittedList?.length || 0} admissions`,
            summary?.admittedList, 'Admitted By', 'No admissions today')}
        />
        <StatCard label="Calling Today" value={summary?.callingList?.length || 0} icon={FiPhone}
          iconBg="bg-yellow-50" iconColor="text-yellow-500"
          onClick={() => openDrawer('Calling Students', `${date} — ${summary?.callingList?.length || 0} students called`,
            summary?.callingList, 'Called By', 'No calling today')}
        />
        <StatCard label="Status Changes" value={summary?.statusChanges || 0} icon={FiActivity}
          iconBg="bg-orange-50" iconColor="text-orange-500"
          onClick={() => openDrawer('Status Changes Today', `${date} — ${summary?.statusChanges || 0} unique changes`,
            summary?.statusBreakdown?.flatMap(s =>
              (s._id === 'Admitted' ? summary.admittedList?.map(x => ({ ...x, _status: s._id })) :
               s._id === 'Calling'  ? summary.callingList?.map(x => ({ ...x, _status: s._id })) : []) || []
            ), 'Changed By', 'No status changes today')}
        />
        <StatCard label="Interviews" value={summary?.interviewsCount || 0} icon={FiCheckCircle}
          iconBg="bg-indigo-50" iconColor="text-indigo-500"
          onClick={() => openDrawer('Interviews Today', `${date} — ${summary?.interviewsCount || 0} interviews conducted`,
            summary?.interviewsList, 'Interviewer', 'No interviews today')}
        />
        <StatCard label="Edit Requests" value={summary?.editRequestsCount || 0} icon={FiEdit}
          iconBg="bg-purple-50" iconColor="text-purple-500" sub="Pending / done" />
      </div>

      {/* ── Track Incharge — My Track Reception ── */}
      {user?.role === 'track_incharge' && summary?.receptionStats && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">My Track — Reception Visitors</span>
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs bg-sky-50 text-sky-600 font-semibold px-2.5 py-1 rounded-full border border-sky-100">{user.track}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Total Visitors', value: summary.receptionStats.total,       icon: FiUsers,       iconBg: 'bg-sky-50',     iconColor: 'text-sky-500',     purpose: null },
              { label: 'Visit',          value: summary.receptionStats.visit,        icon: FiActivity,    iconBg: 'bg-cyan-50',    iconColor: 'text-cyan-500',    purpose: 'Visit' },
              { label: 'Inquiry',        value: summary.receptionStats.inquiry,      icon: FiTrendingUp,  iconBg: 'bg-amber-50',   iconColor: 'text-amber-500',   purpose: 'Inquiry' },
              { label: 'Interview',      value: summary.receptionStats.interview,    icon: FiCheckCircle, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', purpose: 'Interview' },
              { label: 'Re-Interview',   value: summary.receptionStats.reInterview,  icon: FiEdit,        iconBg: 'bg-rose-50',    iconColor: 'text-rose-500',    purpose: 'Re-Interview' },
            ].map(({ label, value, icon: Icon, iconBg, iconColor, purpose }) => (
              <StatCard key={label} label={label} value={value || 0} icon={Icon}
                iconBg={iconBg} iconColor={iconColor}
                onClick={() => openDrawer(
                  `${label} — ${user.track}`,
                  `${displayDate} — ${value || 0} entries`,
                  receptionEntries.filter(e => purpose ? e.visitPurpose === purpose : true),
                  '', 'Koi entry nahi mili', 'reception'
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Reception Stats Cards ── */}
      {summary?.receptionStats && user?.role !== 'track_incharge' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Reception Overview</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total Visitors" value={summary.receptionStats.total || 0} icon={FiUsers}
              iconBg="bg-sky-50" iconColor="text-sky-500"
              onClick={() => openDrawer('Total Visitors', `${displayDate} — ${summary.receptionStats.total || 0} visitors`, receptionEntries, '', 'Koi entry nahi mili', 'reception')}
            />
            <StatCard label="Visit" value={summary.receptionStats.visit || 0} icon={FiActivity}
              iconBg="bg-cyan-50" iconColor="text-cyan-500"
              onClick={() => openDrawer('Visit Entries', `${displayDate} — ${summary.receptionStats.visit || 0} visits`, receptionEntries.filter(e => e.visitPurpose === 'Visit'), '', 'Koi Visit entry nahi mili', 'reception')}
            />
            <StatCard label="Inquiry" value={summary.receptionStats.inquiry || 0} icon={FiTrendingUp}
              iconBg="bg-amber-50" iconColor="text-amber-500"
              onClick={() => openDrawer('Inquiry Entries', `${displayDate} — ${summary.receptionStats.inquiry || 0} inquiries`, receptionEntries.filter(e => e.visitPurpose === 'Inquiry'), '', 'Koi Inquiry entry nahi mili', 'reception')}
            />
            <StatCard label="Interview" value={summary.receptionStats.interview || 0} icon={FiCheckCircle}
              iconBg="bg-emerald-50" iconColor="text-emerald-500"
              onClick={() => openDrawer('Interview Entries', `${displayDate} — ${summary.receptionStats.interview || 0} interviews`, receptionEntries.filter(e => e.visitPurpose === 'Interview'), '', 'Koi Interview entry nahi mili', 'reception')}
            />
            <StatCard label="Re-Interview" value={summary.receptionStats.reInterview || 0} icon={FiEdit}
              iconBg="bg-rose-50" iconColor="text-rose-500"
              onClick={() => openDrawer('Re-Interview Entries', `${displayDate} — ${summary.receptionStats.reInterview || 0} re-interviews`, receptionEntries.filter(e => e.visitPurpose === 'Re-Interview'), '', 'Koi Re-Interview entry nahi mili', 'reception')}
            />
          </div>

          {/* Track-wise Reception Breakdown (admin only) */}
          {summary.trackWiseReception && Object.keys(summary.trackWiseReception).length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Track-wise Breakdown</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {Object.entries(summary.trackWiseReception).map(([track, data]) => (
                  <div key={track} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-primary/20 transition-all">
                    {/* Track header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-800">{track}</span>
                      <span className="text-xs bg-sky-50 text-sky-600 font-bold px-2.5 py-1 rounded-full border border-sky-100">
                        {data.total} visitors
                      </span>
                    </div>
                    {/* 4 purpose rows */}
                    <div className="divide-y divide-gray-50">
                      {[
                        { label: 'Visit',        value: data.visit,       iconBg: 'bg-cyan-50',    iconColor: 'text-cyan-500',    icon: FiActivity,    purpose: 'Visit' },
                        { label: 'Inquiry',      value: data.inquiry,     iconBg: 'bg-amber-50',   iconColor: 'text-amber-500',   icon: FiTrendingUp,  purpose: 'Inquiry' },
                        { label: 'Interview',    value: data.interview,   iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', icon: FiCheckCircle, purpose: 'Interview' },
                        { label: 'Re-Interview', value: data.reInterview, iconBg: 'bg-rose-50',    iconColor: 'text-rose-500',    icon: FiEdit,        purpose: 'Re-Interview' },
                      ].map(({ label, value, iconBg, iconColor, icon: Icon, purpose }) => (
                        <div key={label}
                          onClick={value > 0 ? () => openDrawer(
                            `${track} — ${label}`,
                            `${displayDate} — ${value} entr${value === 1 ? 'y' : 'ies'}`,
                            data.entries.filter(e => e.visitPurpose === purpose).map(e => ({
                              _id: e._id, admissionFormNo: e.admissionFormNo,
                              studentId: { name: e.studentName, finalInterview: e.finalInterview }, town: e.town,
                              branch: e.branch, createdAt: e.createdAt,
                            })),
                            '', 'Koi entry nahi mili', 'reception'
                          ) : undefined}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                            value > 0 ? 'cursor-pointer hover:bg-gray-50 group' : ''
                          }`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                            <Icon size={13} className={iconColor} />
                          </div>
                          <span className="flex-1 text-xs font-medium text-gray-600">{label}</span>
                          <span className="text-sm font-bold text-gray-800 tabular-nums shrink-0">{value}</span>
                          <span className={`text-[10px] text-primary font-semibold transition-opacity shrink-0 w-3 ${
                            value > 0 ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'
                          }`}>→</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Area Chart + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">7-Day Activity Trend</h2>
              <p className="text-xs text-gray-400">Students · Changes · Interviews</p>
            </div>
            <FiTrendingUp size={18} className="text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyChartData}>
              <defs>
                <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Students"   stroke="#f97316" strokeWidth={2} fill="url(#gS)" dot={{ r: 3, fill: '#f97316' }} />
              <Area type="monotone" dataKey="Changes"    stroke="#3b82f6" strokeWidth={2} fill="url(#gC)" dot={{ r: 3, fill: '#3b82f6' }} />
              <Area type="monotone" dataKey="Interviews" stroke="#10b981" strokeWidth={2} fill="url(#gI)" dot={{ r: 3, fill: '#10b981' }} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-2 justify-center">
            {[['Students','#f97316'],['Changes','#3b82f6'],['Interviews','#10b981']].map(([n,c]) => (
              <div key={n} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                <span className="text-xs text-gray-500">{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-800">Status Distribution</h2>
            <p className="text-xs text-gray-400">Today's status changes</p>
          </div>
          {donutData.length > 0 ? (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} dataKey="value" paddingAngle={3}>
                      {donutData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-2xl font-bold text-gray-800">{totalDonut}</p>
                  <p className="text-xs text-gray-400">Total</p>
                </div>
              </div>
              <div className="space-y-1.5 mt-2">
                {donutData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-600">{d.name}</span>
                    </div>
                    <span className="font-semibold text-gray-700">
                      {totalDonut > 0 ? Math.round((d.value / totalDonut) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data</div>
          )}
        </div>
      </div>

      {/* ── Branch Admissions + Calling (clickable rows) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button className="w-full flex items-center justify-between px-5 pt-3 pb-2 hover:bg-gray-50/60 transition-colors" onClick={() => setAdmissionOpen(o => !o)}>
            <div>
              <span className="text-sm font-bold text-gray-700">Branch-wise Admissions</span>
              <p className="text-xs text-gray-400">Total: <strong className="text-green-600">{summary?.admittedList?.length || 0}</strong> — click branch to view students</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-1 rounded-full">Today</span>
              <FiChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${admissionOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {admissionOpen && (
            <div className="px-5 pb-3">
              {summary?.branchWiseAdmitted?.length > 0 ? (
                <div className="space-y-3">
                  {summary.branchWiseAdmitted.map((b, i) => (
                    <ProgressRow key={i} label={b.branch} value={b.count} max={maxAdmitted} color="#10b981"
                      onClick={() => openDrawer(
                        `${b.branch} — Admitted Students`,
                        `${b.count} student${b.count > 1 ? 's' : ''} admitted today`,
                        summary.admittedList.filter(s => s.branch === b.branch),
                        'Admitted By', 'No students'
                      )}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-gray-300 text-sm">No admissions today</div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button className="w-full flex items-center justify-between px-5 pt-3 pb-2 hover:bg-gray-50/60 transition-colors" onClick={() => setCallingOpen(o => !o)}>
            <div>
              <span className="text-sm font-bold text-gray-700">Branch-wise Calling</span>
              <p className="text-xs text-gray-400">Total: <strong className="text-yellow-600">{summary?.callingList?.length || 0}</strong> — click branch to view students</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-yellow-50 text-yellow-600 font-semibold px-2 py-1 rounded-full">Today</span>
              <FiChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${callingOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {callingOpen && (
            <div className="px-5 pb-3">
              {summary?.branchWiseCalling?.length > 0 ? (
                <div className="space-y-3">
                  {summary.branchWiseCalling.map((b, i) => (
                    <ProgressRow key={i} label={b.branch} value={b.count} max={maxCalling} color="#f59e0b"
                      onClick={() => openDrawer(
                        `${b.branch} — Calling Students`,
                        `${b.count} student${b.count > 1 ? 's' : ''} called today`,
                        summary.callingList.filter(s => s.branch === b.branch),
                        'Called By', 'No students'
                      )}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-gray-300 text-sm">No calling today</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Track Bar Chart + User Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-800">Track-wise New Students</h2>
            <p className="text-xs text-gray-400">Added today per track</p>
          </div>
          {summary?.trackWiseAdditions?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summary.trackWiseAdditions.map(t => ({ name: t._id || 'N/A', count: t.count }))} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Students" fill={PRIMARY} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-gray-300 text-sm">No students added today</div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-800">Top Active Users</h2>
            <p className="text-xs text-gray-400">By status changes today</p>
          </div>
          {summary?.userActivity?.length > 0 ? (
            <div className="space-y-2.5">
              {summary.userActivity.slice(0, 6).map((u, i) => {
                const pct = Math.round((u.changes / (summary.userActivity[0]?.changes || 1)) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-gray-700 truncate max-w-[110px]">{u.name}</span>
                      </div>
                      <span className="text-xs font-bold text-primary">{u.changes}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-1.5 rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No activity today</div>
          )}
        </div>
      </div>

      {/* ── Admitted / Calling / Reception Full Table ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex border-b border-gray-100 px-2 pt-2 overflow-x-auto">
          {[
            { key: 'admitted',  label: 'Admitted Students', count: summary?.admittedList?.length || 0,  active: 'text-green-600 border-green-500' },
            { key: 'calling',   label: 'Calling Students',  count: summary?.callingList?.length  || 0,  active: 'text-yellow-600 border-yellow-500' },
            { key: 'reception', label: 'Reception Entries', count: filteredReceptionEntries.length,      active: 'text-sky-600 border-sky-500' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === t.key ? t.active : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === t.key ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'
              }`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          {activeTab === 'reception' ? (
            <>
              {/* Branch Filter Bar */}
                {receptionEntries.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 flex-wrap">
                    <FiFilter size={13} className="text-gray-400" />
                    <span className="text-xs text-gray-400">Branch:</span>
                    {['', ...receptionBranches].map(b => (
                      <button key={b || 'all'} onClick={() => setBranchFilter(b)}
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                          branchFilter === b
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {b || 'All'}
                      </button>
                    ))}
                  </div>
                )}
                {filteredReceptionEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-300 gap-2">
                    <FiUsers size={36} />
                    <p className="text-sm">Koi reception entry nahi mili</p>
                  </div>
                ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Form No.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Town</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Visit Purpose</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Branch</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Interviewer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Entered By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredReceptionEntries.map((e, i) => (
                      <tr key={e._id} className={`transition-colors ${e.studentId?.finalInterview?.result === 'Pass' ? 'bg-green-50 hover:bg-green-100/70' : 'hover:bg-sky-50/30'}`}>
                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{e.admissionFormNo}</td>
                        <td className="px-4 py-3 text-gray-700 text-xs font-medium">{e.studentId?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-orange-50 text-orange-600 font-semibold px-2 py-0.5 rounded-full">{e.town}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            e.visitPurpose === 'Interview'    ? 'bg-emerald-100 text-emerald-700' :
                            e.visitPurpose === 'Re-Interview' ? 'bg-rose-100 text-rose-700' :
                            e.visitPurpose === 'Inquiry'      ? 'bg-amber-100 text-amber-700' :
                            'bg-sky-100 text-sky-700'
                          }`}>{e.visitPurpose}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{e.branch || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{e.interviewer?.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{e.enteredBy?.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(e.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
              </>
          ) : (
            <DrawerTable
              list={activeTab === 'admitted' ? summary?.admittedList : summary?.callingList}
              byField={activeTab === 'admitted' ? 'Admitted By' : 'Called By'}
              emptyMsg={activeTab === 'admitted' ? 'No admissions today' : 'No calling today'}
            />
          )}
        </div>
      </div>

    </div>
  );
}
