import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { TRACKS, STATUSES } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { FiExternalLink, FiCamera, FiImage, FiFileText, FiUser, FiCreditCard, FiX } from 'react-icons/fi';

const SUBJECTS = ['B.Tech', 'BCA', 'BBA', 'Bcom', 'Bio', 'Micro'];
const BTECH_BRANCHES = ['CS', 'IT', 'AI/ML', 'ECE'];
const SSISM_BRANCHES = ['BCA(ITEG)', 'BBA', 'BSC(BT)', 'BSC(MICRO)', 'B.Com (CA)', 'ITEG Diploma'];

const SUBJECTS_BY_BOARD = {
  'MP Board': [
    'Physics, Chemistry, Mathematics (PCM)',
    'Physics, Chemistry, Biology (PCB)',
    'Physics, Chemistry, Mathematics, Biology (PCMB)',
    'Commerce (Accountancy, Business Studies, Economics)',
    'Arts (History, Geography, Political Science)',
    'Agriculture',
    'Home Science',
    'Computer Science',
  ],
  'CBSE': [
    'Physics, Chemistry, Mathematics (PCM)',
    'Physics, Chemistry, Biology (PCB)',
    'Physics, Chemistry, Mathematics, Biology (PCMB)',
    'Commerce (Accountancy, Business Studies, Economics)',
    'Humanities (History, Geography, Political Science, Sociology)',
    'Computer Science',
    'Information Technology',
    'Physical Education',
  ],
  'International (IB/Cambridge)': [
    'Science Stream (Physics, Chemistry, Math)',
    'Science Stream (Physics, Chemistry, Biology)',
    'Commerce Stream',
    'Humanities Stream',
    'Computer Science',
    'Environmental Systems',
    'Business Management',
  ],
  'Other': ['Other / Enter Manually'],
};
const FUNNEL_STAGES = ['', 'Call Completed', 'Lead Interested', 'Admission Closed'];

// Funnel stages allowed per status
const ALLOWED_FUNNEL = {
  'Applied':  [],
  'Calling':  ['Call Completed', 'Lead Interested'],
  'Admitted': ['Admission Closed'],
  'Rejected': [],
  'Disabled': [],
};

const initialForm = {
  name: '', fatherName: '', track: '', mobileNo: '',
  whatsappNo: '', subject: '', fullAddress: '', otherTrack: '',
  status: 'Applied', remarks: '', funnelStage: '',
  formSource: '',
  // Registration fields
  email: '', schoolName: '', district: '', village: '',
  whatsappNumber: '', priority1: '', priority2: '', priority3: '',
  jeeScore: '', persentage12: '', persentage10: '', persentage11: '',
  branch: '', year: '', joinBatch: '', feesScheme: '',
  category: '', gender: '', school12Sub: '',
  dob: '', aadharNo: '', fatherOccupation: '', fatherIncome: '',
  fatherContactNumber: '', pincode: '', tehsil: '', trackName: '',
  isTop20: false,
};

const DOC_FIELDS = [
  { key: 'photo',             label: 'Photo',              icon: FiUser,       accept: 'image/*' },
  { key: 'marksheet10th',     label: '10th Marksheet',     icon: FiFileText,   accept: 'image/*,.pdf' },
  { key: 'marksheet12th',     label: '12th Marksheet',     icon: FiFileText,   accept: 'image/*,.pdf' },
  { key: 'incomeCertificate', label: 'Income Certificate', icon: FiFileText,   accept: 'image/*,.pdf' },
  { key: 'jaatiPraman',       label: 'Jaati Praman Patra', icon: FiFileText,   accept: 'image/*,.pdf' },
  { key: 'abcId',             label: 'ABC ID',             icon: FiCreditCard, accept: 'image/*,.pdf' },
  { key: 'aadharCard',        label: 'Aadhar Card',        icon: FiCreditCard, accept: 'image/*,.pdf' },
];

