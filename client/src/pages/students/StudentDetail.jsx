import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { STATUSES, STATUS_COLORS } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { FiEdit2, FiArrowLeft, FiImage, FiFileText, FiExternalLink, FiClock, FiX, FiDownload, FiSend } from 'react-icons/fi';

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [student, setStudent] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [finalForm, setFinalForm] = useState(null);
  const [finalLoading, setFinalLoading] = useState(false);
  const [editReqForm, setEditReqForm] = useState(null); // null = closed
  const [editReqLoading, setEditReqLoading] = useState(false);

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
      .then(({ data }) => { setStudent(data); })
      .catch(() => toast.error('Failed to load student'));
    api.get(`/interviews/${id}`)
      .then(({ data }) => setInterviews(data))
      .catch(() => {});
  }, [id]);

  const handleFinalInterview = async (e) => {
    e.preventDefault();
    setFinalLoading(true);
    try {
      await api.post(`/interviews/${id}/final`, finalForm);
      toast.success('Final interview saved!');
      setFinalForm(null);
      const { data } = await api.get(`/students/${id}`);
      setStudent(data);
    } catch { toast.error('Failed to save'); }
    finally { setFinalLoading(false); }
  };

const handleViewHistory = async () => {
    try {
      const { data } = await api.get(`/students/${id}/status-history`);
      setHistory(data);
      setShowHistory(true);
    } catch { toast.error('Failed to load history'); }
  };

  const handleEditRequest = async (e) => {
    e.preventDefault();
    setEditReqLoading(true);
    try {
      await api.post(`/edit-requests/${id}`, editReqForm);
      toast.success('Request bhej di gayi!');
      setEditReqForm(null);
    } catch { toast.error('Request failed'); }
    finally { setEditReqLoading(false); }
  };

  if (!student) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div></div>;

  const s = student;
  const fmt = (v) => (v !== null && v !== undefined && v !== '') ? String(v) : null;

  const SECTIONS = [
    {
      title: 'Basic Information',
      fields: [
        ['S.N.',         fmt(s.sn)],
        ['Name',         fmt(s.name)],
        ['Father Name',  fmt(s.fatherName)],
        ['Track',        fmt(s.track)],
        ['Other Track',  fmt(s.otherTrack)],
        ['Mobile No',    fmt(s.mobileNo)],
        ['WhatsApp No',  fmt(s.whatsappNo || s.whatsappNumber)],
        ['Full Address', fmt(s.fullAddress)],
        ['Subject',      fmt(s.subject)],
        ['Form Source',  fmt(s.formSource)],
        ['Status',       fmt(s.status)],
        ['Funnel Stage', fmt(s.funnelStage)],
        ['Remarks',      fmt(s.remarks)],
        ['Added By',     fmt(s.addedBy?.name)],
        ['Added On',     s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : null],
      ],
    },
    {
      title: 'Personal Details',
      show: !!(s.email || s.dob || s.gender || s.category || s.aadharNo || s.district || s.village || s.pincode || s.tehsil),
      fields: [
        ['Email',             fmt(s.email)],
        ['Date of Birth',     fmt(s.dob)],
        ['Gender',            fmt(s.gender)],
        ['Category',          fmt(s.category)],
        ['Aadhar No',         fmt(s.aadharNo)],
        ['District',          fmt(s.district)],
        ['Village / City',    fmt(s.village)],
        ['Pincode',           fmt(s.pincode)],
        ['Tehsil',            fmt(s.tehsil)],
      ],
    },
    {
      title: 'Father / Family Details',
      show: !!(s.fatherOccupation || s.fatherIncome || s.fatherContactNumber),
      fields: [
        ['Father Occupation',   fmt(s.fatherOccupation)],
        ['Father Income',       fmt(s.fatherIncome)],
        ['Father Contact',      fmt(s.fatherContactNumber)],
      ],
    },
    {
      title: 'Academic Details',
      show: !!(s.schoolName || s.school12Sub || s.persentage10 || s.persentage11 || s.persentage12 || s.rollNumber10 || s.rollNumber12 || s.passout12 || s.jeeScore),
      fields: [
        ['School Name',       fmt(s.schoolName)],
        ['12th Subject',      fmt(s.school12Sub)],
        ['10th Percentage',   fmt(s.persentage10)],
        ['11th Percentage',   fmt(s.persentage11)],
        ['12th Percentage',   fmt(s.persentage12)],
        ['10th Roll No',      fmt(s.rollNumber10)],
        ['12th Roll No',      fmt(s.rollNumber12)],
        ['12th Passout Year', fmt(s.passout12)],
        ['JEE Score',         fmt(s.jeeScore)],
      ],
    },
    {
      title: 'B.Tech Preferences',
      show: !!(s.priority1 || s.priority2 || s.priority3),
      fields: [
        ['Priority 1', fmt(s.priority1)],
        ['Priority 2', fmt(s.priority2)],
        ['Priority 3', fmt(s.priority3)],
      ],
    },
    {
      title: 'SSISM Details',
      show: !!(s.branch || s.year || s.joinBatch || s.feesScheme || s.linkSource || s.trackName),
      fields: [
        ['Branch',      fmt(s.branch)],
        ['Year',        fmt(s.year)],
        ['Join Batch',  fmt(s.joinBatch)],
        ['Fees Scheme', fmt(s.feesScheme)],
        ['Link Source', fmt(s.linkSource)],
        ['Track Name',  fmt(s.trackName)],
        ['Is Top 20',   s.isTop20 ? 'Yes' : null],
      ],
    },
    {
      title: 'Payment / Registration',
      show: !!(s.applicationType || s.paymentStatus || s.transactionId || s.regFees || s.regFeesStatus || s.regFeeReceiptNo),
      fields: [
        ['Application Type',  fmt(s.applicationType)],
        ['Payment Status',    fmt(s.paymentStatus)],
        ['Transaction ID',    fmt(s.transactionId)],
        ['Reg. Fees',         fmt(s.regFees)],
        ['Reg. Fees Status',  fmt(s.regFeesStatus)],
        ['Reg. Fee Date',     s.regFeeDate ? new Date(s.regFeeDate).toLocaleDateString('en-IN') : null],
        ['Receipt No',        fmt(s.regFeeReceiptNo)],
      ],
    },
  ];

  const InfoField = ({ label, value }) => (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5 break-words">{value}</p>
    </div>
  );

  return (
    <div className="px-2">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button onClick={() => navigate('/students')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm shrink-0">
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
          {user?.role === 'track_incharge' && (
            <button onClick={() => setEditReqForm({ field: '', newValue: '', reason: '' })}
              className="flex items-center gap-1.5 border border-orange-200 text-primary px-3 py-1.5 rounded-lg text-sm hover:bg-orange-50">
              <FiSend size={13} /> Request Edit
            </button>
          )}
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

        {SECTIONS.map(({ title, fields, show }) => {
          if (show === false) return null;
          const visible = fields.filter(([, v]) => v !== null);
          if (visible.length === 0) return null;
          return (
            <div key={title} className="mt-5 pt-5 border-t border-gray-100 first:mt-0 first:pt-0 first:border-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {visible.map(([label, value]) => (
                  <InfoField key={label} label={label} value={value} />
                ))}
              </div>
            </div>
          );
        })}

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

      {/* Interview History */}
      {(interviews.length > 0 || student.finalInterview?.result) && (
        <div className="bg-white rounded-xl shadow p-6 mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-gray-800">Interview History</p>
            {user?.role === 'admin' && (
              <button onClick={() => setFinalForm({ remarks: '', result: 'Pending' })}
                className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors">
                ★ Take Final Interview
              </button>
            )}
          </div>
          <div className="space-y-4">
            {interviews.map((h) => (
              <div key={h._id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primary bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">Round {h.round}</span>
                    <span className="text-sm text-gray-500">{h.interviewer?.name}</span>
                    <span className="text-xs text-gray-400">{new Date(h.date).toLocaleDateString('en-IN')}</span>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    h.result === 'Pass' ? 'bg-emerald-100 text-emerald-700' :
                    h.result === 'Fail' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                  }`}>{h.result}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {[
                    ['Mathematics', h.mathematicsMarks],
                    ['Subjective Knowledge', h.subjectiveKnowledge],
                    ['Reasoning', h.reasoningMarks],
                    ['Goal Clarity', h.goalClarity],
                    ['Sincerity', h.sincerity],
                    ['Communication', h.communicationLevel],
                    ['Confidence', h.confidenceLevel],
                    ...(h.assignmentMarks != null ? [['Assignment', h.assignmentMarks]] : []),
                  ].map(([label, val]) => (
                    <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-gray-400">{label}</p>
                      <p className="text-sm font-bold text-gray-700">{val} / 5</p>
                    </div>
                  ))}
                  <div className="bg-orange-50 rounded-lg px-3 py-2 border border-orange-100">
                    <p className="text-[10px] text-gray-400">Total</p>
                    <p className="text-sm font-bold text-primary">{h.totalMark}</p>
                  </div>
                </div>
                {h.remarks && <p className="text-xs text-gray-500">💬 {h.remarks}</p>}
              </div>
            ))}

            {/* Final Interview Card */}
            {student.finalInterview?.result && (
              <div className="border-2 border-primary/30 bg-orange-50/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold bg-primary text-white px-3 py-1 rounded-full">★ Final Interview</span>
                    {student.finalInterview.doneBy?.name && (
                      <span className="text-sm text-gray-500">{student.finalInterview.doneBy.name}</span>
                    )}
                    {student.finalInterview.doneAt && (
                      <span className="text-xs text-gray-400">{new Date(student.finalInterview.doneAt).toLocaleDateString('en-IN')}</span>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    student.finalInterview.result === 'Pass' ? 'bg-emerald-100 text-emerald-700' :
                    student.finalInterview.result === 'Fail' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                  }`}>{student.finalInterview.result}</span>
                </div>
                {student.finalInterview.remarks && (
                  <p className="text-xs text-gray-500">💬 {student.finalInterview.remarks}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Final Interview Modal */}
      {finalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setFinalForm(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Take Final Interview</h3>
              <button onClick={() => setFinalForm(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">&times;</button>
            </div>
            <form onSubmit={handleFinalInterview} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Round</label>
                <input value={interviews.length + 1} disabled
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Remark</label>
                <textarea rows={3} value={finalForm.remarks}
                  onChange={e => setFinalForm({ ...finalForm, remarks: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Result</label>
                <select value={finalForm.result}
                  onChange={e => setFinalForm({ ...finalForm, result: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {['Pass', 'Fail', 'Pending'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <button type="submit" disabled={finalLoading}
                className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors">
                {finalLoading ? 'Saving...' : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Request Edit Modal */}
      {editReqForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditReqForm(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Request Edit</h3>
              <button onClick={() => setEditReqForm(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">&times;</button>
            </div>
            <form onSubmit={handleEditRequest} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Field</label>
                <select required value={editReqForm.field}
                  onChange={e => setEditReqForm({ ...editReqForm, field: e.target.value, newValue: '' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Field select karo</option>
                  {[
                    ['name', 'Name'], ['fatherName', 'Father Name'], ['mobileNo', 'Mobile No'],
                    ['whatsappNo', 'WhatsApp No'], ['track', 'Track'], ['subject', 'Subject'],
                    ['fullAddress', 'Full Address'], ['otherTrack', 'Other Track'],
                  ].map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
              {editReqForm.field && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Current Value</label>
                  <input disabled value={student[editReqForm.field] || '—'}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">New Value</label>
                <input required value={editReqForm.newValue}
                  onChange={e => setEditReqForm({ ...editReqForm, newValue: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
                <textarea rows={2} value={editReqForm.reason}
                  onChange={e => setEditReqForm({ ...editReqForm, reason: e.target.value })}
                  placeholder="Kyun change karna hai?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <button type="submit" disabled={editReqLoading}
                className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors">
                {editReqLoading ? 'Bhej raha hai...' : 'Request Bhejo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Status History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-800">Activity History</h3>
                <p className="text-xs text-gray-400 mt-0.5">{history.length} update{history.length !== 1 ? 's' : ''} found</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><FiX size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <FiClock size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">Koi history nahi mili</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-100" />
                  <div className="space-y-4">
                    {history.map((h, idx) => {
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
                      const role = h.changedBy?.role || '';
                      return (
                        <div key={h._id} className="flex gap-4 relative">
                          {/* Timeline dot */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 text-white text-xs font-bold shadow ${
                            idx === 0 ? 'bg-primary' : 'bg-gray-300'
                          }`}>
                            {(h.changedBy?.name || 'U')[0].toUpperCase()}
                          </div>
                          <div className={`flex-1 rounded-xl p-3.5 border ${
                            idx === 0 ? 'border-orange-200 bg-orange-50/40' : 'border-gray-100 bg-white'
                          }`}>
                            {/* Top row: who + when */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-800">
                                  {h.changedBy?.name || 'Unknown'}
                                </span>
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
                            {/* Status + Funnel badges */}
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[h.status] || 'bg-gray-100 text-gray-600'}`}>
                                {h.status}
                              </span>
                              {h.funnelStage && (
                                <span className="text-xs bg-orange-50 text-primary border border-orange-200 px-2.5 py-0.5 rounded-full font-medium">
                                  {h.funnelStage}
                                </span>
                              )}
                            </div>
                            {/* Remark */}
                            {h.remarks && (
                              <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 mt-1">
                                <p className="text-xs text-gray-400 mb-0.5">Remark</p>
                                <p className="text-sm text-gray-700">{h.remarks}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
