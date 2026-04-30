import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { TRACKS, STATUSES, TRACK_TOWNS } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { FiExternalLink, FiCamera, FiImage, FiFileText, FiUser, FiCreditCard, FiX } from 'react-icons/fi';

const SUBJECTS = ['B.Tech(CS)', 'B.Tech(IT)', 'B.Tech(ECE)', 'B.Tech(AI/ML)', 'BCA', 'BBA', 'Bcom', 'Bio', 'Micro'];
const BTECH_BRANCHES = ['CS', 'IT', 'AI/ML', 'ECE'];
const SSISM_BRANCHES = ['BCA(ITEG)', 'BBA', 'BSC(BT)', 'BSC(MICRO)', 'B.Com (CA)', 'ITEG Diploma'];

const FUNNEL_STAGES = ['', 'Call Completed', 'Lead Interested', 'Admission Closed', 'Call Not Received', 'Wrong Number', 'Switch Off'];

const ALLOWED_FUNNEL = {
  'Applied':  [],
  'Calling':  ['Call Completed', 'Lead Interested', 'Call Not Received', 'Wrong Number', 'Switch Off'],
  'Admitted': ['Admission Closed'],
  'Rejected': [],
  'Disabled': [],
};

const ADMISSION_TYPES = ['SNS', 'SVS', 'Shri Ram', 'Full Fees'];

