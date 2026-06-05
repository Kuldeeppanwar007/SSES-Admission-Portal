import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import { agent } from '../../api/agentApi';
import { TRACKS, STATUSES, STATUS_COLORS, TRACK_TOWNS, TOWN_TO_MAIN_TRACK } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { FiPlus, FiUpload, FiSearch, FiEdit2, FiDownload, FiFilter, FiSlash, FiClipboard, FiExternalLink, FiChevronDown, FiSend, FiClock, FiX, FiFileText, FiAlertCircle, FiPhone, FiRefreshCw } from 'react-icons/fi';
import BottomSheet from '../../components/BottomSheet';
import DatePicker from '../../components/DatePicker';
import ReceptionEntryModal from '../../components/ReceptionEntryModal';
import { isOnline, cacheStudents, getCachedStudents } from '../../utils/offlineQueue';
import { usePerformanceMonitor, useDebounce } from '../../hooks/usePerformance';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const RATING = [
  { value: 1, label: '1. Very Weak' },
  { value: 2, label: '2. Weak' },
  { value: 3, label: '3. Average' },
  { value: 4, label: '4. Good' },
  { value: 5, label: '5. Excellent' },
];

const ASSIGNMENT_RATING = [
  { value: 1, label: '1. Very Poor' },
  { value: 2, label: '2. Poor' },
  { value: 3, label: '3. Average' },
  { value: 4, label: '4. Good' },
  { value: 5, label: '5. Excellent' },
];

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  mathematicsMarks: '', subjectiveKnowledge: '', reasoningMarks: '',
  goalClarity: '', sincerity: '', communicationLevel: '', confidenceLevel: '',
  assignmentMarks: '', result: 'Pending', remarks: '', visitPurpose: '', interviewType: '',
};

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} required
        className="w-full border border-gray-300 rounded-lg px-3 pt-4 pb-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
        <option value="">Select</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

const VISIT_PURPOSES = ['Inquiry', 'Interview', 'Re-Interview'];

