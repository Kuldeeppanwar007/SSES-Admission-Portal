import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiExternalLink } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';

const STATUS_COLORS = {
  Pending:  'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-rose-100 text-rose-600',
};

export default function EditRequests() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('Pending');
  const [reviewModal, setReviewModal] = useState(null); // { req, action: 'Approved'|'Rejected' }
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin';

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const url = isAdmin ? `/edit-requests?status=${tab}` : '/edit-requests/my/requests';
      const { data } = await api.get(url);
      // track_incharge ke liye tab filter client side
      setRequests(isAdmin ? data : data.filter(r => tab === 'all' || r.status === tab));
    } catch { toast.error('Failed to load requests'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(); }, [tab]);

  const handleReview = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/edit-requests/${reviewModal.req._id}/review`, {
        status: reviewModal.action,
        reviewNote,
      });
      toast.success(`Request ${reviewModal.action}!`);
      setReviewModal(null);
      setReviewNote('');
      fetchRequests();
    } catch { toast.error('Failed'); }
    finally { setSubmitting(false); }
  };

  const TABS = isAdmin
    ? ['Pending', 'Approved', 'Rejected']
    : ['Pending', 'Approved', 'Rejected'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">
          {isAdmin ? 'Edit Requests' : 'My Edit Requests'}
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">Koi request nahi</div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r._id} className="bg-white rounded-xl shadow p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                    <button onClick={() => navigate(`/students/${r.student?._id}`)}
                      className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                      {r.student?.name} <FiExternalLink size={12} />
                    </button>
                    <span className="text-xs text-gray-400">{r.student?.track}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-gray-400 uppercase">Field</p>
                      <p className="font-medium text-gray-700">{r.field}</p>
                    </div>
                    <div className="bg-rose-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-gray-400 uppercase">Old Value</p>
                      <p className="font-medium text-gray-700">{r.oldValue || '—'}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-gray-400 uppercase">New Value</p>
                      <p className="font-medium text-gray-700">{r.newValue}</p>
                    </div>
                  </div>
                  {r.reason && <p className="text-xs text-gray-500 mt-2">💬 {r.reason}</p>}
                  {r.reviewNote && <p className="text-xs text-gray-500 mt-1">📝 {r.reviewNote}</p>}
                  <p className="text-xs text-gray-400 mt-2">
                    By: {r.requestedBy?.name} • {new Date(r.createdAt).toLocaleDateString('en-IN')}
                    {r.reviewedBy && ` • Reviewed by: ${r.reviewedBy.name}`}
                  </p>
                </div>

                {isAdmin && r.status === 'Pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setReviewModal({ req: r, action: 'Approved' }); setReviewNote(''); }}
                      className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-lg text-sm hover:bg-primary-dark">
                      <FiCheck size={13} /> Approve
                    </button>
                    <button onClick={() => { setReviewModal({ req: r, action: 'Rejected' }); setReviewNote(''); }}
                      className="flex items-center gap-1 border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
                      <FiX size={13} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReviewModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">
                {reviewModal.action === 'Approved' ? '✅ Approve' : '❌ Reject'} Request
              </h3>
              <button onClick={() => setReviewModal(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p><span className="text-gray-400">Field:</span> <span className="font-medium">{reviewModal.req.field}</span></p>
                <p><span className="text-gray-400">New Value:</span> <span className="font-medium text-emerald-600">{reviewModal.req.newValue}</span></p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Note (optional)</label>
                <textarea rows={2} value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                  placeholder="Koi note likhna ho to..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <button onClick={handleReview} disabled={submitting}
                className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors">
                {submitting ? 'Processing...' : `Confirm ${reviewModal.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
