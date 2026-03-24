import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { TRACKS, STATUSES, STATUS_COLORS } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { FiPlus, FiUpload, FiSearch, FiEye, FiEdit2, FiDownload, FiFilter, FiSlash } from 'react-icons/fi';

const ACTIVE_STATUSES = STATUSES.filter((s) => s !== 'Disabled');

export default function Students() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('active'); // 'active' | 'disabled'
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filters, setFilters] = useState({ track: '', status: '', search: '' });
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = {
        page, limit: 10,
        ...filters,
        ...(tab === 'disabled' ? { status: 'Disabled' } : {}),
      };
      const { data } = await api.get('/students', { params });
      setStudents(data.students);
      setTotal(data.total);
      setPages(data.pages);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStudents(); }, [page, filters, tab]);

  const switchTab = (t) => { setTab(t); setPage(1); setFilters({ track: '', status: '', search: '' }); };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/students/download-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'students_template.xlsx'; a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download template'); }
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

  const isDisabledTab = tab === 'disabled';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">
          Students <span className="text-gray-400 text-base">({total})</span>
        </h2>
        {!isDisabledTab && (
          <div className="flex gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-lg cursor-pointer hover:bg-primary-dark transition-colors text-sm">
              <FiUpload size={14} /> <span className="hidden sm:inline">Bulk Upload</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkUpload} />
            </label>
            <button onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm border border-gray-300">
              <FiDownload size={14} /> <span className="hidden sm:inline">Sample Format</span>
            </button>
            <button onClick={() => navigate('/students/add')}
              className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm">
              <FiPlus size={14} /> <span className="hidden sm:inline">Add Student</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => switchTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${!isDisabledTab ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
          <FiSearch size={14} /> Active Profiles
        </button>
        <button onClick={() => switchTab('disabled')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isDisabledTab ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
          <FiSlash size={14} /> Disabled Profiles
        </button>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl shadow p-3 mb-4 space-y-2">
        <div className="flex gap-2">
          <div className="flex items-center gap-2 flex-1 border border-gray-300 rounded-lg px-3">
            <FiSearch className="text-gray-400 shrink-0" size={15} />
            <input placeholder="Search name, father, mobile, track..." value={filters.search}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
              className="flex-1 py-2 outline-none text-sm" />
          </div>
          {!isDisabledTab && (
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg border text-sm transition-colors ${showFilters ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600'}`}>
              <FiFilter size={14} /> <span className="hidden sm:inline">Filter</span>
            </button>
          )}
        </div>
        {showFilters && !isDisabledTab && (
          <div className="flex flex-wrap gap-2 pt-1">
            {user?.role !== 'track_incharge' && (
              <select value={filters.track} onChange={(e) => { setFilters({ ...filters, track: e.target.value }); setPage(1); }}
                className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">All Tracks</option>
                {TRACKS.map((t) => <option key={t}>{t}</option>)}
              </select>
            )}
            <select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
              className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="">All Status</option>
              {ACTIVE_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['S.N.', 'Name', 'Father Name', 'Track', 'Mobile', 'Subject', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">No students found</td></tr>
                ) : students.map((s, i) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{(page - 1) * 10 + i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-600">{s.name}</td>
                    <td className="px-4 py-3 text-gray-400">{s.fatherName}</td>
                    <td className="px-4 py-3 text-gray-400">{s.track}</td>
                    <td className="px-4 py-3 text-gray-400">{s.mobileNo}</td>
                    <td className="px-4 py-3 text-gray-400">{s.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/students/${s._id}`)} className="text-primary hover:text-primary-dark"><FiEye /></button>
                        <button onClick={() => navigate(`/students/${s._id}/edit`)} className="text-yellow-500 hover:text-yellow-700"><FiEdit2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cards — mobile */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
        ) : students.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-xl shadow">No students found</div>
        ) : students.map((s, i) => (
          <div key={s._id} className="bg-white rounded-xl shadow p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-gray-800">{(page - 1) * 10 + i + 1}. {s.name}</p>
                <p className="text-sm text-gray-400">{s.fatherName}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[s.status]}`}>{s.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-400 mb-3">
              {s.track && <span>📍 {s.track}</span>}
              {s.mobileNo && <span>📞 {s.mobileNo}</span>}
              {s.subject && <span>📚 {s.subject}</span>}
            </div>
            <div className="flex gap-2 border-t border-gray-100 pt-2">
              <button onClick={() => navigate(`/students/${s._id}`)}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1.5 border border-primary text-primary rounded-lg">
                <FiEye size={13} /> View
              </button>
              <button onClick={() => navigate(`/students/${s._id}/edit`)}
                className="flex-1 flex items-center justify-center gap-1 text-xs text-white font-medium py-1.5 bg-primary rounded-lg">
                <FiEdit2 size={13} /> Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center items-center gap-1 mt-4 flex-wrap">
          <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded text-sm border bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40">‹</button>
          {(() => {
            const delta = 1;
            const range = [];
            const rangeWithDots = [];
            for (let i = Math.max(2, page - delta); i <= Math.min(pages - 1, page + delta); i++) range.push(i);
            if (range[0] > 2) rangeWithDots.push(1, '...');
            else rangeWithDots.push(1);
            rangeWithDots.push(...range);
            if (range[range.length - 1] < pages - 1) rangeWithDots.push('...', pages);
            else if (pages > 1) rangeWithDots.push(pages);
            return rangeWithDots.map((p, idx) =>
              p === '...' ? (
                <span key={`dots-${idx}`} className="px-2 py-1.5 text-sm text-gray-400">...</span>
              ) : (
                <button key={p} onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${p === page ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{p}</button>
              )
            );
          })()}
          <button onClick={() => setPage(p => Math.min(p + 1, pages))} disabled={page === pages}
            className="px-3 py-1.5 rounded text-sm border bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40">›</button>
        </div>
      )}
    </div>
  );
}
