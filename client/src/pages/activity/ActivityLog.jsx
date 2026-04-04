import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { FiClock, FiUser } from 'react-icons/fi';

export default function ActivityLog() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/students/activity-log')
      .then(({ data }) => setLogs(data))
      .finally(() => setLoading(false));
  }, []);

  const roleColors = {
    admin: 'bg-purple-100 text-purple-700',
    track_incharge: 'bg-blue-100 text-blue-700',
    manager: 'bg-green-100 text-green-700',
  };
  const roleLabel = {
    admin: 'Admin',
    track_incharge: 'Track Incharge',
    manager: 'Manager',
  };

  return (
    <div className="px-2 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <FiClock size={20} className="text-primary" />
        <h2 className="text-xl font-bold text-gray-800">Activity Log</h2>
        {user?.role === 'track_incharge' && (
          <span className="ml-2 text-xs text-gray-400">(Sirf aapki activity)</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
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
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0">
                        {new Date(h.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {h.student && (
                      <button
                        onClick={() => navigate(`/students/${h.student._id}`)}
                        className="flex items-center gap-1 text-xs text-primary font-medium mb-2 hover:underline"
                      >
                        <FiUser size={11} /> {h.student.name} · {h.student.track}
                      </button>
                    )}

                    {/* Changed Fields */}
                    <div className="space-y-1 mt-1">
                      {h.changedFields.map(f => (
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
      )}
    </div>
  );
}
