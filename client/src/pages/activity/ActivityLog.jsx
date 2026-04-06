import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { FiClock, FiUser, FiFilter, FiBarChart2, FiList } from 'react-icons/fi';

const today = new Date().toISOString().slice(0, 10);

export default function ActivityLog() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('logs'); // 'logs' | 'stats'
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');

  const fetchUsers = useCallback(() => {
    if (user?.role === 'admin')
      api.get('/users?role=track_incharge').then(r => setUsers(r.data?.users || r.data || [])).catch(() => {});
  }, [user]);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (selectedUser) params.append('userId', selectedUser);
    api.get(`/students/activity-log?${params}`)
      .then(({ data }) => {
        setLogs(data.logs || data);
        setStats(data.stats || []);
      })
      .finally(() => setLoading(false));
  }, [from, to, selectedUser]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const roleColors = { admin: 'bg-purple-100 text-purple-700', track_incharge: 'bg-blue-100 text-blue-700', manager: 'bg-green-100 text-green-700' };
  const roleLabel = { admin: 'Admin', track_incharge: 'Track Incharge', manager: 'Manager' };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FiClock size={20} className="text-primary" />
        <h2 className="text-xl font-bold text-gray-800">Activity Log</h2>
        {user?.role === 'track_incharge' && <span className="ml-2 text-xs text-gray-400">(Sirf aapki activity)</span>}
      </div>

      {/* Filters — admin only */}
      {user?.role === 'admin' && (
        <div className="flex flex-wrap gap-3 items-end bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">From</label>
            <input type="date" value={from} max={to || today} onChange={e => setFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">To</label>
            <input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Track Incharge</label>
            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]">
              <option value="">All Users</option>
              {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.track})</option>)}
            </select>
          </div>
          <button onClick={fetchLogs}
            className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 flex items-center gap-1.5">
            <FiFilter size={13} /> Apply
          </button>
          <button onClick={() => { setFrom(''); setTo(''); setSelectedUser(''); }}
            className="px-4 py-1.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50">
            Clear
          </button>
        </div>
      )}

      {/* Tabs */}
      {user?.role === 'admin' && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[{ key: 'logs', label: 'Activity Feed', icon: FiList }, { key: 'stats', label: 'Summary Stats', icon: FiBarChart2 }]
            .map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                  ${tab === key ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Icon size={14} /> {label}
              </button>
            ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── STATS TAB ── */}
          {tab === 'stats' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {stats.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">No data for selected filters.</p>
              ) : (
                <>
                  <div className="grid grid-cols-6 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">
                    <span className="col-span-2">Name / Track</span>
                    <span className="text-center">Total Updates</span>
                    <span className="text-center">Calling</span>
                    <span className="text-center">Status Changes</span>
                    <span className="text-center">Remarks Added</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {stats.map(s => (
                      <div key={s.userId} className="grid grid-cols-6 items-center px-5 py-4 hover:bg-gray-50/60 transition-colors">
                        <div className="col-span-2">
                          <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.track}</p>
                        </div>
                        <div className="text-center">
                          <span className="text-lg font-bold text-primary">{s.totalUpdates}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-sm font-bold text-purple-600">{s.callingUpdates}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-sm font-bold text-blue-600">{s.statusChanges}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-sm font-bold text-emerald-600">{s.remarksAdded}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── LOGS TAB ── */}
          {tab === 'logs' && (
            logs.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <FiClock size={36} className="mb-2 opacity-30" />
                <p className="text-sm">Koi activity nahi mili</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-100" />
                <div className="space-y-4">
                  {logs.map((h, idx) => {
                    const role = h.changedBy?.role || '';
                    return (
                      <div key={h._id} className="flex gap-4 relative">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 text-white text-xs font-bold shadow ${idx === 0 ? 'bg-primary' : 'bg-gray-300'}`}>
                          {(h.changedBy?.name || 'U')[0].toUpperCase()}
                        </div>
                        <div className={`flex-1 rounded-xl p-3.5 border ${idx === 0 ? 'border-orange-200 bg-orange-50/40' : 'border-gray-100 bg-white'}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-800">{h.changedBy?.name || 'Unknown'}</span>
                              {role && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleColors[role] || 'bg-gray-100 text-gray-500'}`}>
                                  {roleLabel[role] || role}
                                </span>
                              )}
                              {h.changedBy?.track && (
                                <span className="text-[10px] text-gray-400">{h.changedBy.track}</span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-400 shrink-0">
                              {new Date(h.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {h.student && (
                            <button onClick={() => navigate(`/students/${h.student._id}`)}
                              className="flex items-center gap-1 text-xs text-primary font-medium mb-2 hover:underline">
                              <FiUser size={11} /> {h.student.name} · {h.student.track}
                            </button>
                          )}
                          <div className="space-y-1 mt-1">
                            {h.changedFields?.map(f => (
                              <div key={f.field} className="flex items-center gap-2 text-xs bg-white border border-gray-100 rounded-lg px-3 py-1.5">
                                <span className="text-gray-500 font-medium capitalize w-28 shrink-0">{f.field.replace(/([A-Z])/g, ' $1')}</span>
                                <span className="text-red-400 line-through truncate max-w-[90px]">{f.oldValue || '—'}</span>
                                <span className="text-gray-400">→</span>
                                <span className="text-green-600 font-medium truncate max-w-[90px]">{f.newValue || '—'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
