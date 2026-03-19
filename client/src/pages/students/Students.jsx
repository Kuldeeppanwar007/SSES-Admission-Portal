import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { TRACKS, STATUSES, STATUS_COLORS } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { FiPlus, FiUpload, FiSearch, FiEye, FiEdit2, FiTrash2 } from 'react-icons/fi';

export default function Students() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filters, setFilters] = useState({ track: '', status: '', search: '' });
  const [loading, setLoading] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, ...filters };
      const { data } = await api.get('/students', { params });
      setStudents(data.students);
      setTotal(data.total);
      setPages(data.pages);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStudents(); }, [page, filters]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this student?')) return;
    try {
      await api.delete(`/students/${id}`);
      toast.success('Student deleted');
      fetchStudents();
    } catch { toast.error('Delete failed'); }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post('/students/bulk-upload', formData);
      toast.success(data.message);
      fetchStudents();
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    e.target.value = '';
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Students <span className="text-gray-400 text-lg">({total})</span></h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-green-700 transition-colors text-sm">
            <FiUpload /> Bulk Upload
            <input type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={handleBulkUpload} />
          </label>
          <button onClick={() => navigate('/students/add')}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm">
            <FiPlus /> Add Student
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48 border border-gray-300 rounded-lg px-3">
          <FiSearch className="text-gray-400" />
          <input placeholder="Search name, father, mobile..." value={filters.search}
            onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
            className="flex-1 py-2 outline-none text-sm" />
        </div>
        {user?.role !== 'track_incharge' && (
          <select value={filters.track} onChange={(e) => { setFilters({ ...filters, track: e.target.value }); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">All Tracks</option>
            {TRACKS.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        <select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">All Status</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['S.N.', 'Name', 'Father Name', 'Track', 'Mobile', 'Subject', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">No students found</td></tr>
                ) : students.map((s, i) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{s.sn || ((page - 1) * 20 + i + 1)}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.fatherName}</td>
                    <td className="px-4 py-3 text-gray-600">{s.track}</td>
                    <td className="px-4 py-3 text-gray-600">{s.mobileNo}</td>
                    <td className="px-4 py-3 text-gray-600">{s.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/students/${s._id}`)} className="text-blue-500 hover:text-blue-700"><FiEye /></button>
                        <button onClick={() => navigate(`/students/${s._id}/edit`)} className="text-yellow-500 hover:text-yellow-700"><FiEdit2 /></button>
                        {user?.role !== 'track_incharge' && (
                          <button onClick={() => handleDelete(s._id)} className="text-red-500 hover:text-red-700"><FiTrash2 /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-primary text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