function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported in this browser. Use HTTPS or the mobile app.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch((err) => {
        if (err.name === 'NotAllowedError') setError('Camera permission denied. Please allow camera access in browser settings.');
        else if (err.name === 'NotFoundError') setError('No camera found on this device.');
        else setError('Camera unavailable. Try Gallery instead.');
      });
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onClose();
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-gray-800">Take Photo</span>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
        </div>
        {error ? (
          <div className="p-6 text-center">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-600">Close</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full bg-black" />
            <div className="p-4 flex justify-center">
              <button type="button" onClick={capture} disabled={!ready}
                className="bg-primary text-white px-8 py-2.5 rounded-xl font-semibold hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50">
                <FiCamera size={16} /> {ready ? 'Capture' : 'Loading...'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


export default function StudentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(initialForm);
  const [docs, setDocs] = useState({});
  const [existingDocs, setExistingDocs] = useState({});
  const [loading, setLoading] = useState(false);
  const [cameraFor, setCameraFor] = useState(null);

  useEffect(() => {
    if (isEdit) {
      api.get(`/students/${id}`).then(({ data }) => {
        setForm({
          name: data.name, fatherName: data.fatherName, track: data.track,
          mobileNo: data.mobileNo || '', whatsappNo: data.whatsappNo || data.whatsappNumber || '',
          subject: data.subject || '', fullAddress: data.fullAddress || '',
          otherTrack: data.otherTrack || '', status: data.status, remarks: '', funnelStage: data.funnelStage || '',
          formSource: data.formSource || '',
          // Registration fields
          email: data.email || '', schoolName: data.schoolName || '',
          district: data.district || '', village: data.village || '',
          whatsappNumber: data.whatsappNumber || '',
          priority1: data.priority1 || '', priority2: data.priority2 || '', priority3: data.priority3 || '',
          jeeScore: data.jeeScore ?? '', persentage12: data.persentage12 ?? '', persentage10: data.persentage10 ?? '',
          branch: data.branch || '', year: data.year || '', joinBatch: data.joinBatch ?? '',
          feesScheme: data.feesScheme || '', category: data.category || '', gender: data.gender || '',
          school12Sub: data.school12Sub || '', dob: data.dob || '', aadharNo: data.aadharNo || '',
          fatherOccupation: data.fatherOccupation || '', fatherIncome: data.fatherIncome ?? '',
          fatherContactNumber: data.fatherContactNumber || '', pincode: data.pincode ?? '',
          tehsil: data.tehsil || '', trackName: data.trackName || '',
          isTop20: !!data.isTop20, persentage11: data.persentage11 || '',
        });
        const existing = {};
        DOC_FIELDS.forEach(({ key }) => { if (data[key]) existing[key] = data[key]; });
        setExistingDocs(existing);
      }).catch(() => toast.error('Failed to load student'));
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      DOC_FIELDS.forEach(({ key }) => { if (docs[key]) formData.append(key, docs[key]); });
      if (isEdit) await api.put(`/students/${id}`, formData);
      else await api.post('/students', formData);
      toast.success(`Student ${isEdit ? 'updated' : 'added'} successfully`);
      navigate('/students');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  const field = (label, key, type = 'text', required = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && !isEdit && <span className="text-red-500">*</span>}</label>
      <input type={type} value={form[key]} required={required && !isEdit}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
    </div>
  );

  const DocCard = ({ docKey, label, icon: Icon, accept }) => {
    const existing = existingDocs[docKey];
    const selected = docs[docKey];
    return (
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={15} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </div>
          {existing && (
            <a href={existing} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs bg-primary text-white px-2.5 py-1 rounded-lg hover:bg-primary-dark transition-colors">
              <FiExternalLink size={11} /> View
            </a>
          )}
        </div>

        {selected && (
          <p className="text-xs text-green-600 font-medium truncate">✓ {selected.name}</p>
        )}

        <div className="flex gap-2">
          {/* Camera button — getUserMedia on HTTPS, native capture on HTTP */}
          <button type="button"
            onClick={() => setCameraFor(docKey)}
            className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg py-2 text-xs text-gray-500 hover:border-primary hover:text-primary transition-colors">
            <FiCamera size={13} /> Camera
          </button>
          <label className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer border border-gray-200 rounded-lg py-2 text-xs text-gray-500 hover:border-primary hover:text-primary transition-colors">
            <FiImage size={13} /> Gallery
            <input type="file" accept={accept} className="hidden"
              onChange={(e) => e.target.files[0] && setDocs({ ...docs, [docKey]: e.target.files[0] })} />
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="px-2">
      {cameraFor && (
        <CameraModal
          onCapture={(file) => { setDocs((d) => ({ ...d, [cameraFor]: file })); setCameraFor(null); }}
          onClose={() => setCameraFor(null)}
        />
      )}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/students')} className="text-gray-500 hover:text-gray-700">← Back</button>
        <h2 className="text-2xl font-bold text-gray-800">{isEdit ? 'Edit Student' : 'Add Student'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Basic Information</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('Student Name', 'name', 'text', true)}
            {field('Father Name', 'fatherName', 'text', true)}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Track<span className="text-red-500">*</span></label>
              <select value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })}
                disabled={user?.role === 'track_incharge'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select Track</option>
                {TRACKS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            {field('Mobile No', 'mobileNo', 'tel')}
            {field('WhatsApp No', 'whatsappNo', 'tel')}
            {field('Other Track', 'otherTrack')}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
              <textarea value={form.fullAddress} rows={2}
                onChange={(e) => setForm({ ...form, fullAddress: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
        </div>

        {isEdit && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Status</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => {
                    const newStatus = e.target.value;
                    const allowed = ALLOWED_FUNNEL[newStatus] || [];
                    setForm({ ...form, status: newStatus, funnelStage: allowed.includes(form.funnelStage) ? form.funnelStage : '' });
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              {form.status === 'Admitted' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admission Subject</label>
                  <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select Subject</option>
                    {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div className={form.status === 'Admitted' ? 'md:col-span-2' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Funnel Stage</label>
                <select value={form.funnelStage} onChange={(e) => setForm({ ...form, funnelStage: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Select Stage</option>
                  {(ALLOWED_FUNNEL[form.status] || []).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {(ALLOWED_FUNNEL[form.status] || []).length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No funnel stages for this status</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Registration Details</p>

          {/* Form Type Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Form Type</label>
            <div className="flex gap-3">
              {['', 'btech', 'ssism'].map((val) => (
                <button key={val} type="button"
                  onClick={() => setForm({ ...form, formSource: val })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.formSource === val
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-primary'
                  }`}>
                  {val === '' ? 'None' : val === 'btech' ? 'B.Tech' : 'SSISM'}
                </button>
              ))}
            </div>
          </div>

          {/* B.Tech fields */}
          {form.formSource === 'btech' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Email', 'email', 'email')}
                {field('WhatsApp Number', 'whatsappNumber', 'tel')}
                {field('School Name', 'schoolName')}
                {field('12th Score (Optional)', 'persentage12', 'number')}
                {field('JEE Score (Optional)', 'jeeScore', 'number')}
                {field('District', 'district')}
                {field('Village / City', 'village')}
              </div>
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Branch Preferences</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {['priority1', 'priority2', 'priority3'].map((p, i) => (
                    <div key={p}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority {i + 1}</label>
                      <select value={form[p]} onChange={(e) => setForm({ ...form, [p]: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="">Select</option>
                        {BTECH_BRANCHES.map((b) => <option key={b}>{b}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              {field('Local Address', 'fullAddress')}
            </div>
          )}

          {/* SSISM only fields */}
          {form.formSource === 'ssism' && (
            <div className="mt-4 space-y-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Personal Details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Father Name', 'fatherName')}
                {field('Father Contact', 'fatherContactNumber', 'tel')}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select Category</option>
                    {['General', 'OBC', 'SC', 'ST', 'EWS'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <div className="flex gap-4 mt-2">
                    {['Male', 'Female'].map((g) => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                        <input type="radio" name="gender" value={g}
                          checked={form.gender === g}
                          onChange={() => setForm({ ...form, gender: g })}
                          className="text-primary focus:ring-primary" />
                        {g}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="isTop20" checked={!!form.isTop20}
                    onChange={(e) => setForm({ ...form, isTop20: e.target.checked })}
                    className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                  <label htmlFor="isTop20" className="text-sm text-gray-700 cursor-pointer">
                    Is Top 20 <span className="text-gray-400">(Tick if you got top 20 rank in your class)</span>
                  </label>
                </div>
              </div>

              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide pt-2">Academic Details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('12th School Name', 'schoolName')}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">12th Subject</label>
                  {(() => {
                    const allSubjects = Object.values(SUBJECTS_BY_BOARD).flat();
                    const isManual = form.school12Sub && !allSubjects.includes(form.school12Sub);
                    const dropdownVal = isManual ? 'Other / Enter Manually' : form.school12Sub;
                    return (
                      <>
                        <select value={dropdownVal}
                          onChange={(e) => setForm({ ...form, school12Sub: e.target.value === 'Other / Enter Manually' ? '' : e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                          <option value="">Select Subject</option>
                          {Object.entries(SUBJECTS_BY_BOARD).map(([board, subjects]) => (
                            <optgroup key={board} label={board}>
                              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        {(dropdownVal === 'Other / Enter Manually' || isManual) && (
                          <input type="text" placeholder="Enter subject manually..."
                            value={isManual ? form.school12Sub : ''}
                            onChange={(e) => setForm({ ...form, school12Sub: e.target.value })}
                            className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        )}
                      </>
                    );
                  })()}
                </div>
                {field('10th Percentage', 'persentage10', 'number')}
                {field('11th Percentage', 'persentage11')}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
                  <select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select Branch</option>
                    {SSISM_BRANCHES.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Documents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {DOC_FIELDS.map((d) => <DocCard key={d.key} {...d} docKey={d.key} />)}
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button type="submit" disabled={loading}
            className="bg-primary text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60">
            {loading ? 'Saving...' : isEdit ? 'Update Student' : 'Add Student'}
          </button>
          <button type="button" onClick={() => navigate('/students')}
            className="border border-gray-300 text-gray-600 px-6 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