const initialForm = {
  status: 'Applied', remarks: '', funnelStage: '', subject: '', admissionType: '', village: '',
  name: '', fatherName: '', mobileNo: '', whatsappNo: '', trackName: '',
  formSource: '',
  bookNo: '', receiptNo: '',
  // B.Tech fields
  email: '', schoolName: '', district: '', whatsappNumber: '',
  persentage12: '', jeeScore: '', fullAddress: '',
  // SSISM fields
  branch: '', year: '', joinBatch: '', feesScheme: '', category: '', gender: '',
  school12Sub: '', persentage10: '', dob: '', aadharNo: '',
  fatherOccupation: '', fatherIncome: '', fatherContactNumber: '', pincode: '', tehsil: '',
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
  const [studentInfo, setStudentInfo] = useState(null);
  const [trackTowns, setTrackTowns] = useState([]);
  const [docs, setDocs] = useState({});
  const [existingDocs, setExistingDocs] = useState({});
  const [loading, setLoading] = useState(false);
  const [cameraFor, setCameraFor] = useState(null);
  const [originalFormSource, setOriginalFormSource] = useState('manual');
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isManual = !originalFormSource || originalFormSource === 'manual' || isAdmin;

  useEffect(() => {
    if (isEdit) {
      api.get(`/students/${id}`).then(({ data }) => {
        // Read-only info display ke liye
        setOriginalFormSource(data.formSource || 'manual');
        setStudentInfo({
          name: data.name,
          fatherName: data.fatherName,
          track: data.track,
          trackName: data.trackName,
          mobileNo: data.mobileNo,
          formSource: data.formSource,
          finalInterviewPassed: data.finalInterview?.result === 'Pass',
        });
        // Track ke hisaab se towns set karo
        const towns = Object.entries(TRACK_TOWNS).find(([, v]) => v.some(t =>
          t.toLowerCase() === (data.village || '').toLowerCase()
        ))?.[1] ||
          Object.entries(TRACK_TOWNS).find(([k]) =>
            k.toLowerCase().includes((data.track || '').toLowerCase()) ||
            (data.track || '').toLowerCase().includes(k.toLowerCase())
          )?.[1] || [];
        setTrackTowns(towns);
        setForm({
          status: data.status, remarks: '', funnelStage: data.funnelStage || '',
          subject: data.subject || data.branch || data.priority1 || '', admissionType: data.admissionType || '', village: data.village || '',
          name: data.name || '', fatherName: data.fatherName || '',
          mobileNo: data.mobileNo || '', whatsappNo: data.whatsappNo || '',
          trackName: data.trackName || '', formSource: data.formSource || '',
          email: data.email || '', schoolName: data.schoolName || '',
          district: data.district || '', whatsappNumber: data.whatsappNumber || '',
          persentage12: data.persentage12 ?? '', jeeScore: data.jeeScore ?? '',
          branch: data.branch || data.priority1 || '', fullAddress: data.fullAddress || '', year: data.year || '',
          joinBatch: data.joinBatch ?? '', feesScheme: data.feesScheme || '',
          category: data.category || '', gender: data.gender || '',
          school12Sub: data.school12Sub || '', persentage10: data.persentage10 ?? '',
          dob: data.dob || '', aadharNo: data.aadharNo || '',
          fatherOccupation: data.fatherOccupation || '', fatherIncome: data.fatherIncome ?? '',
          fatherContactNumber: data.fatherContactNumber || '',
          pincode: data.pincode ?? '', tehsil: data.tehsil || '',
          // extra SSISM fields
          persentage11: data.persentage11 ?? '',
          rollNumber10: data.rollNumber10 ?? '', rollNumber12: data.rollNumber12 ?? '',
          linkSource: data.linkSource || '', sRank: data.sRank || '',
          regFees: data.regFees ?? '', isTop20: data.isTop20 || false,
          fatherIncome: data.fatherIncome ?? '',
          bookNo: data.bookNo || '', receiptNo: data.receiptNo || '',
        });
        const existing = {};
        DOC_FIELDS.forEach(({ key }) => { if (data[key]) existing[key] = data[key]; });
        setExistingDocs(existing);
      }).catch(() => toast.error('Failed to load student'));
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.status === 'Admitted') {
      const missing = [];
      if (!form.subject?.trim())       missing.push('Admission Subject');
      if (!form.bookNo?.trim())        missing.push('Book No.');
      if (!form.receiptNo?.trim())     missing.push('Receipt No.');
      if (!form.funnelStage?.trim())   missing.push('Funnel Stage');
      if (!form.admissionType?.trim()) missing.push('Admission Type');
      if (missing.length > 0) {
        toast.error(`Ye fields required hain: ${missing.join(', ')}`);
        return;
      }
    }
    if (form.status === 'Calling' && !form.funnelStage?.trim()) {
      toast.error('Calling status ke liye Funnel Stage required hai');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      // Sirf editable fields bhejo
      formData.append('status', form.status);
      formData.append('remarks', form.remarks);
      formData.append('funnelStage', form.funnelStage);
      formData.append('subject', form.subject);
      formData.append('admissionType', form.admissionType);
      formData.append('bookNo', form.bookNo || '');
      formData.append('receiptNo', form.receiptNo || '');
      if (form.village !== undefined) formData.append('village', form.village);
      formData.append('name', form.name);
      formData.append('fatherName', form.fatherName);
      formData.append('mobileNo', form.mobileNo);
      formData.append('whatsappNo', form.whatsappNo);
      formData.append('trackName', form.trackName);
      formData.append('formSource', form.formSource);
      // B.Tech fields
      ['email','schoolName','district','whatsappNumber','persentage12','jeeScore',
       'fullAddress'].forEach((k) => formData.append(k, form[k]));
      // SSISM fields
      ['branch','year','joinBatch','feesScheme','category','gender','school12Sub',
       'persentage10','dob','aadharNo','fatherOccupation','fatherIncome',
       'fatherContactNumber','pincode','tehsil'].forEach((k) => formData.append(k, form[k]));
      DOC_FIELDS.forEach(({ key }) => { if (docs[key]) formData.append(key, docs[key]); });
      await api.put(`/students/${id}`, formData);
      toast.success('Student updated successfully');
      navigate('/students');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

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
        <h2 className="text-2xl font-bold text-gray-800">Edit Student</h2>
      </div>

      {/* Read-only student info */}
      {studentInfo && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Name</p>
            <p className="text-sm font-semibold text-gray-800">{studentInfo.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Father Name</p>
            <p className="text-sm font-semibold text-gray-800">{studentInfo.fatherName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Track</p>
            <p className="text-sm font-semibold text-gray-800">{studentInfo.track}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Town</p>
            <p className="text-sm font-semibold text-gray-800">{studentInfo.trackName || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Mobile</p>
            <p className="text-sm font-semibold text-gray-800">{studentInfo.mobileNo}</p>
          </div>
        </div>
      )}

      {/* Town selector — track ke hisaab se */}
      {trackTowns.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 mb-5">
          <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Town / Village</label>
          <select value={form.village || ''} onChange={(e) => setForm({ ...form, village: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select Town</option>
            {trackTowns.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-6">

        {/* Basic Information — Edit mode */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Basic Information</p>
          {!isManual && !isAdmin && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              ⚠️ Ye student {form.formSource === 'btech' ? 'B.Tech (SSEC)' : 'SSISM'} form se registered hai — basic fields edit nahi ho sakte
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
              <input value={form.name} onChange={(e) => isManual && setForm({ ...form, name: e.target.value })}
                disabled={!isManual}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Father Name</label>
              <input value={form.fatherName} onChange={(e) => isManual && setForm({ ...form, fatherName: e.target.value })}
                disabled={!isManual}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile No</label>
              <input type="tel" value={form.mobileNo} onChange={(e) => isManual && setForm({ ...form, mobileNo: e.target.value })}
                disabled={!isManual}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp No</label>
              <input type="tel" value={form.whatsappNo} onChange={(e) => isManual && setForm({ ...form, whatsappNo: e.target.value })}
                disabled={!isManual}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Track Name</label>
              <input value={form.trackName} onChange={(e) => isManual && setForm({ ...form, trackName: e.target.value })}
                disabled={!isManual}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`} />
            </div>
          </div>
        </div>

        {/* Status Section */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Status</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              {/* {!studentInfo?.finalInterviewPassed && form.status !== 'Admitted' && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-2">
                   Admitted option tab available hoga jab final interview pass ho jaye
                </p>
              )} */}
              <select value={form.status} onChange={(e) => {
                  const newStatus = e.target.value;
                  const allowed = ALLOWED_FUNNEL[newStatus] || [];
                  setForm({ ...form, status: newStatus, funnelStage: allowed.includes(form.funnelStage) ? form.funnelStage : '' });
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {STATUSES.filter((s) =>
                  s !== 'Admitted' || studentInfo?.finalInterviewPassed || form.status === 'Admitted'
                ).map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            {form.status === 'Admitted' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admission Subject <span className="text-rose-500">*</span></label>
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    !form.subject?.trim() ? 'border-rose-300 bg-rose-50/30' : 'border-gray-300'
                  }`}>
                  <option value="">Select Subject</option>
                  {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
            {form.status === 'Admitted' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Book No. <span className="text-rose-500">*</span>
                </label>
                <input value={form.bookNo} onChange={(e) => setForm({ ...form, bookNo: e.target.value })}
                  placeholder="Enter Book No."
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    !form.bookNo?.trim() ? 'border-rose-300 bg-rose-50/30' : 'border-gray-300'
                  }`} />
              </div>
            )}
            {form.status === 'Admitted' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receipt No. <span className="text-rose-500">*</span>
                </label>
                <input value={form.receiptNo} onChange={(e) => setForm({ ...form, receiptNo: e.target.value })}
                  placeholder="Enter Receipt No."
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    !form.receiptNo?.trim() ? 'border-rose-300 bg-rose-50/30' : 'border-gray-300'
                  }`} />
              </div>
            )}
            <div className={form.status === 'Admitted' ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Funnel Stage {(form.status === 'Admitted' || form.status === 'Calling') && <span className="text-rose-500">*</span>}</label>
              <select value={form.funnelStage} onChange={(e) => setForm({ ...form, funnelStage: e.target.value })}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  (form.status === 'Admitted' || form.status === 'Calling') && !form.funnelStage?.trim() ? 'border-rose-300 bg-rose-50/30' : 'border-gray-300'
                }`}>
                <option value="">Select Stage</option>
                {(ALLOWED_FUNNEL[form.status] || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {(ALLOWED_FUNNEL[form.status] || []).length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No funnel stages for this status</p>
              )}
            </div>
            {(isAdmin || isManager || user?.role === 'track_incharge') && form.status === 'Admitted' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admission Type {form.status === 'Admitted' && <span className="text-rose-500">*</span>}</label>
                <select value={form.admissionType} onChange={(e) => setForm({ ...form, admissionType: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    form.status === 'Admitted' && !form.admissionType?.trim() ? 'border-rose-300 bg-rose-50/30' : 'border-gray-300'
                  }`}>
                  <option value="">Select Type</option>
                  {ADMISSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Registration Details */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Registration Details</p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Form Type</label>
            <div className="flex gap-3">
              {['', 'btech', 'ssism'].map((val) => (
                <button key={val} type="button"
                  onClick={() => isManual && setForm({ ...form, formSource: val })}
                  disabled={!isManual}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.formSource === val
                      ? 'bg-primary text-white border-primary'
                      : !isManual
                        ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary'
                  }`}>
                  {val === '' ? 'None' : val === 'btech' ? 'B.Tech (SSEC)' : 'SSISM'}
                </button>
              ))}
            </div>
          </div>

          {/* B.Tech (SSEC) fields */}
          {form.formSource === 'btech' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[['Email', 'email', 'email'], ['WhatsApp Number', 'whatsappNumber', 'tel'],
                  ['School Name', 'schoolName', 'text'], ['District', 'district', 'text'],
                  ['Village / City', 'village', 'text'], ['12th Score', 'persentage12', 'number'],
                  ['JEE Score', 'jeeScore', 'number']].map(([label, key, type]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input type={type} value={form[key]} onChange={(e) => isManual && setForm({ ...form, [key]: e.target.value })}
                      disabled={!isManual}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`} />
                  </div>
                ))}
              </div>
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Branch Preference</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <select value={form.branch} onChange={(e) => isManual && setForm({ ...form, branch: e.target.value })}
                    disabled={!isManual}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}>
                    <option value="">Select</option>
                    {BTECH_BRANCHES.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Local Address</label>
                <input value={form.fullAddress} onChange={(e) => isManual && setForm({ ...form, fullAddress: e.target.value })}
                  disabled={!isManual}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`} />
              </div>
            </div>
          )}

          {/* SSISM fields */}
          {form.formSource === 'ssism' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[['Email', 'email', 'email'], ['School Name', 'schoolName', 'text'],
                  ['District', 'district', 'text'], ['Village / City', 'village', 'text'],
                  ['10th Score', 'persentage10', 'number'], ['11th Score', 'persentage11', 'text'],
                  ['12th Score', 'persentage12', 'number'], ['10th Roll No', 'rollNumber10', 'number'],
                  ['12th Roll No', 'rollNumber12', 'number'],
                  ['Date of Birth', 'dob', 'date'], ['Aadhar No', 'aadharNo', 'text'],
                  ['Father Occupation', 'fatherOccupation', 'text'], ['Father Income', 'fatherIncome', 'number'],
                  ['Father Contact', 'fatherContactNumber', 'tel'], ['Pincode', 'pincode', 'number'],
                  ['Tehsil', 'tehsil', 'text'], ['Link Source', 'linkSource', 'text'],
                  ['S Rank', 'sRank', 'text'], ['Reg. Fees', 'regFees', 'number'],
                ].map(([label, key, type]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input type={type} value={form[key] ?? ''} onChange={(e) => isManual && setForm({ ...form, [key]: e.target.value })}
                      disabled={!isManual}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`} />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <select value={form.branch} onChange={(e) => isManual && setForm({ ...form, branch: e.target.value })}
                    disabled={!isManual}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}>
                    <option value="">Select Branch</option>
                    {SSISM_BRANCHES.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select value={form.gender} onChange={(e) => isManual && setForm({ ...form, gender: e.target.value })}
                    disabled={!isManual}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}>
                    <option value="">Select</option>
                    {['Male', 'Female', 'Other'].map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => isManual && setForm({ ...form, category: e.target.value })}
                    disabled={!isManual}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}>
                    <option value="">Select</option>
                    {['General', 'OBC', 'SC', 'ST', 'EWS'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fees Scheme</label>
                  <input value={form.feesScheme} onChange={(e) => isManual && setForm({ ...form, feesScheme: e.target.value })}
                    disabled={!isManual}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">12th Subjects</label>
                  <input value={form.school12Sub} onChange={(e) => isManual && setForm({ ...form, school12Sub: e.target.value })}
                    disabled={!isManual}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isManual ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`} />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="isTop20" checked={!!form.isTop20} disabled={!isManual}
                    onChange={(e) => isManual && setForm({ ...form, isTop20: e.target.checked })}
                    className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed" />
                  <label htmlFor="isTop20" className="text-sm font-medium text-gray-700">Is Top 20</label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Documents */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Documents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {DOC_FIELDS.map((d) => <DocCard key={d.key} {...d} docKey={d.key} />)}
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button type="submit" disabled={loading}
            className="bg-primary text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60">
            {loading ? 'Saving...' : 'Update Student'}
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
