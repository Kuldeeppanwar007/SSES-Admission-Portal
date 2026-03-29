import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { STATUSES, STATUS_COLORS } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { FiEdit2, FiArrowLeft, FiImage, FiFileText, FiExternalLink, FiClock, FiX, FiDownload } from 'react-icons/fi';

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [student, setStudent] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: '', remarks: '' });
  const [updating, setUpdating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.post('/students/export', { ids: [id] }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${student?.name || 'student'}_export.xlsx`; a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Exported successfully');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  useEffect(() => {
    api.get(`/students/${id}`)
      .then(({ data }) => { setStudent(data); setStatusForm({ status: data.status, remarks: '' }); })
      .catch(() => toast.error('Failed to load student'));
  }, [id]);

  const handleStatusUpdate = async () => {
    setUpdating(true);
    try {
      const { data } = await api.patch(`/students/${id}/status`, statusForm);
      setStudent(data);
      toast.success('Status updated');
    } catch { toast.error('Update failed'); }
    finally { setUpdating(false); }
  };

  const handleViewHistory = async () => {
    try {
      const { data } = await api.get(`/students/${id}/status-history`);
      setHistory(data);
      setShowHistory(true);
    } catch { toast.error('Failed to load history'); }
  };

  if (!student) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div></div>;

  const info = [
    ['S.N.', student.sn], ['Name', student.name], ['Father Name', student.fatherName],
    ['Track', student.track], ['Mobile No', student.mobileNo], ['WhatsApp No', student.whatsappNo],
    ['Subject', student.subject], ['Other Track', student.otherTrack], ['Full Address', student.fullAddress],
    ['Added By', student.addedBy?.name], ['Added On', new Date(student.createdAt).toLocaleDateString('en-IN')],
  ];

  return (
    <div className="px-2">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button onClick={() => navigate('/students')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
          <FiArrowLeft size={16} /> Back
        </button>
        <h2 className="text-xl font-bold text-gray-800">Student Details</h2>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate(`/students/${id}/edit`)}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-sm hover:bg-primary-dark">
            <FiEdit2 size={13} /> Edit
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 border border-orange-200 text-primary px-3 py-1.5 rounded-lg text-sm hover:bg-orange-50 disabled:opacity-60">
            <FiDownload size={13} /> {exporting ? 'Exporting...' : 'Export'}
          </button>
          <button onClick={handleViewHistory}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
            <FiClock size={13} /> History
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-4">
        <div className="flex items-start gap-4 mb-6">
          {student.photo ? (
            <img src={student.photo} alt="Photo" className="w-20 h-20 rounded-full object-cover border-2 border-primary" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold">
              {student.name[0]}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold">{student.name}</h3>
            <p className="text-gray-500">{student.fatherName}</p>
            <span className={`mt-1 inline-block px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[student.status]}`}>{student.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {info.map(([label, value]) => value ? (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-medium mt-0.5">{value}</p>
            </div>
          ) : null)}
        </div>

        {(student.photo || student.marksheet10th || student.marksheet12th || student.incomeCertificate || student.jaatiPraman || student.abcId || student.aadharCard) && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Documents</p>
            <div className="flex gap-3 flex-wrap">
              {[
                { key: 'photo',             label: 'Photo',               icon: FiImage },
                { key: 'marksheet10th',     label: '10th Marksheet',      icon: FiFileText },
                { key: 'marksheet12th',     label: '12th Marksheet',      icon: FiFileText },
                { key: 'incomeCertificate', label: 'Income Certificate',  icon: FiFileText },
                { key: 'jaatiPraman',       label: 'Jaati Praman Patra',  icon: FiFileText },
                { key: 'abcId',             label: 'ABC ID',              icon: FiFileText },
                { key: 'aadharCard',        label: 'Aadhar Card',         icon: FiFileText },
              ].filter((d) => student[d.key]).map(({ key, label, icon: Icon }) => (
                <a key={key} href={student[key]} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 border border-gray-200 rounded-xl p-3 hover:border-primary hover:shadow-sm transition-all group w-48">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-primary">
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">{label}</p>
                    <p className="text-xs text-gray-400">View document</p>
                  </div>
                  <FiExternalLink size={14} className="text-gray-300 group-hover:text-primary" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Update Status — sabke liye */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-4">Update Status</h3>
          <div className="flex flex-wrap gap-3">
            <select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input placeholder="Remarks (optional)" value={statusForm.remarks}
              onChange={(e) => setStatusForm({ ...statusForm, remarks: e.target.value })}
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" />
            <button onClick={handleStatusUpdate} disabled={updating}
              className="bg-primary text-white px-5 py-2 rounded-lg text-sm hover:bg-primary-dark disabled:opacity-60 w-full sm:w-auto">
              {updating ? 'Updating...' : 'Update'}
            </button>
          </div>

        </div>
      {/* Status History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Status History</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><FiX size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">No history found</p>
              ) : history.map((h) => (
                <div key={h._id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[h.status] || 'bg-gray-100 text-gray-600'}`}>{h.status}</span>
                      {h.funnelStage && <span className="text-xs bg-orange-50 text-primary border border-orange-100 px-2 py-0.5 rounded-full font-medium">{h.funnelStage}</span>}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleString('en-IN')}</span>
                  </div>
                  {h.remarks && <p className="text-sm text-gray-600 mt-1">💬 {h.remarks}</p>}
                  <p className="text-xs text-gray-400 mt-1">By: {h.changedBy?.name || 'Unknown'} ({h.changedBy?.role || ''})</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
