import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { TRACKS, STATUSES } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { FiExternalLink, FiCamera, FiImage, FiFileText, FiUser, FiCreditCard, FiX } from 'react-icons/fi';

const SUBJECTS = ['B.Tech', 'BCA', 'BBA', 'Bcom', 'Bio', 'Micro'];
const FUNNEL_STAGES = ['', 'Call Completed', 'Lead Interested', 'Visit Scheduled', 'Visit Completed', 'Admission Closed'];

// Funnel stages allowed per status
const ALLOWED_FUNNEL = {
  'Applied':  [],
  'Calling':  ['Call Completed', 'Lead Interested'],
  'Verified': ['Visit Scheduled', 'Visit Completed'],
  'Admitted': ['Admission Closed'],
  'Rejected': [],
  'Disabled': [],
};

const initialForm = {
  name: '', fatherName: '', track: '', mobileNo: '',
  whatsappNo: '', subject: '', fullAddress: '', otherTrack: '',
  status: 'Applied', remarks: '', funnelStage: '',
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

// Camera Modal
function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => toast.error('Camera access denied'));
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const capture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onClose();
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-gray-800">Take Photo</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
        </div>
        <video ref={videoRef} autoPlay playsInline className="w-full" />
        <div className="p-4 flex justify-center">
          <button onClick={capture}
            className="bg-primary text-white px-8 py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors flex items-center gap-2">
            <FiCamera size={16} /> Capture
          </button>
        </div>
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
  const [cameraFor, setCameraFor] = useState(null); // which docKey camera is open for

  useEffect(() => {
    if (isEdit) {
      api.get(`/students/${id}`).then(({ data }) => {
        setForm({
          name: data.name, fatherName: data.fatherName, track: data.track,
          mobileNo: data.mobileNo || '', whatsappNo: data.whatsappNo || '',
          subject: data.subject || '', fullAddress: data.fullAddress || '',
          otherTrack: data.otherTrack || '', status: data.status, remarks: '', funnelStage: data.funnelStage || '',
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
    const isImageOnly = accept === 'image/*';
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
              onChange={(e) => setDocs({ ...docs, [docKey]: e.target.files[0] })} />
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="px-2">
      {cameraFor && (
        <CameraModal
          onCapture={(file) => setDocs({ ...docs, [cameraFor]: file })}
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
