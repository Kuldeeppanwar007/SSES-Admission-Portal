import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import BottomSheet from './BottomSheet';
import { TRACK_TOWNS } from '../utils/constants';
import { FiAlertCircle } from 'react-icons/fi';

const VISIT_PURPOSES = ['Inquiry', 'Interview', 'Re-Interview'];
const ALL_TOWNS = Object.values(TRACK_TOWNS).flat();
const ALL_BRANCHES = [
  // SSISM
  'BCA', 'BBA', 'B.Com (CA)', 'BSC (BT)', 'BSC (MICRO)', 'ITEG Diploma',
  // B.Tech
  'B.Tech (CS)', 'B.Tech (IT)', 'B.Tech (ECE)', 'B.Tech (AI/ML)',
];

export default function ReceptionEntryModal({ onClose, student, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: today, town: student?.trackName || '', admissionFormNo: student?.admissionFormNo || '', visitPurpose: '', branch: '', interviewer: '', entryType: 'Offline',
  });
  const [loading, setLoading] = useState(false);
  const [interviewers, setInterviewers] = useState([]);
  const [formNoError, setFormNoError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const hasFormNo = !!student?.admissionFormNo;

  useEffect(() => {
    api.get('/reception/interviewers').then(({ data }) => setInterviewers(data)).catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      await api.post('/reception', { ...form, studentId: student?._id || null });
      toast.success('Reception entry saved!');
      onSaved?.();
      setFormNoError('');
      setForm(f => ({ ...f, admissionFormNo: student?.admissionFormNo || f.admissionFormNo, visitPurpose: '', branch: '', interviewer: '', entryType: 'Offline' }));
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save';
      if (msg.includes('Form No.')) setFormNoError(msg);
      else toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <BottomSheet open onClose={onClose} title="Reception Entry" subtitle="Visitor ka data enter karo" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Entry Type Toggle */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, entryType: 'Offline' }))}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${
              form.entryType === 'Offline' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Offline
          </button>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, entryType: 'Online' }))}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${
              form.entryType === 'Online' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Online
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
          <input type="date" value={form.date} max={today}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Town <span className="text-red-500">*</span></label>
          <select required value={form.town} onChange={e => setForm(f => ({ ...f, town: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select Town</option>
            {ALL_TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Admission Form No. <span className="text-red-500">*</span></label>
          <div className="relative">
            <input required type="text" value={form.admissionFormNo} placeholder="e.g. 1023"
              readOnly={hasFormNo}
              onChange={e => { setForm(f => ({ ...f, admissionFormNo: e.target.value })); setFormNoError(''); }}
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ${
                formNoError ? 'border-red-400 focus:ring-red-300' :
                hasFormNo ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' :
                'border-gray-300 focus:ring-primary'
              }`} />
            {hasFormNo && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-semibold">✓ Fixed</span>
            )}
          </div>
          {formNoError && <p className="text-xs text-red-500 mt-1">⚠️ {formNoError}</p>}
          {!formNoError && hasFormNo && <p className="text-xs text-gray-400 mt-1">Ye form no. is student ke liye permanently set hai</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Visit Purpose <span className="text-red-500">*</span></label>
          <select required value={form.visitPurpose} onChange={e => setForm(f => ({ ...f, visitPurpose: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select Purpose</option>
            {VISIT_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Branch</label>
          <select value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select Branch</option>
            <optgroup label="SSISM">
              {ALL_BRANCHES.slice(0, 6).map(b => <option key={b} value={b}>{b}</option>)}
            </optgroup>
            <optgroup label="B.Tech">
              {ALL_BRANCHES.slice(6).map(b => <option key={b} value={b}>{b}</option>)}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Interviewer</label>
          <select value={form.interviewer} onChange={e => setForm(f => ({ ...f, interviewer: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select Interviewer</option>
            {interviewers.map(i => <option key={i._id} value={i._id}>{i.name}</option>)}
          </select>
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors">
          {loading ? 'Saving...' : 'Save Entry'}
        </button>
      </form>

      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col my-auto max-h-[90vh] text-left">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-orange-50/50 to-white">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-primary shrink-0">
                <FiAlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Confirm Reception Entry</h3>
                <p className="text-xs text-gray-500 font-medium">Please review details before saving the visit entry</p>
              </div>
            </div>

            {/* Content List */}
            <div className="px-6 py-5 overflow-y-auto space-y-4 flex-1">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/80 space-y-2.5">
                {student?.name && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">Student</span>
                    <span className="text-gray-800 font-bold">{student.name}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs border-t border-slate-100/60 pt-2.5">
                  <span className="text-gray-400 font-semibold uppercase tracking-wide">Date</span>
                  <span className="text-gray-700 font-bold">{form.date ? new Date(form.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-100/60 pt-2.5">
                  <span className="text-gray-400 font-semibold uppercase tracking-wide">Entry Type</span>
                  <span className="text-gray-700 font-bold">{form.entryType}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-100/60 pt-2.5">
                  <span className="text-gray-400 font-semibold uppercase tracking-wide">Town</span>
                  <span className="text-gray-700 font-bold">{form.town || '—'}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-100/60 pt-2.5">
                  <span className="text-gray-400 font-semibold uppercase tracking-wide">Form No</span>
                  <span className="text-gray-700 font-bold">{form.admissionFormNo || '—'}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-100/60 pt-2.5">
                  <span className="text-gray-400 font-semibold uppercase tracking-wide">Visit Purpose</span>
                  <span className="text-orange-700 font-bold bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">{form.visitPurpose}</span>
                </div>
                {form.branch && (
                  <div className="flex justify-between items-center text-xs border-t border-slate-100/60 pt-2.5">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">Branch</span>
                    <span className="text-gray-700 font-bold">{form.branch}</span>
                  </div>
                )}
                {form.interviewer && (
                  <div className="flex justify-between items-center text-xs border-t border-slate-100/60 pt-2.5">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">Interviewer</span>
                    <span className="text-gray-700 font-bold">{interviewers.find(i => i._id === form.interviewer)?.name || '—'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 border border-slate-200 bg-white text-gray-500 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all duration-200"
              >
                Cancel / Edit
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl text-xs font-bold hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/20 active:scale-95 transition-all duration-200"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
