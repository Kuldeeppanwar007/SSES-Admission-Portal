import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { STATUS_COLORS } from '../../utils/constants';
import toast from 'react-hot-toast';

const StatCard = ({ label, value, color }) => (
  <div className={`rounded-xl p-5 text-white ${color}`}>
    <p className="text-sm opacity-80">{label}</p>
    <p className="text-3xl font-bold mt-1">{value}</p>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/students/stats')
      .then((r) => setStats(r.data))
      .catch(() => toast.error('Failed to load stats'));
  }, []);

  if (!stats) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div></div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total" value={stats.total} color="bg-gray-700" />
        <StatCard label="Applied" value={stats.applied} color="bg-yellow-500" />
        <StatCard label="Verified" value={stats.verified} color="bg-blue-500" />
        <StatCard label="Admitted" value={stats.admitted} color="bg-green-500" />
        <StatCard label="Rejected" value={stats.rejected} color="bg-red-500" />
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Track-wise Students</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.trackWise.map((t) => {
            const pct = Math.round((t.count / stats.total) * 100);
            return (
              <div key={t._id} className="rounded-xl border border-gray-200 p-4 hover:border-primary hover:shadow-sm transition-all">
                <p className="text-xs text-gray-400 font-medium truncate uppercase tracking-wide">{t._id}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{t.count}</p>
                <div className="mt-3 bg-gray-100 rounded-full h-1">
                  <div className="h-1 rounded-full bg-primary" style={{ width: `${Math.max(pct, 3)}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{pct}% of total</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
