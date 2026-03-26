import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FiMapPin, FiCalendar, FiClock, FiFilter, FiBarChart2, FiNavigation, FiRefreshCw } from 'react-icons/fi';

const today = new Date().toISOString().slice(0, 10);
const thisMonth = today.slice(0, 7);
const TRACKS = ['Satwas','Nemawar','Harda','Khategaon','Kannod','Bherunda','Gopalpur','Timarni','Narmadapuram','Seoni Malva'];

const PCT_COLOR = (p) =>
  p >= 75 ? 'bg-emerald-50 text-emerald-700' : p >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600';

const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDate = (ts) => new Date(ts).toLocaleDateString('en-IN');

export default function Attendance() {
  const [tab, setTab] = useState('records');

  // Records tab
  const [records, setRecords] = useState([]);
  const [loadingRec, setLoadingRec] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filterTrack, setFilterTrack] = useState('');

  // Monthly tab
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [month, setMonth] = useState(thisMonth);
  const [monthTrack, setMonthTrack] = useState('');

  // Live Tracking tab
  const [trackUsers, setTrackUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [trackDate, setTrackDate] = useState(today);
  const [locationLogs, setLocationLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchRecords = useCallback(() => {
    setLoadingRec(true);
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to)   params.append('to', to);
    if (filterTrack) params.append('track', filterTrack);
    api.get(`/attendance/all?${params}`)
      .then(r => setRecords(r.data))
      .catch(() => toast.error('Failed to load attendance'))
      .finally(() => setLoadingRec(false));
  }, [from, to, filterTrack]);

  const fetchMonthly = useCallback(() => {
    setLoadingMonth(true);
    const params = new URLSearchParams({ month });
    if (monthTrack) params.append('track', monthTrack);
    api.get(`/attendance/monthly-stats?${params}`)
      .then(r => setMonthlyStats(r.data))
      .catch(() => toast.error('Failed to load monthly stats'))
      .finally(() => setLoadingMonth(false));
  }, [month, monthTrack]);

  const fetchTrackUsers = useCallback(() => {
    api.get('/users?role=track_incharge')
      .then(r => setTrackUsers(r.data?.users || r.data || []))
      .catch(() => {});
  }, []);

  const fetchLocationLogs = useCallback(() => {
    setLoadingLogs(true);
    const params = new URLSearchParams();
    if (selectedUser) params.append('userId', selectedUser);
    if (trackDate) params.append('date', trackDate);
    api.get(`/attendance/location-logs?${params}`)
      .then(r => setLocationLogs(r.data))
      .catch(() => toast.error('Failed to load location logs'))
      .finally(() => setLoadingLogs(false));
  }, [selectedUser, trackDate]);

  useEffect(() => { if (tab === 'records') fetchRecords(); }, [tab, fetchRecords]);
  useEffect(() => { if (tab === 'monthly') fetchMonthly(); }, [tab, fetchMonthly]);
  useEffect(() => { if (tab === 'tracking') { fetchTrackUsers(); fetchLocationLogs(); } }, [tab, fetchTrackUsers, fetchLocationLogs]);

  // Auto-refresh every 2 min when enabled
  useEffect(() => {
    if (tab !== 'tracking' || !autoRefresh) return;
    const id = setInterval(fetchLocationLogs, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [tab, autoRefresh, fetchLocationLogs]);

  const allTracks = [...new Set(records.map(r => r.user?.track).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Track Incharge Attendance</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'records', label: 'Records', icon: FiFilter },
          { key: 'monthly', label: 'Monthly %', icon: FiBarChart2 },
          { key: 'tracking', label: 'Live Tracking', icon: FiNavigation },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors
              ${tab === key ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── RECORDS TAB ── */}
      {tab === 'records' && (
        <>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">From</label>
              <input type="date" value={from} max={to || today}
                onChange={e => setFrom(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">To</label>
              <input type="date" value={to} min={from} max={today}
                onChange={e => setTo(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Track</label>
              <select value={filterTrack} onChange={e => setFilterTrack(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">All Tracks</option>
                {allTracks.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={fetchRecords}
              className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity">
              Apply
            </button>
            <button onClick={() => { setFrom(''); setTo(''); setFilterTrack(''); }}
              className="px-4 py-1.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
              Clear
            </button>
          </div>

          {!loadingRec && (
            <p className="text-xs text-gray-400">{records.length} record{records.length !== 1 ? 's' : ''} found</p>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loadingRec ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : records.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">No attendance records found.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {records.map(r => (
                  <div key={r._id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors flex-wrap gap-3">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{r.user?.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.user?.track}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <FiCalendar size={12} className="text-primary" /> {r.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <FiClock size={12} className="text-primary" /> {r.time}
                      </span>
                      <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-emerald-600 font-semibold hover:underline">
                        <FiMapPin size={12} /> View Location
                      </a>
                      {r.locationSource && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          r.locationSource === 'GPS' ? 'bg-emerald-50 text-emerald-700' :
                          r.locationSource === 'Google' ? 'bg-blue-50 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{r.locationSource}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── MONTHLY TAB ── */}
      {tab === 'monthly' && (
        <>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Month</label>
              <input type="month" value={month} max={thisMonth}
                onChange={e => setMonth(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Track</label>
              <select value={monthTrack} onChange={e => setMonthTrack(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">All Tracks</option>
                {TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={fetchMonthly}
              className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity">
              Apply
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loadingMonth ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : monthlyStats.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">No data for this month.</p>
            ) : (
              <>
                <div className="grid grid-cols-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">
                  <span>Name</span><span>Track</span>
                  <span className="text-center">Present / Days</span>
                  <span className="text-right">Attendance %</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {monthlyStats.sort((a, b) => b.pct - a.pct).map(s => (
                    <div key={s.userId} className="grid grid-cols-4 items-center px-5 py-4 hover:bg-gray-50/60 transition-colors">
                      <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.track}</p>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-bold text-gray-700 tabular-nums">{s.present} / {s.total}</span>
                        <div className="w-24 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full transition-all duration-500 ${s.pct >= 75 ? 'bg-emerald-500' : s.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(s.pct, 100)}%` }} />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full tabular-nums ${PCT_COLOR(s.pct)}`}>
                          {s.pct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── LIVE TRACKING TAB ── */}
      {tab === 'tracking' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">User</label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]">
                <option value="">All Users</option>
                {trackUsers.map(u => (
                  <option key={u._id} value={u._id}>{u.name} ({u.track})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Date</label>
              <input type="date" value={trackDate} max={today}
                onChange={e => setTrackDate(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <button onClick={fetchLocationLogs}
              className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5">
              <FiRefreshCw size={13} /> Refresh
            </button>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
                className="accent-primary" />
              Auto-refresh (2 min)
            </label>
          </div>

          {!loadingLogs && (
            <p className="text-xs text-gray-400">{locationLogs.length} location ping{locationLogs.length !== 1 ? 's' : ''} found</p>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loadingLogs ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : locationLogs.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">No location data for selected filters.</p>
            ) : (
              <>
                <div className="grid grid-cols-5 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">
                  <span>Name</span>
                  <span>Track</span>
                  <span>Date</span>
                  <span>Time</span>
                  <span className="text-right">Status / Location</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {locationLogs.map(log => (
                    <div key={log._id} className={`grid grid-cols-5 items-center px-5 py-3.5 transition-colors ${
                      log.status === 'unavailable' ? 'bg-rose-50 hover:bg-rose-100' : 'hover:bg-gray-50/60'
                    }`}>
                      <p className="text-sm font-semibold text-gray-800">{log.user?.name}</p>
                      <p className="text-xs text-gray-500">{log.user?.track}</p>
                      <p className="text-xs text-gray-500">{formatDate(log.timestamp)}</p>
                      <p className="text-xs text-gray-500">{formatTime(log.timestamp)}</p>
                      <div className="flex items-center gap-2 justify-end">
                        {log.status === 'unavailable' ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-600">
                            ⚠️ Location Off
                          </span>
                        ) : (
                          <>
                            {log.accuracy > 0 && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                log.accuracy <= 20 ? 'bg-emerald-50 text-emerald-700' :
                                log.accuracy <= 50 ? 'bg-amber-50 text-amber-700' :
                                'bg-rose-50 text-rose-600'
                              }`}>±{Math.round(log.accuracy)}m</span>
                            )}
                            <a href={`https://maps.google.com/?q=${log.lat},${log.lng}`}
                              target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-emerald-600 text-xs font-semibold hover:underline">
                              <FiMapPin size={12} /> Map
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