function InterviewModal({ student, user, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [prevRound, setPrevRound] = useState(null);
  const [nextRound, setNextRound] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    api.get(`/interviews/${student._id}`).then(({ data }) => {
      setNextRound(data.length + 1);
      if (data.length > 0) setPrevRound(data[data.length - 1]);
    }).catch(() => {});

    // Aaj ki latest reception entry se visitPurpose fetch karo (studentId se)
    api.get(`/reception/by-student/${student._id}`)
      .then(({ data }) => {
        if (data?.visitPurpose) setForm(f => ({ ...f, visitPurpose: data.visitPurpose }));
      }).catch(() => {});
  }, [student._id, student.sn]);

  const totalMark =
    Number(form.mathematicsMarks || 0) + Number(form.subjectiveKnowledge || 0) +
    Number(form.reasoningMarks || 0) + Number(form.goalClarity || 0) +
    Number(form.sincerity || 0) + Number(form.communicationLevel || 0) +
    Number(form.confidenceLevel || 0) + Number(form.assignmentMarks || 0);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const FIELD_LABEL = {
    mathematicsMarks: 'Mathematics', subjectiveKnowledge: 'Subjective Knowledge',
    reasoningMarks: 'Reasoning', goalClarity: 'Goal Clarity', sincerity: 'Sincerity',
    communicationLevel: 'Communication', confidenceLevel: 'Confidence', assignmentMarks: 'Assignment',
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      await api.post(`/interviews/${student._id}`, { ...form, totalMark });
      toast.success('Interview saved!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <BottomSheet open onClose={onClose} title="Technical Interview Form" subtitle={`Student — ${student.name}`} maxWidth="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">

          {/* Previous Round Data */}
          {prevRound && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Round {prevRound.round} — Previous Data ({prevRound.interviewer?.name})</p>
              <div className="grid grid-cols-4 gap-2">
                {Object.keys(FIELD_LABEL).map(key => prevRound[key] != null && (
                  <div key={key} className="bg-white rounded-lg px-3 py-2 border border-orange-100">
                    <p className="text-[10px] text-gray-400">{FIELD_LABEL[key]}</p>
                    <p className="text-sm font-bold text-gray-700">{prevRound[key]} / 5</p>
                  </div>
                ))}
                <div className="bg-white rounded-lg px-3 py-2 border border-orange-100">
                  <p className="text-[10px] text-gray-400">Total</p>
                  <p className="text-sm font-bold text-primary">{prevRound.totalMark}</p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 border border-orange-100">
                  <p className="text-[10px] text-gray-400">Result</p>
                  <p className={`text-sm font-bold ${
                    prevRound.result === 'Pass' ? 'text-emerald-600' :
                    prevRound.result === 'Fail' ? 'text-rose-600' : 'text-amber-600'
                  }`}>{prevRound.result}</p>
                </div>
              </div>
              {prevRound.remarks && <p className="text-xs text-gray-500 mt-2">💬 {prevRound.remarks}</p>}
            </div>
          )}

          {/* Interview Metadata */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Interview Metadata</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Created By</label>
                <input value={user?.name} disabled
                  className="w-full border border-gray-200 rounded-lg px-3 pt-4 pb-2 text-sm bg-gray-50 text-gray-500" />
              </div>
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Select Date</label>
                <DatePicker
                  value={form.date}
                  onChange={(val) => setForm({ ...form, date: val })}
                  max={new Date().toISOString().slice(0, 10)}
                  label="Select Date"
                  className="pt-3"
                />
              </div>
              <div className="relative col-span-2">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Visit Purpose</label>
                <select value={form.visitPurpose} onChange={e => setForm({ ...form, visitPurpose: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 pt-4 pb-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
                  <option value="">Select Purpose</option>
                  {VISIT_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Technical Knowledge */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Technical Knowledge & Aptitude</p>
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Mathematics Marks"    value={form.mathematicsMarks}    onChange={set('mathematicsMarks')}    options={RATING} />
              <SelectField label="Subjective Knowledge" value={form.subjectiveKnowledge} onChange={set('subjectiveKnowledge')} options={RATING} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <SelectField label="Reasoning Marks" value={form.reasoningMarks} onChange={set('reasoningMarks')} options={RATING} />
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Interview Type</label>
                <select value={form.interviewType} onChange={e => setForm(f => ({ ...f, interviewType: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 pt-4 pb-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
                  <option value="">Select Type</option>
                  <option value="Online">Online</option>
                  <option value="On Campus">On Campus</option>
                </select>
              </div>
            </div>
          </div>

          {/* Behaviour & Soft Skill */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Candidate Behaviour & Soft Skill</p>
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Goal Clarity"        value={form.goalClarity}        onChange={set('goalClarity')}        options={RATING} />
              <SelectField label="Sincerity"           value={form.sincerity}           onChange={set('sincerity')}           options={RATING} />
              <SelectField label="Communication Level" value={form.communicationLevel} onChange={set('communicationLevel')} options={RATING} />
              <SelectField label="Confidence Level"    value={form.confidenceLevel}    onChange={set('confidenceLevel')}    options={RATING} />
            </div>
          </div>

          {/* Assignment Evaluation */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Assignment Evaluation</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Attempt No</label>
                <input value={nextRound} disabled
                  className="w-full border border-gray-200 rounded-lg px-3 pt-4 pb-2 text-sm bg-gray-50 text-gray-500" />
              </div>
              <SelectField label="Assignment Marks" value={form.assignmentMarks} onChange={set('assignmentMarks')} options={ASSIGNMENT_RATING} />
            </div>
          </div>

          {/* Summary & Decision */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Summary & Decision</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Total Mark</label>
                <input value={totalMark} disabled
                  className="w-full border border-gray-200 rounded-lg px-3 pt-4 pb-2 text-sm bg-gray-50 font-semibold text-gray-700" />
              </div>
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Result</label>
                <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 pt-4 pb-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
                  {['Pass', 'Fail', 'Pending'].map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>

          <textarea placeholder="Remark / Feedback..." rows={2} value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />

          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors">
            {loading ? 'Saving...' : 'Submit'}
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
                  <h3 className="text-base font-bold text-gray-900">Confirm Technical Interview</h3>
                  <p className="text-xs text-gray-500 font-medium">Please review details before final submission</p>
                </div>
              </div>

              {/* Content List */}
              <div className="px-6 py-5 overflow-y-auto space-y-4 flex-1">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/80 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">Candidate</span>
                    <span className="text-gray-800 font-bold">{student.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">Date</span>
                    <span className="text-gray-700 font-bold">{form.date}</span>
                  </div>
                  {form.visitPurpose && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400 font-semibold uppercase tracking-wide">Visit Purpose</span>
                      <span className="text-gray-700 font-bold">{form.visitPurpose}</span>
                    </div>
                  )}
                  {form.interviewType && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400 font-semibold uppercase tracking-wide">Type</span>
                      <span className="text-gray-700 font-bold">{form.interviewType}</span>
                    </div>
                  )}
                </div>

                {/* Ratings */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ratings & Scores</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ['Mathematics', form.mathematicsMarks],
                      ['Subject Knowledge', form.subjectiveKnowledge],
                      ['Reasoning', form.reasoningMarks],
                      ['Goal Clarity', form.goalClarity],
                      ['Sincerity', form.sincerity],
                      ['Communication', form.communicationLevel],
                      ['Confidence', form.confidenceLevel],
                      ['Assignment', form.assignmentMarks]
                    ].map(([label, val]) => (
                      val && (
                        <div key={label} className="bg-slate-50/50 rounded-xl px-3 py-2 border border-slate-100 flex justify-between items-center">
                          <span className="text-gray-500 font-semibold">{label}</span>
                          <span className="font-bold text-gray-700">{val}/5</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>

                {/* Total & Decision */}
                <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 font-semibold">Total Score</span>
                    <span className="text-base font-bold text-primary">{totalMark} / 40</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 font-semibold">Result Decision</span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      form.result === 'Pass' ? 'bg-emerald-100 text-emerald-700' :
                      form.result === 'Fail' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>{form.result}</span>
                  </div>
                </div>

                {/* Remarks */}
                {form.remarks && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Remarks</p>
                    <p className="text-xs text-gray-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 italic">
                      "{form.remarks}"
                    </p>
                  </div>
                )}
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
                  className="flex-1 bg-primary text-white py-2.5 rounded-xl text-xs font-bold hover:bg-primary-dark hover:shadow-lg active:scale-95 transition-all duration-200"
                >
                  Confirm & Submit
                </button>
              </div>
            </div>
          </div>
        )}
    </BottomSheet>
  );
}

function SearchableSelect({ value, onChange, options, placeholder }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative flex-1 min-w-32" ref={ref}>
      <button type="button" onClick={() => { setOpen(o => !o); setQuery(''); }}
        className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm outline-none bg-white text-left ${
          value ? 'border-primary text-gray-800' : 'border-gray-300 text-gray-500'
        }`}>
        <span className="truncate">{value || placeholder}</span>
        <FiChevronDown size={13} className={`shrink-0 ml-1 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 right-0 w-64 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-primary" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 hover:text-primary ${
                !value ? 'text-primary font-semibold' : 'text-gray-500'
              }`}>{placeholder}</button>
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No results</p>}
            {filtered.map(o => (
              <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 hover:text-primary ${
                  value === o ? 'text-primary font-semibold bg-orange-50/50' : 'text-gray-700'
                }`}>{o}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ACTIVE_STATUSES = STATUSES.filter((s) => s !== 'Disabled');

const ALL_TOWNS = Object.values(TRACK_TOWNS).flat();

const ALL_BRANCHES = [
  // SSISM
  'BCA', 'BBA', 'B.Com (CA)', 'BSC (BT)', 'BSC (MICRO)', 'ITEG Diploma',
  // B.Tech
  'B.Tech (CS)', 'B.Tech (IT)', 'B.Tech (ECE)', 'B.Tech (AI/ML)',
];

export default function Students() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [callingId, setCallingId] = useState(null);
  const [confirmCallStudent, setConfirmCallStudent] = useState(null);

  const handleTriggerCall = async (s) => {
    const phone = s.mobileNo || s.mobile;
    if (!phone) {
      toast.error('Phone number not available');
      return;
    }
    setCallingId(s._id);
    try {
      await agent.triggerCall(phone, s.name);
      toast.success(`AI Call initiated for ${s.name}!`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Call failed');
    } finally {
      setCallingId(null);
    }
  };
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize state from URL params and localStorage
  const getInitialState = () => {
    const savedState = localStorage.getItem('studentsPageState');
    const urlTab = searchParams.get('tab');
    const urlTrack = searchParams.get('track');
    const urlStatus = searchParams.get('status');
    const urlSubject = searchParams.get('subjectFilter');
    const urlAdmissionType = searchParams.get('admissionType');
    const urlInterviewFilter = searchParams.get('interviewFilter');
    const urlFormSource = searchParams.get('formSource');
    const urlFunnelStage = searchParams.get('funnelStage');
    const urlAdmittedNoFunnel = searchParams.get('admittedNoFunnel');
    const urlNoFunnelStage = searchParams.get('noFunnelStage');
    const hasUrlOverride = !!(urlTab || urlTrack || urlStatus || urlSubject || urlAdmissionType || urlInterviewFilter || urlFormSource || urlFunnelStage || urlAdmittedNoFunnel || urlNoFunnelStage);
    
    if (savedState && !hasUrlOverride) {
      try {
        const parsed = JSON.parse(savedState);
        return {
          tab: parsed.tab || 'active',
          page: parsed.page || 1,
          filters: {
            track: parsed.filters?.track || '',
            status: parsed.filters?.status || '',
            town: parsed.filters?.town || '',
            search: parsed.filters?.search || '',
            formSource: parsed.filters?.formSource || '',
            interviewFilter: parsed.filters?.interviewFilter || '',
            funnelStage: parsed.filters?.funnelStage || urlFunnelStage || '',
          noFunnelStage: parsed.filters?.noFunnelStage || urlNoFunnelStage || '',
            admissionType: parsed.filters?.admissionType || '',
            branch: parsed.filters?.branch || '',
            subjectFilter: parsed.filters?.subjectFilter || '',
            village: parsed.filters?.village || '',
            schoolName: parsed.filters?.schoolName || '',
            interviewType: parsed.filters?.interviewType || '',
            hasFormNo: parsed.filters?.hasFormNo || '',
            sortByFormNo: parsed.filters?.sortByFormNo || '',
          },
          showFilters: parsed.showFilters || false
        };
      } catch {
        // If parsing fails, use defaults
      }
    }
    
    return {
      tab: urlTab || 'active',
      page: 1,
      filters: {
        track: urlTrack || '',
        status: urlStatus || '',
        town: '',
        search: '',
        formSource: urlFormSource || '',
        interviewFilter: urlInterviewFilter || '',
        funnelStage: urlFunnelStage || '',
        admittedNoFunnel: urlAdmittedNoFunnel || '',
        noFunnelStage: urlNoFunnelStage || '',
        admissionType: urlAdmissionType || '',
        branch: '',
        subjectFilter: urlSubject || '',
        village: '',
        schoolName: '',
        interviewType: '',
        hasFormNo: '',
        sortByFormNo: '',
      },
      showFilters: !!(urlTrack || urlStatus || urlSubject || urlAdmissionType || urlInterviewFilter || urlFormSource || urlFunnelStage || urlAdmittedNoFunnel)
    };
  };
  
  const initialState = getInitialState();
  const [tab, setTab] = useState(initialState.tab);
  const [page, setPage] = useState(initialState.page);
  const [filters, setFilters] = useState(initialState.filters);
  const [showFilters, setShowFilters] = useState(initialState.showFilters);
  
  // URL se aaye filters ko localStorage mein save mat karo — sirf clear karo
  useEffect(() => {
    const urlFormSource = searchParams.get('formSource');
    const urlInterviewFilter = searchParams.get('interviewFilter');
    if (urlFormSource || urlInterviewFilter) {
      // URL params consume ho gaye, ab localStorage clean state save karo
      return () => localStorage.removeItem('studentsPageState');
    }
  }, []); // eslint-disable-line
  
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const debouncedSearch = useDebounce(filters.search, 300);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [interviewStudent, setInterviewStudent] = useState(null);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [receptionOpen, setReceptionOpen] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [interviewRound, setInterviewRound] = useState('');
  const [maxInterviewRound, setMaxInterviewRound] = useState(3);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const mobileActionsRef = useRef(null);
  const [exportDesktopOpen, setExportDesktopOpen] = useState(false);
  const exportDesktopRef = useRef(null);
  const [exportMobileOpen, setExportMobileOpen] = useState(false);
  const exportMobileRef = useRef(null);
  const [branches, setBranches] = useState([]);
  const [villages, setVillages] = useState([]);
  const [schools, setSchools] = useState([]);
  const [syncingCentral, setSyncingCentral] = useState(false);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [confirmSync, setConfirmSync] = useState(null); // { id, name } ya 'bulk'

  useEffect(() => {
    const handler = (e) => { 
      if (mobileActionsRef.current && !mobileActionsRef.current.contains(e.target)) setMobileActionsOpen(false); 
      if (exportDesktopRef.current && !exportDesktopRef.current.contains(e.target)) setExportDesktopOpen(false);
      if (exportMobileRef.current && !exportMobileRef.current.contains(e.target)) setExportMobileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  
  // Save state to localStorage whenever it changes
  useEffect(() => {
    const stateToSave = {
      tab,
      page,
      filters,
      showFilters
    };
    localStorage.setItem('studentsPageState', JSON.stringify(stateToSave));
    
    // Update URL params
    const newParams = new URLSearchParams();
    if (tab !== 'active') newParams.set('tab', tab);
    if (filters.track) newParams.set('track', filters.track);
    if (filters.status) newParams.set('status', filters.status);
    
    const newSearch = newParams.toString();
    if (newSearch !== searchParams.toString()) {
      setSearchParams(newParams, { replace: true });
    }
  }, [tab, page, filters, showFilters, searchParams, setSearchParams]);
  
  // Clear state when navigating away from students list (but not to student detail/edit)
  useEffect(() => {
    return () => {
      // Only clear state when navigating completely away from students section
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/students')) {
        localStorage.removeItem('studentsPageState');
        localStorage.removeItem('studentsScrollPosition');
      }
    };
  }, []);

  // Get available towns based on selected track
  const getAvailableTowns = () => {
    if (!filters.track) {
      // If no track selected, show all towns
      return Object.values(TRACK_TOWNS).flat();
    }
    return TRACK_TOWNS[filters.track] || [];
  };
  
  const availableTowns = getAvailableTowns();
  
  const filtersRef = useRef(filters);
  const pageRef = useRef(page);
  const tabRef = useRef(tab);
  const debouncedSearchRef = useRef(debouncedSearch);

  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { debouncedSearchRef.current = debouncedSearch; }, [debouncedSearch]);

  const fetchStudents = async (loadMore = false) => {
    setLoading(true);
    try {
      if (!isOnline()) {
        const cached = getCachedStudents();
        if (cached) {
          setStudents(cached.data.students);
          setTotal(cached.data.total);
          setPages(cached.data.pages);
          setHasMore(cached.data.hasMore || false);
          toast('Offline — cached data dikh raha hai', { icon: '📶' });
        }
        return;
      }

      // Central tabs ke liye eligible API use karo
      if (tab === 'shiftCentral' || tab === 'shifted') {
        const { data } = await api.get('/central-sync/eligible', {
          params: { onlyPending: tab === 'shiftCentral' ? '1' : '0', search: debouncedSearch, track: filters.track },
        });
        const all = data.students || [];
        const list = tab === 'shifted' ? all.filter(s => s.shiftedToCentral) : all;
        setStudents(list);
        setTotal(list.length);
        setPages(1);
        setHasMore(false);
        setSelected([]);
        return;
      }
      
      const currentPage = loadMore ? page + 1 : page;
      const params = { 
        page: currentPage, 
        limit: 20,
        track: filters.track,
        status: filters.status,
        town: filters.town,
        formSource: filters.formSource,
        funnelStage: filters.funnelStage,
        admittedNoFunnel: filters.admittedNoFunnel,
        noFunnelStage: filters.noFunnelStage,
        admissionType: filters.admissionType,
        interviewFilter: filters.interviewFilter,
        branch: filters.branch,
        subjectFilter: filters.subjectFilter,
        village: filters.village,
        schoolName: filters.schoolName,
        interviewType: filters.interviewType,
        hasFormNo: filters.hasFormNo,
        sortByFormNo: filters.sortByFormNo,
        search: debouncedSearch,
        ...(tab === 'disabled' ? { status: 'Disabled' } : {}) 
      };
      
      const { data } = await api.get('/students', { params });
      
      if (loadMore) {
        setStudents(prev => [...prev, ...data.students]);
        setPage(currentPage);
      } else {
        setStudents(data.students);
        setSelected([]);
      }
      
      setTotal(data.total);
      setPages(data.pages);
      setHasMore(data.hasMore || false);
      
      if (currentPage === 1 && tab === 'active') {
        cacheStudents(data);
      }
    } catch { 
      toast.error('Failed to load students'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchStudents(); }, [page, filters, tab, debouncedSearch]); // eslint-disable-line

  // Mobile pe page visible hone par re-fetch karo (tab switch ke baad)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchStudents();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []); // eslint-disable-line

  useEffect(() => {
    api.get('/students/max-interview-round')
      .then(r => setMaxInterviewRound(r.data.maxRound || 1))
      .catch(() => {});
    api.get('/students/distinct-branches')
      .then(r => setBranches(r.data || []))
      .catch(() => {});
    api.get('/students/distinct-villages')
      .then(r => setVillages(r.data || []))
      .catch(() => {});
    api.get('/students/distinct-schools')
      .then(r => setSchools(r.data || []))
      .catch(() => {});
  }, []);
  
  // Restore scroll position when returning to the page
  useEffect(() => {
    const savedScrollPosition = localStorage.getItem('studentsScrollPosition');
    if (savedScrollPosition && students.length > 0) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollPosition));
        localStorage.removeItem('studentsScrollPosition');
      }, 100); // Small delay to ensure content is rendered
    }
  }, [students]);

  // Remove old debounced search function since we're using the hook
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setFilters(prev => ({ ...prev, search: value }));
    setPage(1);
  };

  const switchTab = (t) => { 
    setTab(t); 
    setPage(1); 
    setFilters({ track: '', status: '', town: '', search: '', formSource: '', interviewFilter: '', funnelStage: '', admittedNoFunnel: '', noFunnelStage: '', admissionType: '', branch: '', subjectFilter: '', village: '', schoolName: '', interviewType: '', hasFormNo: '', sortByFormNo: '' }); 
    setSelected([]);
    setHasMore(false);
    setInterviewRound('');
    localStorage.removeItem('studentsPageState');
  };

  const toggleSelect = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === students.length ? [] : students.map((s) => s._id));

  const handleExport = async (ids = [], format = 'xlsx') => {
    setExporting(true);
    try {
      const params = ids.length === 0 ? { ...filters, ...(tab === 'disabled' ? { status: 'Disabled' } : {}) } : {};
      
      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2,'0')}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getFullYear()}`;
      
      let filename;
      let namePart = 'student';
      if (ids.length === 1) {
        const student = students.find(s => s._id === ids[0]);
        namePart = student ? student.name.replace(/[^a-zA-Z0-9]/g, '_') : 'student';
        filename = `${namePart}_${dateStr}`;
      } else if (ids.length > 1) {
        filename = `students_selected_${dateStr}`;
      } else {
        const trackPart = filters.track ? filters.track.replace(/[^a-zA-Z0-9]/g, '_') : 'all';
        filename = `students_${trackPart}_${dateStr}`;
      }

      if (format === 'pdf') {
        const res = await api.post('/students/export', { ids }, { params: { ...params, format: 'json' } });
        const rows = res.data;
        if (!rows || rows.length === 0) {
          toast.error('No data to export');
          return;
        }

        const doc = new jsPDF('landscape');
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`Students Export (${dateStr})`, 10, 15);
        
        const headers = Object.keys(rows[0]);
        const data = rows.map(row => Object.values(row).map(v => v ? String(v) : ''));

        autoTable(doc, {
          startY: 22,
          head: [headers],
          body: data,
          theme: 'grid',
          styles: { 
            font: 'helvetica',
            fontSize: 8, 
            cellPadding: 3,
            lineColor: [226, 232, 240],
            lineWidth: 0.1,
            textColor: [51, 65, 85],
          },
          headStyles: { 
            fillColor: [249, 115, 22],
            textColor: [255, 255, 255], 
            fontStyle: 'bold',
            halign: 'center'
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            4: { halign: 'center' },
            5: { halign: 'center' },
            10: { halign: 'center' },
            13: { halign: 'center' }
          },
          alternateRowStyles: { 
            fillColor: [255, 251, 245]
          },
          margin: { top: 20, left: 10, right: 10 }
        });

        doc.save(`${filename}.pdf`);
        toast.success(`${ids.length > 0 ? ids.length : 'All'} students exported as PDF`);
      } else {
        const res = await api.post('/students/export', { ids }, { params, responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success(`${ids.length > 0 ? ids.length : 'All'} students exported as Excel`);
      }
    } catch (err) { 
      console.error("Export error:", err);
      toast.error('Export failed'); 
    }
    finally { setExporting(false); }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/students/download-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'students_template.xlsx'; a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download template'); }
  };

  const handleDownloadCSVTemplate = async () => {
    try {
      const res = await api.get('/students/download-csv-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'students_template.csv'; a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download CSV template'); }
  };

  const handleSyncSingle = async (studentId, studentName) => {
    setConfirmSync({ id: studentId, name: studentName });
  };

  const doSyncSingle = async (studentId) => {
    setSyncingCentral(true);
    try {
      const { data } = await api.post(`/central-sync/${studentId}`);
      if (data.success) {
        toast.success(data.message || 'Student central ko bhej diya');
      } else {
        toast.error(data.message || 'Sync failed');
      }
      setConfirmSync(null);
      fetchStudents();
    } catch (err) { toast.error(err.response?.data?.message || 'Sync failed'); }
    finally { setSyncingCentral(false); }
  };

  const handleBulkSync = async () => {
    if (selected.length === 0) return toast.error('Koi student select nahi kiya');
    setConfirmSync('bulk');
  };

  const doBulkSync = async () => {
    setSyncingCentral(true);
    try {
      const { data } = await api.post('/central-sync/bulk', { ids: selected });
      toast.success(`${data.success} students central ko bheje${data.failed > 0 ? `, ${data.failed} failed` : ''}`);
      setSelected([]);
      setConfirmSync(null);
      fetchStudents();
    } catch (err) { toast.error(err.response?.data?.message || 'Bulk sync failed'); }
    finally { setSyncingCentral(false); }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const formData = new FormData(); formData.append('file', file);
    try {
      const { data } = await api.post('/students/bulk-upload', formData);
      toast.success(data.message); fetchStudents();
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    e.target.value = '';
  };

  const isDisabledTab = tab === 'disabled';
  const isShiftCentralTab = tab === 'shiftCentral';
  const isShiftedTab = tab === 'shifted';
  const isCentralTab = isShiftCentralTab || isShiftedTab;
  const allSelected = students.length > 0 && selected.length === students.length;
  const canSendCentral = user?.role === 'admin' && user?.canEditStudent;

  // Memoize filtered students for better performance
  const displayStudents = useMemo(() => {
    const sorted = [...students].sort((a, b) => {
      if (b.isPriority && !a.isPriority) return 1;
      if (a.isPriority && !b.isPriority) return -1;
      return 0;
    });
    return sorted.map((s, i) => {
      const displayTrack = TOWN_TO_MAIN_TRACK[s.track] || s.track;
      return { ...s, displayTrack, serialNumber: (page - 1) * 20 + i + 1 };
    });
  }, [students, page]);

  const handleViewHistory = async (s) => {
    setHistoryStudent(s);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const { data } = await api.get(`/students/${s._id}/status-history`);
      setHistory(data);
    } catch { toast.error('Failed to load history'); }
    finally { setHistoryLoading(false); }
  };

  return (
    <div>
      {/* Central Sync Confirmation */}
      {confirmSync && (
        <BottomSheet
          open
          onClose={() => !syncingCentral && setConfirmSync(null)}
          title="Send to Central"
          subtitle={confirmSync === 'bulk'
            ? `${selected.length} student${selected.length > 1 ? 's' : ''} will be sent to Central`
            : `Send "${confirmSync.name}" to Central?`
          }
          maxWidth="max-w-sm"
        >
          <div className="pt-2 space-y-3">
            <p className="text-sm text-gray-500">
              {confirmSync === 'bulk'
                ? `${selected.length} student${selected.length > 1 ? 's' : ''} will be registered in the Central database. This action cannot be undone.`
                : 'This student will be registered in the Central database. This action cannot be undone.'
              }
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => confirmSync === 'bulk' ? doBulkSync() : doSyncSingle(confirmSync.id)}
                disabled={syncingCentral}
                className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 transition-colors">
                {syncingCentral
                  ? <><FiRefreshCw size={14} className="animate-spin" /> Sending...</>
                  : <><FiSend size={14} /> Confirm & Send</>}
              </button>
              <button
                onClick={() => setConfirmSync(null)}
                disabled={syncingCentral}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium disabled:opacity-60">
                Cancel
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {interviewStudent && (
        <InterviewModal
          student={interviewStudent}
          user={user}
          onClose={() => setInterviewStudent(null)}
          onSaved={fetchStudents}
        />
      )}

      {receptionOpen && <ReceptionEntryModal onClose={() => setReceptionOpen(null)} student={receptionOpen} onSaved={fetchStudents} />}

      {/* Trigger AI Call Confirmation Modal */}
      {confirmCallStudent && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 animate-in fade-in duration-200"
          onClick={() => setConfirmCallStudent(null)}
        >
          <div 
            className="bg-white rounded-3xl border border-gray-100 max-w-sm w-full p-6 text-left shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header Card */}
            <div className="flex items-center gap-3 mb-4 bg-orange-50/50 p-4 rounded-2xl border border-orange-100/50">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-primary shrink-0">
                <FiPhone size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 leading-tight">{confirmCallStudent.name}</p>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">{confirmCallStudent.mobileNo || confirmCallStudent.mobile}</p>
              </div>
            </div>
            
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed mb-6 font-semibold">
              Kya aap sach mein is student ko AI Agent se call lagana chahte hain?
            </p>

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setConfirmCallStudent(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 active:scale-95 transition-all duration-200 bg-white"
              >
                Cancel / Exit
              </button>
              <button
                type="button"
                onClick={() => {
                  const studentToCall = confirmCallStudent;
                  setConfirmCallStudent(null);
                  handleTriggerCall(studentToCall);
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/20 active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5"
              >
                <FiPhone size={13} />
                Confirm & Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyStudent && (
        <BottomSheet open onClose={() => setHistoryStudent(null)} title="Activity History" subtitle={`${historyStudent.name} — ${history.length} update${history.length !== 1 ? 's' : ''}`}>
            <div className="pt-2">
              {historyLoading ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <FiClock size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">Koi history nahi mili</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-100" />
                  <div className="space-y-4">
                    {history.map((h, idx) => {
                      const roleColors = { admin: 'bg-purple-100 text-purple-700', track_incharge: 'bg-blue-100 text-blue-700', manager: 'bg-green-100 text-green-700' };
                      const roleLabel = { admin: 'Admin', track_incharge: 'Track Incharge', manager: 'Manager' };
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
                                {role && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleColors[role] || 'bg-gray-100 text-gray-500'}`}>{roleLabel[role] || role}</span>}
                              </div>
                              <span className="text-[11px] text-gray-400 shrink-0">{new Date(h.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[h.status] || 'bg-gray-100 text-gray-600'}`}>{h.status}</span>
                              {h.funnelStage && <span className="text-xs bg-orange-50 text-primary border border-orange-200 px-2.5 py-0.5 rounded-full font-medium">{h.funnelStage}</span>}
                            </div>
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
        </BottomSheet>
      )}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">
          Students <span className="text-gray-400 text-base">({total})</span>
        </h2>
        {/* Desktop buttons */}
        <div className="hidden md:flex gap-2">
          {user?.role === 'receptionist' && (
            <button onClick={() => setReceptionOpen({})}
              className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-lg text-sm">
              <FiFileText size={13} /> Reception Entry
            </button>
          )}
          <div className="relative" ref={exportDesktopRef}>
            <button onClick={() => setExportDesktopOpen(!exportDesktopOpen)} disabled={exporting}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${selected.length > 0 ? 'bg-primary text-white hover:bg-primary-dark' : 'border border-primary text-primary hover:bg-orange-50'}`}>
              <FiDownload size={13} /> {exporting ? 'Exporting...' : (selected.length > 0 ? `Export (${selected.length})` : 'Export All')}
              <FiChevronDown size={14} className={`transition-transform ${exportDesktopOpen ? 'rotate-180' : ''}`} />
            </button>
            {exportDesktopOpen && (
              <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <button onClick={() => { handleExport(selected, 'xlsx'); setExportDesktopOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary">
                  Excel
                </button>
                <button onClick={() => { handleExport(selected, 'pdf'); setExportDesktopOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary">
                  PDF
                </button>
              </div>
            )}
          </div>
          {!isDisabledTab && (
            <>
              <button onClick={handleDownloadTemplate}
                className="flex items-center gap-1 border border-primary text-primary px-3 py-1.5 rounded-lg text-sm hover:bg-orange-50">
                <FiDownload size={13} /> Excel Template
              </button>
              <button onClick={handleDownloadCSVTemplate}
                className="flex items-center gap-1 border border-primary text-primary px-3 py-1.5 rounded-lg text-sm hover:bg-orange-50">
                <FiDownload size={13} /> CSV Template
              </button>
              <label className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-primary-dark">
                <FiUpload size={13} /> Bulk Upload
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkUpload} />
              </label>
              <a href="https://central.ssism.org/self_registration" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-lg text-sm">
                <FiExternalLink size={13} /> SSISM Form
              </a>
              <a href="https://ssec.ssism.org/apply" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-lg text-sm">
                <FiExternalLink size={13} /> SSEC Form
              </a>
            </>
          )}
        </div>
      </div>

      {/* Mobile — Actions dropdown */}
      <div className="md:hidden mb-3 flex gap-2">
        {user?.role === 'receptionist' && (
          <button onClick={() => setReceptionOpen({})}
            className="flex-1 flex items-center justify-center gap-1 bg-primary text-white py-2 rounded-lg text-sm font-medium">
            <FiFileText size={13} /> Reception Entry
          </button>
        )}
        <div className="relative flex-1" ref={exportMobileRef}>
          <button onClick={() => setExportMobileOpen(!exportMobileOpen)} disabled={exporting}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${selected.length > 0 ? 'bg-primary text-white hover:bg-primary-dark' : 'bg-primary text-white hover:bg-primary-dark'}`}>
            <FiDownload size={13} /> {exporting ? 'Exporting...' : (selected.length > 0 ? `Export (${selected.length})` : 'Export')}
            <FiChevronDown size={14} className={`transition-transform ${exportMobileOpen ? 'rotate-180' : ''}`} />
          </button>
          {exportMobileOpen && (
            <div className="absolute right-0 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
              <button onClick={() => { handleExport(selected, 'xlsx'); setExportMobileOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary">
                Excel
              </button>
              <button onClick={() => { handleExport(selected, 'pdf'); setExportMobileOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary">
                PDF
              </button>
            </div>
          )}
        </div>
        {!isDisabledTab && (
          <div className="relative flex-1" ref={mobileActionsRef}>
            <button onClick={() => setMobileActionsOpen(o => !o)}
              className="w-full flex items-center justify-center gap-1 border border-primary text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-50">
              Actions <FiChevronDown size={14} className={`transition-transform ${mobileActionsOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileActionsOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <button onClick={() => { handleDownloadTemplate(); setMobileActionsOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary">
                  <FiDownload size={14} /> Excel Template
                </button>
                <button onClick={() => { handleDownloadCSVTemplate(); setMobileActionsOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary">
                  <FiDownload size={14} /> CSV Template
                </button>
                <label className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary cursor-pointer">
                  <FiUpload size={14} /> Bulk Upload
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { handleBulkUpload(e); setMobileActionsOpen(false); }} />
                </label>
                <a href="https://central.ssism.org/self_registration" target="_blank" rel="noopener noreferrer"
                  onClick={() => setMobileActionsOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary">
                  <FiExternalLink size={14} /> SSISM Form
                </a>
                <a href="https://ssec.ssism.org/apply" target="_blank" rel="noopener noreferrer"
                  onClick={() => setMobileActionsOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-primary">
                  <FiExternalLink size={14} /> SSEC Form
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs + inline quick filters */}
      <div className="mb-4">
        {/* Desktop tabs */}
        <div className="hidden md:flex items-center justify-between gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            <button onClick={() => switchTab('active')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'active' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              <FiSearch size={14} /> Active Profiles
            </button>
                <button onClick={() => switchTab('shiftCentral')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'shiftCentral' ? 'bg-primary shadow text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                  <FiSend size={14} /> Shift Central
                </button>
                <button onClick={() => switchTab('shifted')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'shifted' ? 'bg-primary shadow text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                  <FiRefreshCw size={14} /> Shifted Students
                </button>
            <button onClick={() => switchTab('disabled')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'disabled' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              <FiSlash size={14} /> Disabled
            </button>
          </div>
          {/* Track filter — sirf non-central tabs pe */}
          {!isCentralTab && (
            <div className="flex items-center gap-2">
              {user?.role !== 'track_incharge' && (
                <select value={filters.track} onChange={(e) => { setFilters({ ...filters, track: e.target.value, town: '' }); setPage(1); }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none bg-white">
                  <option value="">All Tracks</option>
                  {TRACKS.map((t) => <option key={t}>{t}</option>)}
                </select>
              )}
              <select value={filters.town} onChange={(e) => { setFilters({ ...filters, town: e.target.value }); setPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none bg-white">
                <option value="">All Towns</option>
                {availableTowns.map((town) => <option key={town} value={town}>{town}</option>)}
              </select>
              {villages.length > 0 && (
                <select value={filters.village} onChange={(e) => { setFilters({ ...filters, village: e.target.value }); setPage(1); }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none bg-white">
                  <option value="">All Villages/Cities</option>
                  {villages.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
            </div>
          )}
          {/* Central tabs — track filter only */}
          {isCentralTab && user?.role !== 'track_incharge' && (
            <select value={filters.track} onChange={(e) => { setFilters({ ...filters, track: e.target.value }); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none bg-white">
              <option value="">All Tracks</option>
              {TRACKS.map((t) => <option key={t}>{t}</option>)}
            </select>
          )}
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden">
          <div className="grid grid-cols-2 gap-1 mb-2">
            <button onClick={() => switchTab('active')}
              className={`flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold rounded-xl transition-colors border ${
                tab === 'active' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-200'
              }`}>
              <FiSearch size={13} /> Active
            </button>
                <button onClick={() => switchTab('shiftCentral')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold rounded-xl transition-colors border ${
                    tab === 'shiftCentral' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-200'
                  }`}>
                  <FiSend size={13} /> Shift Central
                </button>
                <button onClick={() => switchTab('shifted')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold rounded-xl transition-colors border ${
                    tab === 'shifted' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-200'
                  }`}>
                  <FiRefreshCw size={13} /> Shifted
                </button>
            <button onClick={() => switchTab('disabled')}
              className={`flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold rounded-xl transition-colors border ${
                tab === 'disabled' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-200'
              }`}>
              <FiSlash size={13} /> Disabled
            </button>
          </div>
          {!isCentralTab && user?.role !== 'track_incharge' && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              <select value={filters.track} onChange={(e) => { setFilters({ ...filters, track: e.target.value, town: '' }); setPage(1); }}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none bg-white w-full">
                <option value="">All Tracks</option>
                {TRACKS.map((t) => <option key={t}>{t}</option>)}
              </select>
              <select value={filters.town} onChange={(e) => { setFilters({ ...filters, town: e.target.value }); setPage(1); }}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none bg-white w-full">
                <option value="">All Towns</option>
                {availableTowns.map((town) => <option key={town} value={town}>{town}</option>)}
              </select>
              {villages.length > 0 ? (
                <select value={filters.village} onChange={(e) => { setFilters({ ...filters, village: e.target.value }); setPage(1); }}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none bg-white w-full">
                  <option value="">All Villages</option>
                  {villages.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : <div />}
            </div>
          )}
          {!isCentralTab && user?.role === 'track_incharge' && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select value={filters.town} onChange={(e) => { setFilters({ ...filters, town: e.target.value }); setPage(1); }}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none bg-white w-full">
                <option value="">All Towns</option>
                {availableTowns.map((town) => <option key={town} value={town}>{town}</option>)}
              </select>
              {villages.length > 0 && (
                <select value={filters.village} onChange={(e) => { setFilters({ ...filters, village: e.target.value }); setPage(1); }}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none bg-white w-full">
                  <option value="">All Villages</option>
                  {villages.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search + Filters — sirf non-central tabs pe */}
      {!isCentralTab && (
      <div className="bg-white rounded-xl shadow p-3 mb-4 space-y-2">
        <div className="flex gap-2">
          <div className="flex items-center gap-2 flex-1 border border-gray-300 rounded-lg px-3">
            <FiSearch className="text-gray-400 shrink-0" size={15} />
            <input placeholder="Search name, father, mobile, track..." value={filters.search}
              onChange={handleSearchChange}
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
            <select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
              className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="">All Status</option>
              {ACTIVE_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={filters.hasFormNo || ''} onChange={(e) => { setFilters({ ...filters, hasFormNo: e.target.value }); setPage(1); }}
              className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="">All Form Status</option>
              <option value="true">Has Form No</option>
              <option value="false">No Form No</option>
            </select>
            <select value={filters.formSource} onChange={(e) => { 
              const newFilters = { ...filters, formSource: e.target.value };
              setFilters(newFilters); 
              setPage(1); 
            }}
              className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="">All Forms</option>
              <option value="btech">B.Tech (ITEG)</option>
              <option value="ssism">SSISM</option>
              <option value="manual">Manual</option>
            </select>
            <select value={filters.interviewFilter} onChange={(e) => { 
              const val = e.target.value;
              setFilters({ ...filters, interviewFilter: val }); 
              setInterviewRound(val?.startsWith('round_') ? val.split('_')[1] : '');
              setPage(1); 
            }}
              className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="">All Interviews</option>
              <option value="hasAttempts">Has Attempts (All Rounds)</option>
              {Array.from({ length: maxInterviewRound }, (_, i) => i + 1).map(r => (
                <option key={r} value={`round_${r}`}>Round {r}</option>
              ))}
              <option value="finalCleared">Final Cleared</option>
            </select>
            <select value={filters.interviewType || ''} onChange={(e) => { setFilters({ ...filters, interviewType: e.target.value }); setPage(1); }}
              className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="">All Interview Types</option>
              <option value="Online">Online</option>
              <option value="On Campus">On Campus</option>
            </select>
            <select value={filters.funnelStage} onChange={(e) => { 
              const newFilters = { ...filters, funnelStage: e.target.value };
              setFilters(newFilters); 
              setPage(1); 
            }}
              className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="">All Funnel Stages</option>
              {['Call Completed', 'Lead Interested', 'Admission Closed', 'Call Not Received', 'Wrong Number', 'Switch Off', 'Repeated No Response', 'Not Interested', 'Joined Elsewhere'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <select value={filters.admissionType || ''} onChange={(e) => { setFilters({ ...filters, admissionType: e.target.value }); setPage(1); }}
                className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">All Admission Types</option>
                {['SNS', 'SVS', 'Shri Ram', 'Full Fees'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {branches.length > 0 && (
              <select value={filters.branch} onChange={(e) => { setFilters({ ...filters, branch: e.target.value }); setPage(1); }}
                className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
            {schools.length > 0 && user?.role === 'track_incharge' && (
              <SearchableSelect
                value={filters.schoolName}
                onChange={(v) => { setFilters({ ...filters, schoolName: v }); setPage(1); }}
                options={schools}
                placeholder="All Schools"
              />
            )}
          </div>
        )}
      </div>
      )}

      {/* Central Tabs — Shift Central & Shifted Students */}
      {isCentralTab && (
        <div className="bg-white rounded-xl shadow p-3 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 border border-gray-300 rounded-lg px-3">
              <FiSearch className="text-gray-400 shrink-0" size={15} />
              <input placeholder="Search name, mobile..." value={filters.search}
                onChange={handleSearchChange}
                className="flex-1 py-2 outline-none text-sm" />
            </div>
            {/* COMMENTED OUT — bulk Send Selected to Central (abhi jarurat nahi)
            {tab === 'shiftCentral' && (
              <button onClick={handleBulkSync} disabled={!canSendCentral || syncingCentral || selected.length === 0}
                title={!canSendCentral ? 'Sirf Student Editor admin hi send kar sakte hain' : ''}
                className={`flex items-center gap-1.5 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors shrink-0 ${canSendCentral ? 'bg-primary hover:bg-primary-dark' : 'bg-gray-400 cursor-not-allowed'}`}>
                {syncingCentral
                  ? <><FiRefreshCw size={13} className="animate-spin" /> Sending...</>
                  : <><FiSend size={13} /> Send {selected.length > 0 ? `(${selected.length})` : 'Selected'} to Central</>}
              </button>
            )}
            */}
          </div>
        </div>
      )}

      {/* Central tab — table */}
      {isCentralTab && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FiSend size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">{tab === 'shiftCentral' ? 'Koi pending student nahi' : 'Koi shifted student nahi'}</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {/* COMMENTED OUT — select all checkbox (abhi jarurat nahi)
                      {tab === 'shiftCentral' && (
                        <th className="px-4 py-3 w-10">
                          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!canSendCentral}
                            title={!canSendCentral ? 'Sirf Student Editor admin hi select kar sakte hain' : ''}
                            className={`rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 ${canSendCentral ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`} />
                        </th>
                      )}
                      */}
                      {['S.N.', 'Name', 'Father Name', 'Track', 'Mobile', 'Form', 'Branch/Priority', tab === 'shifted' ? 'Shifted At' : 'Action'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold uppercase text-gray-500 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {students.map((s, i) => (
                      <tr key={s._id} className={`${user?.role === 'admin' ? 'hover:bg-gray-50 cursor-pointer' : ''}`} onClick={() => user?.role === 'admin' && navigate(`/students/${s._id}`)}>                        {/* COMMENTED OUT — row checkbox (abhi jarurat nahi)
                        {tab === 'shiftCentral' && (
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.includes(s._id)} onChange={() => toggleSelect(s._id)} disabled={!canSendCentral}
                              title={!canSendCentral ? 'Sirf Student Editor admin hi select kar sakte hain' : ''}
                              className={`rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 ${canSendCentral ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`} />
                          </td>
                        )}
                        */}
                        <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                        <td className="px-4 py-3 text-gray-600">{s.fatherName}</td>
                        <td className="px-4 py-3 text-gray-600">{s.track}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {s.mobileNo && <a href={`tel:${s.mobileNo}`} className="text-gray-600 hover:text-primary hover:underline">{s.mobileNo}</a>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            s.formSource === 'btech' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>{s.formSource === 'btech' ? 'B.Tech' : 'SSISM'}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{s.branch || s.priority1 || s.subject || '—'}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {tab === 'shifted' ? (
                            <span className="text-xs text-gray-400">{s.shiftedAt ? new Date(s.shiftedAt).toLocaleDateString('en-IN') : '—'}</span>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); if (canSendCentral) handleSyncSingle(s._id, s.name); }}
                              disabled={!canSendCentral || syncingCentral}
                              title={!canSendCentral ? 'Sirf Student Editor admin hi send kar sakte hain' : ''}
                              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 text-white rounded-lg disabled:opacity-60 ${canSendCentral ? 'bg-primary hover:bg-primary-dark' : 'bg-gray-400 cursor-not-allowed'}`}>
                              <FiSend size={11} /> Send
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {students.map((s, i) => (
                  <div key={s._id} className={`p-4 flex items-center gap-3 ${user?.role === 'admin' ? 'cursor-pointer' : ''}`} onClick={() => user?.role === 'admin' && navigate(`/students/${s._id}`)}>                    {/* COMMENTED OUT — mobile checkbox (abhi jarurat nahi)
                    {tab === 'shiftCentral' && (
                      <input type="checkbox" checked={selected.includes(s._id)}
                        onChange={e => { e.stopPropagation(); toggleSelect(s._id); }}
                        onClick={e => e.stopPropagation()}
                        disabled={!canSendCentral}
                        title={!canSendCentral ? 'Sirf Student Editor admin hi select kar sakte hain' : ''}
                        className={`rounded border-gray-300 text-emerald-600 shrink-0 ${canSendCentral ? '' : 'cursor-not-allowed opacity-50'}`} />
                    )}
                    */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{i + 1}. {s.name}</p>
                      <p className="text-xs text-gray-400">{s.fatherName} · {s.mobileNo}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          s.formSource === 'btech' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>{s.formSource === 'btech' ? 'B.Tech' : 'SSISM'}</span>
                        <span className="text-xs text-gray-400">{s.track}</span>
                        {tab === 'shifted' && s.shiftedAt && (
                          <span className="text-xs text-emerald-600">✓ {new Date(s.shiftedAt).toLocaleDateString('en-IN')}</span>
                        )}
                      </div>
                    </div>
                    {tab === 'shiftCentral' && (
                      <button onClick={e => { e.stopPropagation(); if (canSendCentral) handleSyncSingle(s._id, s.name); }}
                        disabled={!canSendCentral || syncingCentral}
                        title={!canSendCentral ? 'Sirf Student Editor admin hi send kar sakte hain' : ''}
                        className={`flex items-center gap-1 text-xs font-medium px-3 py-2 text-white rounded-lg disabled:opacity-60 shrink-0 ${canSendCentral ? 'bg-primary hover:bg-primary-dark' : 'bg-gray-400 cursor-not-allowed'}`}>
                        <FiSend size={12} /> Send
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {!isCentralTab && selected.length > 0 && (
        <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 mb-3">
          <span className="text-sm font-semibold text-primary">{selected.length} student{selected.length > 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <button onClick={() => setSelected([])} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 bg-white">Clear</button>
            <button onClick={() => handleExport(selected)} disabled={exporting}
              className="text-xs text-white bg-primary hover:bg-primary-dark px-3 py-1 rounded font-semibold disabled:opacity-60 flex items-center gap-1">
              <FiDownload size={12} /> Export Selected
            </button>
          </div>
        </div>
      )}

      {/* Table — desktop, sirf non-central tabs */}
      {!isCentralTab && <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
        {loading && students.length === 0 ? (
          // Loading skeleton
          <div className="animate-pulse">
            <div className="bg-gray-50 border-b px-4 py-3">
              <div className="flex gap-4">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded flex-1"></div>
                ))}
              </div>
            </div>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="border-b px-4 py-3">
                <div className="flex gap-4">
                  {Array.from({ length: 11 }).map((_, j) => (
                    <div key={j} className="h-4 bg-gray-100 rounded flex-1"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                  </th>
                  {['S.N.', 'Form No.', 'Name', 'Adm. Type', 'Father Name', 'Track', 'Town', 'Mobile', 'Form', 'Status', 'Attempt', 'History', 'Actions'].map((h) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase text-gray-500 ${h === 'Attempt' ? 'text-center' : 'text-left'}`}>
                      {h === 'Form No.' ? (
                        <div className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => {
                          setFilters(f => ({ ...f, sortByFormNo: f.sortByFormNo === 'asc' ? 'desc' : (f.sortByFormNo === 'desc' ? '' : 'asc') }));
                          setPage(1);
                        }}>
                          {h}
                          {filters.sortByFormNo === 'asc' ? <span className="text-primary text-sm leading-none">↑</span> : filters.sortByFormNo === 'desc' ? <span className="text-primary text-sm leading-none">↓</span> : <span className="text-gray-300 text-sm leading-none">↕</span>}
                        </div>
                      ) : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-10 text-gray-400">No students found</td></tr>
                ) : displayStudents.map((s, i) => (
                  <tr key={s._id} onClick={() => {
                    // Save current scroll position
                    const scrollPosition = window.pageYOffset;
                    localStorage.setItem('studentsScrollPosition', scrollPosition.toString());
                    navigate(`/students/${s._id}`);
                  }} className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                    s.isPriority ? 'bg-violet-50 border-l-4 border-l-violet-400' :
                    selected.includes(s._id) ? 'bg-orange-50/50' : ''
                  }`}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(s._id)} onChange={() => toggleSelect(s._id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{s.serialNumber}</td>
                    <td className="px-4 py-3">
                      {s.admissionFormNo ? (
                        <span className="text-xs font-semibold bg-orange-50 text-primary border border-orange-100 px-2 py-0.5 rounded-full">{s.admissionFormNo}</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        {s.isPriority && <span className="text-violet-500 text-xs font-bold" title="Priority">⚡</span>}
                        {s.isTopper && <span className="text-yellow-500 text-xs" title="Topper">🏆</span>}
                        {s.finalInterview?.result && <span className="text-emerald-500 text-base leading-none" title="Final Interview Done">★</span>}
                        {s.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.admissionType ? <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-[10px] font-bold tracking-wide" title="Admission Type">{s.admissionType}</span> : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.fatherName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.displayTrack || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.trackName || '—'}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {s.mobileNo ? (
                        <button
                          onClick={() => setConfirmCallStudent(s)}
                          disabled={callingId !== null}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0 ${
                            callingId === s._id
                              ? 'bg-orange-100 border-orange-200 text-primary animate-pulse'
                              : 'bg-orange-50 border-orange-100 text-primary hover:bg-primary hover:text-white hover:border-primary active:scale-95'
                          }`}
                          title={`Trigger AI Call to ${s.name}`}
                        >
                          {callingId === s._id ? (
                            <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <FiPhone className="shrink-0" size={12} />
                          )}
                          <span>{s.mobileNo}</span>
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.formSource && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          s.formSource === 'btech' ? 'bg-blue-100 text-blue-700' :
                          s.formSource === 'ssism' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {s.formSource === 'btech' ? 'B.Tech' : s.formSource === 'ssism' ? 'SSISM' : 'Manual'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.finalInterview?.result === 'Pass' ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">✓ Cleared</span>
                      ) : s.finalInterview?.result === 'Fail' ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-rose-100 text-rose-600">✗ Final Failed</span>
                      ) : s.finalInterview?.result === 'Pending' ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">⏳ Final Pending</span>
                      ) : s.interviewCount > 0 ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-50 text-primary border border-orange-200">Round {s.interviewCount}</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(user?.role === 'admin' || user?.role === 'interviewer') ? (
                        <button onClick={(e) => { e.stopPropagation(); setInterviewStudent(s); }}
                          className="flex items-center gap-1 text-xs text-white font-medium px-2.5 py-1.5 bg-primary hover:bg-primary-dark rounded-lg transition-colors">
                          <FiClipboard size={12} /> Interview
                        </button>
                      ) : user?.role === 'receptionist' ? (
                        <button onClick={(e) => { e.stopPropagation(); setReceptionOpen(s); }}
                          className="flex items-center gap-1 text-xs text-white font-medium px-2.5 py-1.5 bg-primary hover:bg-primary-dark rounded-lg transition-colors">
                          <FiFileText size={12} /> Entry
                        </button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); handleViewHistory(s); }}
                          className="flex items-center gap-1 text-xs text-white font-medium px-2.5 py-1.5 bg-primary hover:bg-primary-dark rounded-lg transition-colors">
                          <FiClock size={12} /> History
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={(e) => { 
                        e.stopPropagation(); 
                        const scrollPosition = window.pageYOffset;
                        localStorage.setItem('studentsScrollPosition', scrollPosition.toString());
                        navigate(`/students/${s._id}/calling`); 
                      }}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors">
                        <FiPhone size={11} /> Calling History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* Cards — mobile, sirf non-central tabs */}
      {!isCentralTab && <div className="md:hidden space-y-3">
        {loading && students.length === 0 ? (
          // Mobile loading skeleton
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded flex-1"></div>
                  <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
                </div>
                <div className="h-3 bg-gray-100 rounded mb-3 w-3/4"></div>
                <div className="flex gap-2 mb-3">
                  <div className="h-3 bg-gray-100 rounded flex-1"></div>
                  <div className="h-3 bg-gray-100 rounded flex-1"></div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <div className="h-8 bg-gray-200 rounded flex-1"></div>
                  <div className="h-8 bg-gray-200 rounded flex-1"></div>
                </div>
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-xl shadow">No students found</div>
        ) : displayStudents.map((s, i) => (
          <div key={s._id} onClick={() => {
            const scrollPosition = window.pageYOffset;
            localStorage.setItem('studentsScrollPosition', scrollPosition.toString());
            navigate(`/students/${s._id}`);
          }} className={`bg-white rounded-xl shadow-sm border cursor-pointer ${
            s.isPriority ? 'border-l-4 border-l-violet-400 border-violet-200 bg-violet-50/30' :
            selected.includes(s._id) ? 'ring-2 ring-primary border-gray-100' : 'border-gray-100'
          } p-4`}>

            {/* Row 1: Checkbox + Name + Status */}
            <div className="flex items-center gap-2 mb-1">
              <input type="checkbox" checked={selected.includes(s._id)} onChange={(e) => { e.stopPropagation(); toggleSelect(s._id); }}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0" />
              <p className="font-semibold text-gray-800 flex-1 min-w-0 truncate flex items-center gap-1 flex-wrap">
                {s.isPriority && <span className="mr-0.5">⚡</span>}
                {s.isTopper && <span className="mr-0.5">🏆</span>}
                <span>{s.serialNumber}. {s.name}</span>
                {s.finalInterview?.result && <span className="text-emerald-500 ml-0.5">★</span>}
              </p>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${STATUS_COLORS[s.status]}`}>{s.status}</span>
            </div>

            {/* Row 2: Father name */}
            {s.fatherName && <p className="text-sm text-gray-400 mb-3 pl-6">{s.fatherName}</p>}

            {/* Row 3: Track + Mobile + Badges — all in one line */}
            <div className="flex items-center gap-2 flex-wrap pl-6 mb-3">
              {s.admissionFormNo && (
                <span className="text-xs font-semibold bg-orange-50 text-primary border border-orange-100 px-2 py-0.5 rounded-full">Form #{s.admissionFormNo}</span>
              )}
              {s.admissionType && (
                <span className="text-[10px] font-bold tracking-wide bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{s.admissionType}</span>
              )}
              {s.displayTrack && (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <span className="text-base">📍</span> {s.displayTrack}{s.trackName ? ` · ${s.trackName}` : ''}
                </span>
              )}
              {s.mobileNo && (
                <div onClick={(e) => e.stopPropagation()} className="inline-block">
                  <button
                    onClick={() => setConfirmCallStudent(s)}
                    disabled={callingId !== null}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all border shrink-0 ${
                      callingId === s._id
                        ? 'bg-orange-100 border-orange-200 text-primary animate-pulse'
                        : 'bg-orange-50 border-orange-100 text-primary hover:bg-primary hover:text-white hover:border-primary active:scale-95'
                    }`}
                  >
                    {callingId === s._id ? (
                      <span className="w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiPhone size={10} />
                    )}
                    <span>{s.mobileNo}</span>
                  </button>
                </div>
              )}
              {s.formSource && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  s.formSource === 'btech' ? 'bg-blue-100 text-blue-700' :
                  s.formSource === 'ssism' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                }`}>{s.formSource === 'btech' ? 'B.Tech' : s.formSource === 'ssism' ? 'SSISM' : 'Manual'}</span>
              )}
              {s.finalInterview?.result === 'Pass' ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">✓ Cleared</span>
              ) : s.finalInterview?.result === 'Fail' ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-600">✗ Final Failed</span>
              ) : s.finalInterview?.result === 'Pending' ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">⏳ Pending</span>
              ) : s.interviewCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-primary border border-orange-200">Round {s.interviewCount}</span>
              ) : null}
            </div>

            {/* Row 4: Buttons */}
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button onClick={(e) => { 
                e.stopPropagation(); 
                const scrollPosition = window.pageYOffset;
                localStorage.setItem('studentsScrollPosition', scrollPosition.toString());
                navigate(`/students/${s._id}/calling`); 
              }}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white font-bold py-2 bg-primary hover:bg-primary-dark rounded-lg transition-colors shadow-sm shadow-primary/10">
                <FiPhone size={14} /> Calling History
              </button>
              {(user?.role === 'admin' || user?.role === 'interviewer') ? (
                <button onClick={(e) => { e.stopPropagation(); setInterviewStudent(s); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white font-semibold py-2 bg-primary hover:bg-primary-dark rounded-lg transition-colors">
                  <FiClipboard size={14} /> Interview
                </button>
              ) : user?.role === 'receptionist' ? (
                <button onClick={(e) => { e.stopPropagation(); setReceptionOpen(s); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white font-semibold py-2 bg-primary hover:bg-primary-dark rounded-lg transition-colors">
                  <FiFileText size={14} /> Entry
                </button>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); handleViewHistory(s); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white font-semibold py-2 bg-primary hover:bg-primary-dark rounded-lg transition-colors">
                  <FiClock size={14} /> History
                </button>
              )}
            </div>
          </div>
        ))}
      </div>}

      {/* Pagination — sirf non-central tabs */}
      {!isCentralTab && pages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4 flex-wrap">
          <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded text-sm border bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40">‹</button>
          
          {(() => {
            const delta = 1;
            const range = [];
            const rangeWithDots = [];
            
            for (let i = Math.max(2, page - delta); i <= Math.min(pages - 1, page + delta); i++) {
              range.push(i);
            }
            
            if (range[0] > 2) {
              rangeWithDots.push(1, '...');
            } else {
              rangeWithDots.push(1);
            }
            
            rangeWithDots.push(...range);
            
            if (range[range.length - 1] < pages - 1) {
              rangeWithDots.push('...', pages);
            } else if (pages > 1) {
              rangeWithDots.push(pages);
            }
            
            return rangeWithDots.map((p, idx) =>
              p === '...' ? (
                <span key={`d${idx}`} className="px-2 py-1.5 text-sm text-gray-400">...</span>
              ) : (
                <button key={p} onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    p === page 
                      ? 'bg-primary text-white border-primary' 
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}>
                  {p}
                </button>
              )
            );
          })()}
          
          <button onClick={() => setPage(p => Math.min(p + 1, pages))} disabled={page === pages}
            className="px-3 py-1.5 rounded text-sm border bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40">›</button>
          
          {hasMore && (
            <button onClick={() => fetchStudents(true)} disabled={loading}
              className="ml-2 px-4 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-dark disabled:opacity-60">
              {loading ? 'Loading...' : 'Load More'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
