import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { TRACKS, STATUSES, STATUS_COLORS } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { FiPlus, FiUpload, FiSearch, FiEdit2, FiDownload, FiFilter, FiSlash, FiClipboard, FiExternalLink } from 'react-icons/fi';
import DatePicker from '../../components/DatePicker';
import { isOnline, cacheStudents, getCachedStudents } from '../../utils/offlineQueue';

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
  assignmentMarks: '', result: 'Pending', remarks: '',
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

function InterviewModal({ student, user, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [prevRound, setPrevRound] = useState(null);
  const [nextRound, setNextRound] = useState(1);

  useEffect(() => {
    api.get(`/interviews/${student._id}`).then(({ data }) => {
      setNextRound(data.length + 1);
      if (data.length > 0) setPrevRound(data[data.length - 1]);
    }).catch(() => {});
  }, [student._id]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
          <div>
            <h3 className="font-bold text-primary text-lg">Technical Interview Form</h3>
            <p className="text-sm text-gray-500">Student — {student.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 space-y-5">

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
            </div>
          </div>

          {/* Technical Knowledge */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Technical Knowledge & Aptitude</p>
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Mathematics Marks"    value={form.mathematicsMarks}    onChange={set('mathematicsMarks')}    options={RATING} />
              <SelectField label="Subjective Knowledge" value={form.subjectiveKnowledge} onChange={set('subjectiveKnowledge')} options={RATING} />
            </div>
            <div className="mt-3 w-1/2 pr-1.5">
              <SelectField label="Reasoning Marks" value={form.reasoningMarks} onChange={set('reasoningMarks')} options={RATING} />
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
      </div>
    </div>
  );
}

const ACTIVE_STATUSES = STATUSES.filter((s) => s !== 'Disabled');

export default function Students() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'active');
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filters, setFilters] = useState({
    track: searchParams.get('track') || '',
    status: searchParams.get('status') || '',
    search: '',
    formSource: '',
    interviewFilter: '',
  });
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(!!(searchParams.get('track') || searchParams.get('status')));
  const [selected, setSelected] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [interviewStudent, setInterviewStudent] = useState(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      if (!isOnline()) {
        const cached = getCachedStudents();
        if (cached) {
          setStudents(cached.data.students);
          setTotal(cached.data.total);
          setPages(cached.data.pages);
          toast('Offline — cached data dikh raha hai', { icon: '📶' });
        }
        return;
      }
      const params = { page, limit: 10, ...filters, ...(tab === 'disabled' ? { status: 'Disabled' } : {}), ...(filters.interviewFilter ? { interviewFilter: filters.interviewFilter } : {}) };
      const { data } = await api.get('/students', { params });
      setStudents(data.students);
      setTotal(data.total);
      setPages(data.pages);
      setSelected([]);
      if (page === 1 && tab === 'active') cacheStudents(data); // sirf first page cache karo
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStudents(); }, [page, filters, tab]);

  const switchTab = (t) => { setTab(t); setPage(1); setFilters({ track: '', status: '', search: '', formSource: '', interviewFilter: '' }); setSelected([]); };

  const toggleSelect = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === students.length ? [] : students.map((s) => s._id));

  const handleExport = async (ids = []) => {
    setExporting(true);
    try {
      const params = ids.length === 0 ? { ...filters, ...(tab === 'disabled' ? { status: 'Disabled' } : {}) } : {};
      const res = await api.post('/students/export', { ids }, { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;

      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2,'0')}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getFullYear()}`;

      let filename;
      if (ids.length === 1) {
        // Single student — student ka naam
        const student = students.find(s => s._id === ids[0]);
        const namePart = student ? student.name.replace(/[^a-zA-Z0-9]/g, '_') : 'student';
        filename = `${namePart}_${dateStr}.xlsx`;
      } else if (ids.length > 1) {
        // Selected multiple — selected + date
        filename = `students_selected_${dateStr}.xlsx`;
      } else {
        // Export all — track filter laga ho to track name, warna "all"
        const trackPart = filters.track ? filters.track.replace(/[^a-zA-Z0-9]/g, '_') : 'all';
        filename = `students_${trackPart}_${dateStr}.xlsx`;
      }

      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${ids.length > 0 ? ids.length : 'All'} students exported`);
    } catch { toast.error('Export failed'); }
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
  const allSelected = students.length > 0 && selected.length === students.length;

  return (
    <div>
      {interviewStudent && (
        <InterviewModal
          student={interviewStudent}
          user={user}
          onClose={() => setInterviewStudent(null)}
          onSaved={fetchStudents}
        />
      )}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">
          Students <span className="text-gray-400 text-base">({total})</span>
        </h2>
        <div className="grid grid-cols-4 gap-1.5 w-full md:w-auto md:flex md:gap-2">
          {selected.length > 0 ? (
            <button onClick={() => handleExport(selected)} disabled={exporting}
              className="flex items-center justify-center gap-0.5 md:gap-1.5 bg-primary text-white py-1.5 md:px-3 md:py-2 rounded md:rounded-lg text-xs md:text-sm disabled:opacity-60">
              <FiDownload size={11} className="md:hidden" /><FiDownload size={14} className="hidden md:block" /> <span>Export ({selected.length})</span>
            </button>
          ) : (
            <button onClick={() => handleExport([])} disabled={exporting}
              className="flex items-center justify-center gap-0.5 md:gap-1.5 bg-primary text-white py-1.5 md:px-3 md:py-2 rounded md:rounded-lg text-xs md:text-sm disabled:opacity-60">
              <FiDownload size={11} className="md:hidden" /><FiDownload size={14} className="hidden md:block" /> <span>{exporting ? 'Exporting...' : 'Export All'}</span>
            </button>
          )}
          {!isDisabledTab && (
            <>
              {/* Add Student button — ab external form se aata hai */}
              {/* <button onClick={() => navigate('/students/add')}
                className="flex items-center justify-center gap-0.5 md:gap-1.5 bg-primary text-white py-1.5 md:px-3 md:py-2 rounded md:rounded-lg text-xs md:text-sm">
                <FiPlus size={11} className="md:hidden" /><FiPlus size={14} className="hidden md:block" /> <span className="md:hidden">Add</span><span className="hidden md:inline">Add Student</span>
              </button> */}

              {/* Bulk Upload — ab external form se aata hai */}
              {/* <label className="flex items-center justify-center gap-0.5 md:gap-1.5 bg-primary text-white py-1.5 md:px-3 md:py-2 rounded md:rounded-lg cursor-pointer text-xs md:text-sm">
                <FiUpload size={11} className="md:hidden" /><FiUpload size={14} className="hidden md:block" /> <span>Bulk Upload</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkUpload} />
              </label> */}

              {/* Sample template download — bulk upload ke saath comment */}
              {/* <button onClick={handleDownloadTemplate}
                className="flex items-center justify-center gap-0.5 md:gap-1.5 bg-gray-100 text-gray-700 py-1.5 md:px-3 md:py-2 rounded md:rounded-lg text-xs md:text-sm border border-gray-300">
                <FiDownload size={11} className="md:hidden" /><FiDownload size={14} className="hidden md:block" /> <span>Sample</span>
              </button> */}

              <a href="https://central.ssism.org/self_registration" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-0.5 md:gap-1.5 bg-primary text-white py-1.5 md:px-3 md:py-2 rounded md:rounded-lg text-xs md:text-sm">
                <FiExternalLink size={11} className="md:hidden" /><FiExternalLink size={14} className="hidden md:block" />
                <span className="md:hidden">SSISM</span><span className="hidden md:inline">SSISM Form</span>
              </a>
              <a href="https://ssec.ssism.org/apply" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-0.5 md:gap-1.5 bg-primary text-white py-1.5 md:px-3 md:py-2 rounded md:rounded-lg text-xs md:text-sm">
                <FiExternalLink size={11} className="md:hidden" /><FiExternalLink size={14} className="hidden md:block" />
                <span className="md:hidden">SSEC</span><span className="hidden md:inline">SSEC Form</span>
              </a>
            </>
          )}
        </div>
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
            <select value={filters.formSource} onChange={(e) => { setFilters({ ...filters, formSource: e.target.value }); setPage(1); }}
              className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="">All Forms</option>
              <option value="btech">B.Tech (ITEG)</option>
              <option value="ssism">SSISM</option>
              <option value="manual">Manual</option>
            </select>
            <select value={filters.interviewFilter} onChange={(e) => { setFilters({ ...filters, interviewFilter: e.target.value }); setPage(1); }}
              className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="">All Interviews</option>
              <option value="hasAttempts">Has Attempts</option>
              <option value="finalCleared">Final Cleared</option>
            </select>
          </div>
        )}
      </div>

      {/* Selection bar */}
      {selected.length > 0 && (
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

      {/* Table — desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                  </th>
                  {['S.N.', 'Name', 'Father Name', 'Track', 'Mobile', 'Form', 'Status', 'Attempt', 'Interview', 'Actions'].map((h) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase text-gray-500 ${h === 'Attempt' ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-10 text-gray-400">No students found</td></tr>
                ) : students.map((s, i) => (
                  <tr key={s._id} onClick={() => navigate(`/students/${s._id}`)} className={`hover:bg-gray-50 transition-colors cursor-pointer ${selected.includes(s._id) ? 'bg-orange-50/50' : ''}`}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(s._id)} onChange={() => toggleSelect(s._id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{(page - 1) * 10 + i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <span className="flex items-center gap-1.5">
                        {s.finalInterview?.result && <span className="text-emerald-500 text-base leading-none" title="Final Interview Done">★</span>}
                        {s.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.fatherName}</td>
                    <td className="px-4 py-3 text-gray-600">{s.track}</td>
                    <td className="px-4 py-3 text-gray-600">{s.mobileNo}</td>
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
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">✓ Final Cleared</span>
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
                      <button onClick={(e) => { e.stopPropagation(); setInterviewStudent(s); }}
                        className="flex items-center gap-1 text-xs text-white font-medium px-2.5 py-1.5 bg-primary hover:bg-primary-dark rounded-lg transition-colors">
                        <FiClipboard size={12} /> Interview
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/students/${s._id}/edit`); }} className="text-yellow-500 hover:text-yellow-700"><FiEdit2 /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleExport([s._id]); }} className="text-primary hover:text-primary-dark" title="Export"><FiDownload size={14} /></button>
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
          <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : students.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-xl shadow">No students found</div>
        ) : students.map((s, i) => (
          <div key={s._id} onClick={() => navigate(`/students/${s._id}`)} className={`bg-white rounded-xl shadow p-4 cursor-pointer ${selected.includes(s._id) ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={selected.includes(s._id)} onChange={(e) => { e.stopPropagation(); toggleSelect(s._id); }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                <div>
                  <p className="font-semibold text-gray-800">{(page - 1) * 10 + i + 1}. {s.name} {s.finalInterview?.result && <span className="text-emerald-500">★</span>}</p>
                  <p className="text-sm text-gray-500">{s.fatherName}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[s.status]}`}>{s.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 mb-3">
              {s.track && <span>📍 {s.track}</span>}
              {s.mobileNo && <span>📞 {s.mobileNo}</span>}
              {s.formSource && (
                <span className={`w-fit px-2 py-0.5 rounded-full font-medium ${
                  s.formSource === 'btech' ? 'bg-blue-100 text-blue-700' :
                  s.formSource === 'ssism' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {s.formSource === 'btech' ? 'B.Tech' : s.formSource === 'ssism' ? 'SSISM' : 'Manual'}
                </span>
              )}
              {s.finalInterview?.result === 'Pass' ? (
                <span className="w-fit px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">✓ Final Cleared</span>
              ) : s.finalInterview?.result === 'Fail' ? (
                <span className="w-fit px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-600">✗ Final Failed</span>
              ) : s.finalInterview?.result === 'Pending' ? (
                <span className="w-fit px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">⏳ Final Pending</span>
              ) : s.interviewCount > 0 ? (
                <span className="w-fit px-2 py-0.5 rounded-full font-bold bg-orange-50 text-primary border border-orange-200">Round {s.interviewCount}</span>
              ) : null}
            </div>
            <div className="flex gap-2 border-t border-gray-100 pt-2">
              <button onClick={(e) => { e.stopPropagation(); navigate(`/students/${s._id}/edit`); }}
                className="flex-1 flex items-center justify-center gap-1 text-xs text-white font-medium py-1.5 bg-primary rounded-lg">
                <FiEdit2 size={13} /> Edit
              </button>
              <button onClick={(e) => { e.stopPropagation(); setInterviewStudent(s); }}
                className="flex-1 flex items-center justify-center gap-1 text-xs text-white font-medium py-1.5 bg-primary hover:bg-primary-dark rounded-lg transition-colors">
                <FiClipboard size={13} /> Interview
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleExport([s._id]); }}
                className="flex items-center justify-center gap-1 text-xs text-white font-medium py-1.5 px-3 bg-primary rounded-lg">
                <FiDownload size={13} />
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
            const delta = 1, range = [], rangeWithDots = [];
            for (let i = Math.max(2, page - delta); i <= Math.min(pages - 1, page + delta); i++) range.push(i);
            if (range[0] > 2) rangeWithDots.push(1, '...'); else rangeWithDots.push(1);
            rangeWithDots.push(...range);
            if (range[range.length - 1] < pages - 1) rangeWithDots.push('...', pages);
            else if (pages > 1) rangeWithDots.push(pages);
            return rangeWithDots.map((p, idx) =>
              p === '...' ? <span key={`d${idx}`} className="px-2 py-1.5 text-sm text-gray-400">...</span> : (
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
