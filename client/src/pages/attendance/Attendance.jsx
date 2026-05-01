import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FiMapPin, FiCalendar, FiClock, FiFilter, FiBarChart2, FiNavigation, FiRefreshCw, FiActivity, FiAlertCircle } from 'react-icons/fi';
import DatePicker from '../../components/DatePicker';
import TrackingMap from '../../components/TrackingMap';
import CampusMap from '../../components/CampusMap';

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

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2);
};

export default function Attendance() {
  const COLLEGE = { lat: 22.563246, lng: 76.961334 };
  const [tab, setTab] = useState('records');

  // Day View modal
  const [dvModal, setDvModal] = useState(null); // { userId, name, month }
  const [dvData, setDvData] = useState(null);
  const [loadingDv, setLoadingDv] = useState(false);

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

  // Campus Map tab
  const [liveLocations, setLiveLocations] = useState([]);
  const [loadingLive, setLoadingLive] = useState(false);

  // Analytics tab
  const [analyticsDate, setAnalyticsDate]       = useState(today);
  const [analyticsTrack, setAnalyticsTrack]     = useState('');
  const [dailyDist, setDailyDist]               = useState([]);
  const [weeklyDist, setWeeklyDist]             = useState(null);
  const [inactiveUsers, setInactiveUsers]       = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Live Tracking tab
  const [trackUsers, setTrackUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [trackDate, setTrackDate] = useState(today);
  const [locationLogs, setLocationLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [tlData, setTlData] = useState(null);
  const [loadingTl, setLoadingTl] = useState(false);

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
      .then(r => { setTrackUsers(r.data?.users || r.data || []); })
      .catch(() => {});
  }, []);

  const openDayView = (userId, name) => {
    setDvModal({ userId, name, month });
    setDvData(null);
    setLoadingDv(true);
    api.get(`/attendance/day-view?userId=${userId}&month=${month}`)
      .then(r => setDvData(r.data))
      .catch(() => toast.error('Failed to load day view'))
      .finally(() => setLoadingDv(false));
  };

  const changeDvMonth = (dir) => {
    setDvModal(prev => {
      const [y, m] = prev.month.split('-').map(Number);
      const d = new Date(y, m - 1 + dir, 1);
      const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      setDvData(null);
      setLoadingDv(true);
      api.get(`/attendance/day-view?userId=${prev.userId}&month=${newMonth}`)
        .then(r => setDvData(r.data))
        .catch(() => toast.error('Failed to load day view'))
        .finally(() => setLoadingDv(false));
      return { ...prev, month: newMonth };
    });
  };

  const fetchLocationLogs = useCallback(() => {
    setLoadingLogs(true);
    const params = new URLSearchParams();
    if (selectedUser) params.append('userId', selectedUser);
    if (trackDate) params.append('date', trackDate);
    api.get(`/attendance/location-logs?${params}`)
      .then(r => setLocationLogs([...r.data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))))
      .catch(() => toast.error('Failed to load location logs'))
      .finally(() => setLoadingLogs(false));
  }, [selectedUser, trackDate]);

  const fetchTimeline = useCallback(() => {
    if (!selectedUser) return;
    setLoadingTl(true);
    api.get(`/attendance/timeline?userId=${selectedUser}&date=${trackDate}`)
      .then(r => {
        setTlData(r.data);
        // Background geocoding — sirf first, last, stopped points
        const pts = r.data.points;
        const toGeocode = pts
          .map((pt, idx) => ({ idx, lat: pt.lat, lng: pt.lng }))
          .filter((_, idx) => idx === 0 || idx === pts.length - 1 || pts[idx].isStopped);
        if (toGeocode.length === 0) return;
        api.post('/attendance/geocode', { points: toGeocode })
          .then(res => {
            setTlData(prev => {
              if (!prev) return prev;
              const updated = [...prev.points];
              res.data.forEach(({ idx, location }) => { updated[idx] = { ...updated[idx], location }; });
              return { ...prev, points: updated };
            });
          })
          .catch(() => {});
      })
      .catch(() => toast.error('Failed to load timeline'))
      .finally(() => setLoadingTl(false));
  }, [selectedUser, trackDate]);

  const fetchAnalytics = useCallback(() => {
    setLoadingAnalytics(true);
    const params = new URLSearchParams({ date: analyticsDate });
    if (analyticsTrack) params.append('track', analyticsTrack);
    Promise.all([
      api.get(`/analytics/daily-distance?${params}`),
      api.get(`/analytics/weekly-distance${analyticsTrack ? `?track=${analyticsTrack}` : ''}`),
      api.get('/analytics/inactive-now'),
    ])
      .then(([d, w, i]) => {
        setDailyDist(d.data);
        setWeeklyDist(w.data);
        setInactiveUsers(i.data.inactive || []);
      })
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoadingAnalytics(false));
  }, [analyticsDate, analyticsTrack]);

  const fetchLiveLocations = useCallback(() => {
    setLoadingLive(true);
    api.get('/attendance/live-locations')
      .then(r => setLiveLocations(r.data))
      .catch(() => toast.error('Failed to load live locations'))
      .finally(() => setLoadingLive(false));
  }, []);

  // Campus Map tab — socket.io real-time, polling fallback
  useEffect(() => {
    if (tab !== 'campus') return;
    fetchLiveLocations();

    const BASE = (import.meta.env.VITE_API_URL || 'https://sses-admission-portal-1.onrender.com/api')
      .replace('/api', '');
    const socket = io(BASE, { transports: ['websocket'], withCredentials: true });
    socket.on('connect', () => socket.emit('join:live'));
    socket.on('location:update', (data) => {
      setLiveLocations(prev =>
        prev.map(u => u.userId?.toString() === data.userId?.toString()
          ? { ...u, lat: data.lat, lng: data.lng, timestamp: data.timestamp }
          : u
        )
      );
    });
    // Fallback polling har 2 min — socket disconnect hone par bhi data fresh rahe
    const id = setInterval(fetchLiveLocations, 2 * 60 * 1000);
    return () => { socket.disconnect(); clearInterval(id); };
  }, [tab, fetchLiveLocations]);

  useEffect(() => { if (tab === 'analytics') fetchAnalytics(); }, [tab, analyticsDate, analyticsTrack]); // eslint-disable-line

  useEffect(() => { if (tab === 'records') fetchRecords(); }, [tab, from, to, filterTrack]);
  useEffect(() => { if (tab === 'monthly') fetchMonthly(); }, [tab, month, monthTrack]);
  useEffect(() => {
    if (tab === 'tracking') {
      fetchTrackUsers();
      fetchLocationLogs();
    }
  }, [tab]); // eslint-disable-line

  useEffect(() => {
    if (tab === 'tracking' && selectedUser) fetchTimeline();
  }, [selectedUser, trackDate, tab]); // eslint-disable-line

  // Mobile pe page visible hone par re-fetch karo
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (tab === 'records') fetchRecords();
      else if (tab === 'monthly') fetchMonthly();
      else if (tab === 'campus') fetchLiveLocations();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [tab]); // eslint-disable-line

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
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl">
        {[
          { key: 'records',   label: 'Records',       icon: FiFilter },
          { key: 'monthly',   label: 'Monthly %',     icon: FiBarChart2 },
          { key: 'tracking',  label: 'Live Tracking', icon: FiNavigation },
          { key: 'campus',    label: 'Campus Map',    icon: FiMapPin },
          { key: 'analytics', label: 'Analytics',     icon: FiActivity },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors
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
              <DatePicker value={from} onChange={setFrom} max={to || today} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">To</label>
              <DatePicker value={to} onChange={setTo} min={from} max={today} />
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
                  <div key={r._id} className="px-4 py-3 hover:bg-gray-50/60 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{r.user?.name}</p>
                        <p className="text-xs text-gray-400">{r.user?.track}</p>
                      </div>
                      {r.locationSource && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          r.locationSource === 'GPS' ? 'bg-emerald-50 text-emerald-700' :
                          r.locationSource === 'Google' ? 'bg-blue-50 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{r.locationSource}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <FiCalendar size={11} className="text-primary" /> {r.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <FiClock size={11} className="text-primary" /> {r.time}
                      </span>
                      <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-emerald-600 font-semibold hover:underline">
                        <FiMapPin size={11} /> View Location
                      </a>
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
                {/* Desktop table */}
                <div className="hidden sm:block">
                  <div className="grid grid-cols-5 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">
                    <span>Name</span><span>Track</span>
                    <span className="text-center">Present / Days</span>
                    <span className="text-center">Attendance %</span>
                    <span className="text-right">Action</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {monthlyStats.sort((a, b) => b.pct - a.pct).map(s => (
                      <div key={s.userId} className="grid grid-cols-5 items-center px-5 py-4 hover:bg-gray-50/60 transition-colors">
                        <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.track}</p>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold text-gray-700 tabular-nums">{s.present} / {s.total}</span>
                          <div className="w-24 bg-gray-100 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all duration-500 ${s.pct >= 75 ? 'bg-emerald-500' : s.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(s.pct, 100)}%` }} />
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full tabular-nums ${PCT_COLOR(s.pct)}`}>
                            {s.pct}%
                          </span>
                        </div>
                        <div className="flex justify-end">
                          <button onClick={() => openDayView(s.userId, s.name)}
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                            <FiCalendar size={11} /> Day View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-gray-50">
                  {monthlyStats.sort((a, b) => b.pct - a.pct).map(s => (
                    <div key={s.userId} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.track} &bull; {s.present}/{s.total} days</p>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                          <div className={`h-1.5 rounded-full ${s.pct >= 75 ? 'bg-emerald-500' : s.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(s.pct, 100)}%` }} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full tabular-nums ${PCT_COLOR(s.pct)}`}>
                          {s.pct}%
                        </span>
                        <button onClick={() => openDayView(s.userId, s.name)}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                          <FiCalendar size={11} /> Day View
                        </button>
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
              <select value={selectedUser} onChange={e => { setSelectedUser(e.target.value); setTlData(null); }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[180px]">
                <option value="">Select User</option>
                {trackUsers.map(u => (
                  <option key={u._id} value={u._id}>{u.name} ({u.track})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Date</label>
              <DatePicker value={trackDate} onChange={v => { setTrackDate(v); setTlData(null); }} max={today} />
            </div>
            <button onClick={() => { fetchLocationLogs(); if (selectedUser) fetchTimeline(); }}
              className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5">
              <FiRefreshCw size={13} /> Load
            </button>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
                className="accent-primary" />
              Auto-refresh (2 min)
            </label>
          </div>

          {/* No user selected */}
          {!selectedUser && (
            <p className="text-center text-gray-400 text-sm py-12">Select a user to view their timeline.</p>
          )}

          {/* Timeline */}
          {selectedUser && (
            <>
              {loadingTl ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : tlData && tlData.points.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-12">No location data for this date.</p>
              ) : tlData && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                  {/* Summary bar */}
                  <div className="flex flex-wrap gap-5 px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📍</span>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Total Distance</p>
                        <p className="text-sm font-bold text-gray-800">
                          {tlData.totalDistance >= 1000
                            ? `${(tlData.totalDistance / 1000).toFixed(2)} km`
                            : `${tlData.totalDistance} m`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⏱️</span>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">First Ping</p>
                        <p className="text-sm font-bold text-gray-800">{formatTime(tlData.points[0].timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏁</span>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Last Ping</p>
                        <p className="text-sm font-bold text-gray-800">{formatTime(tlData.points[tlData.points.length - 1].timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🛑</span>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Stops</p>
                        <p className="text-sm font-bold text-gray-800">{tlData.totalStops}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📶</span>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Pings</p>
                        <p className="text-sm font-bold text-gray-800">{tlData.points.length}</p>
                      </div>
                    </div>
                  </div>

                  {/* Map + Timeline side by side */}
                  <div className="flex flex-col lg:flex-row">

                    {/* Map */}
                    <div className="lg:w-3/5 p-4 border-b lg:border-b-0 lg:border-r border-gray-100">
                      <TrackingMap points={tlData.points} />
                      {/* Legend */}
                      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Start</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span> End</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span> Stopped</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block"></span> Moving</span>
                      </div>
                    </div>

                    {/* Timeline list */}
                    <div className="lg:w-2/5 overflow-y-auto max-h-[420px] px-5 py-4 space-y-0">
                      {tlData.points.map((pt, i) => {
                        const isFirst = i === 0;
                        const isLast  = i === tlData.points.length - 1;
                        return (
                          <div key={i} className="flex gap-3">
                            {/* dot + line */}
                            <div className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full border-2 mt-1 shrink-0 ${
                                isFirst ? 'bg-emerald-500 border-emerald-500' :
                                isLast  ? 'bg-rose-500 border-rose-500' :
                                pt.isStopped ? 'bg-amber-400 border-amber-400' :
                                'bg-indigo-500 border-indigo-500'
                              }`} />
                              {!isLast && <div className="w-0.5 bg-gray-200 flex-1 my-0.5 min-h-[20px]" />}
                            </div>
                            {/* content */}
                            <div className="pb-3 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-bold text-gray-700">{formatTime(pt.timestamp)}</p>
                                  {pt.location && <p className="text-[11px] text-gray-500">{pt.location}</p>}
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {isFirst && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">🟢 Start</span>}
                                    {isLast && !isFirst && <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">🔴 End</span>}
                                    {pt.isStopped && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">🛑 Stopped</span>}
                                  </div>
                                </div>
                                <a href={`https://maps.google.com/?q=${pt.lat},${pt.lng}`} target="_blank" rel="noreferrer"
                                  className="text-[10px] text-primary font-semibold hover:underline shrink-0 flex items-center gap-0.5">
                                  <FiMapPin size={10} /> Map
                                </a>
                              </div>
                              {i > 0 && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  +{pt.distFromPrev >= 1000 ? `${(pt.distFromPrev/1000).toFixed(2)} km` : `${pt.distFromPrev} m`}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
      {/* ── ANALYTICS TAB ── */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Date</label>
              <DatePicker value={analyticsDate} onChange={setAnalyticsDate} max={today} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Track</label>
              <select value={analyticsTrack} onChange={e => setAnalyticsTrack(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">All Tracks</option>
                {TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={fetchAnalytics}
              className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 flex items-center gap-1.5">
              <FiRefreshCw size={13} /> Refresh
            </button>
          </div>

          {loadingAnalytics ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              {inactiveUsers.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FiAlertCircle className="text-rose-500" size={18} />
                    <p className="text-sm font-bold text-rose-700">{inactiveUsers.length} Track Incharge Inactive (3+ hrs)</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {inactiveUsers.map(u => (
                      <div key={u.userId} className="bg-white border border-rose-200 rounded-xl px-3 py-2">
                        <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.track}</p>
                        <p className="text-xs text-rose-500 mt-0.5">
                          {u.lastSeen ? `Last seen ${u.minutesSinceLastPing} min ago` : 'No ping today'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-700">📍 Daily Distance — {analyticsDate}</p>
                </div>
                {dailyDist.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">No data for this date.</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {dailyDist.map((u, i) => {
                      const km = (u.totalDistance / 1000).toFixed(2);
                      const maxDist = dailyDist[0]?.totalDistance || 1;
                      const pct = Math.round((u.totalDistance / maxDist) * 100);
                      return (
                        <div key={u.userId} className="px-5 py-3 flex items-center gap-4">
                          <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                                <p className="text-xs text-gray-400">{u.track}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-primary">{km} km</p>
                                <p className="text-[10px] text-gray-400">{u.pings} pings</p>
                              </div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            {u.firstPing && u.lastPing && (
                              <p className="text-[10px] text-gray-400 mt-1">
                                {formatTime(u.firstPing)} → {formatTime(u.lastPing)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {weeklyDist && weeklyDist.users.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-sm font-bold text-gray-700">📊 Last 7 Days Distance (km)</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-4 py-2 text-gray-500 font-semibold">Name</th>
                          {weeklyDist.days.map(d => (
                            <th key={d} className="px-2 py-2 text-gray-500 font-semibold text-center">
                              {new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-gray-500 font-semibold text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {weeklyDist.users.map(u => {
                          const total = u.perDay.reduce((s, d) => s + d.distanceKm, 0).toFixed(2);
                          return (
                            <tr key={u.userId} className="hover:bg-gray-50/60">
                              <td className="px-4 py-2">
                                <p className="font-semibold text-gray-800">{u.name}</p>
                                <p className="text-gray-400">{u.track}</p>
                              </td>
                              {u.perDay.map(d => (
                                <td key={d.date} className="px-2 py-2 text-center">
                                  <span className={`font-semibold ${
                                    d.distanceKm === 0 ? 'text-gray-300' :
                                    d.distanceKm >= 50 ? 'text-emerald-600' :
                                    d.distanceKm >= 20 ? 'text-amber-600' : 'text-rose-500'
                                  }`}>{d.distanceKm || '—'}</span>
                                </td>
                              ))}
                              <td className="px-3 py-2 text-right font-bold text-primary">{total}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-4 px-5 py-3 border-t border-gray-50 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 50+ km</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 20-50 km</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> &lt;20 km</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> No data</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── CAMPUS MAP TAB ── */}
      {tab === 'campus' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Aaj ke saare track incharge ki current location — college ke relative</p>
            <button onClick={fetchLiveLocations}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90">
              <FiRefreshCw size={13} /> Refresh
            </button>
          </div>

          {loadingLive ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Map */}
              <CampusMap users={liveLocations} />

              {/* User list below map */}
              <div className="divide-y divide-gray-50">
                {liveLocations.map((u, i) => {
                  const colors = ['#6366f1','#22c55e','#ef4444','#f59e0b','#3b82f6','#ec4899','#14b8a6','#a855f7'];
                  const color = colors[i % colors.length];
                  const dist = u.lat && u.lng ? haversineKm(22.563246, 76.961334, u.lat, u.lng) : null;
                  const time = u.timestamp ? new Date(u.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;
                  return (
                    <div key={u.userId} className="flex items-center gap-3 px-4 py-3">
                      <div style={{ background: color }} className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {u.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.track}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {dist ? (
                          <>
                            <p className="text-sm font-bold text-primary">{dist} km</p>
                            <p className="text-[10px] text-gray-400">{time}</p>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">No data today</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DAY VIEW MODAL ── */}
      {dvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setDvModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-800 text-lg">{dvModal.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <button onClick={() => changeDvMonth(-1)}
                    className="text-gray-400 hover:text-primary font-bold text-base leading-none">&#8249;</button>
                  <p className="text-xs text-gray-500 font-semibold min-w-[90px] text-center">
                    {new Date(dvModal.month + '-02').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </p>
                  <button onClick={() => changeDvMonth(1)}
                    disabled={dvModal.month >= thisMonth}
                    className="text-gray-400 hover:text-primary font-bold text-base leading-none disabled:opacity-30">&#8250;</button>
                </div>
              </div>
              <button onClick={() => setDvModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">&times;</button>
            </div>

            {loadingDv ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : dvData && (
              <>
                {/* Summary */}
                <div className="flex gap-5 px-6 py-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold">
                  <span className="text-emerald-600">✓ Present: {dvData.days.filter(d => d.present).length}</span>
                  <span className="text-rose-500">✗ Absent: {dvData.days.filter(d => !d.present && new Date(d.date).getDay() !== 0).length}</span>
                  <span className="text-violet-500">● Sunday: {dvData.days.filter(d => new Date(d.date).getDay() === 0).length}</span>
                </div>

                {/* Day cards grid - week wise rows */}
                <div className="overflow-y-auto flex-1 p-4">
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                      <div key={d} className={`text-center text-[10px] font-bold uppercase py-1 ${
                        d === 'Sun' ? 'text-violet-400' : 'text-gray-400'
                      }`}>{d}</div>
                    ))}
                  </div>
                  {/* Weeks */}
                  {(() => {
                    const firstDay = new Date(dvModal.month + '-01').getDay(); // 0=Sun
                    const allDays = [...Array(firstDay).fill(null), ...dvData.days];
                    const weeks = [];
                    for (let i = 0; i < allDays.length; i += 7)
                      weeks.push(allDays.slice(i, i + 7));
                    return weeks.map((week, wi) => (
                      <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                        {week.map((day, di) => {
                          if (!day) return <div key={di} />;
                          const isSunday = new Date(day.date).getDay() === 0;
                          const d = new Date(day.date).getDate();
                          return (
                            <div key={day.date} className={`rounded-lg flex flex-col items-center py-1.5 border ${
                              isSunday ? 'bg-violet-50 border-violet-200' :
                              day.present ? 'bg-emerald-50 border-emerald-200' :
                              'bg-rose-50 border-rose-200'
                            }`}>
                              <span className={`text-sm font-bold ${
                                isSunday ? 'text-violet-600' : day.present ? 'text-emerald-700' : 'text-rose-600'
                              }`}>{d}</span>
                              <span className={`text-[9px] font-semibold ${
                                isSunday ? 'text-violet-400' : day.present ? 'text-emerald-500' : 'text-rose-400'
                              }`}>
                                {isSunday ? 'Off' : day.present ? (day.time ? day.time.slice(0,5) : 'P') : 'A'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
