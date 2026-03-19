import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { TRACKS, STATUSES } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const initialForm = {
  sn: '', name: '', fatherName: '', track: '', mobileNo: '',
  whatsappNo: '', subject: '', fullAddress: '', otherTrack: '',
  status: 'Applied', remarks: '',
};

export default function StudentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(initialForm);
  const [photo, setPhoto] = useState(null);
  const [marksheet, setMarksheet] = useState(null);
  const [existingDocs, setExistingDocs] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit) {
      api.get(`/students/${id}`).then(({ data }) => {
        setForm({ sn: data.sn || '', name: data.name, fatherName: data.fatherName, track: data.track,
          mobileNo: data.mobileNo || '', whatsappNo: data.whatsappNo || '', subject: data.subject || '',
          fullAddress: data.fullAddress || '', otherTrack: data.otherTrack || '',
          status: data.status, remarks: data.remarks || '' });
        setExistingDocs({ photo: data.photo, marksheet: data.marksheet });
      }).catch(() => toast.error('Failed to load student'));
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      if (photo) formData.append('photo', photo);
      if (marksheet) formData.append('marksheet', marksheet);

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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500">*</span>}</label>
      <input type={type} value={form[key]} required={required}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/students')} className="text-gray-500 hover:text-gray-700">← Back</button>
        <h2 className="text-2xl font-bold text-gray-800">{isEdit ? 'Edit Student' : 'Add Student'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('S.N.', 'sn')}
          {field('Student Name', 'name', 'text', true)}
          {field('Father Name', 'fatherName', 'text', true)}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Track<span className="text-red-500">*</span></label>
            <select value={form.track} required onChange={(e) => setForm({ ...form, track: e.target.value })}
              disabled={user?.role === 'track_incharge'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Select Track</option>
              {TRACKS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          {field('Mobile No', 'mobileNo', 'tel')}
          {field('WhatsApp No', 'whatsappNo', 'tel')}
          {field('Subject', 'subject')}
          {field('Other Track', 'otherTrack')}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
          <textarea value={form.fullAddress} rows={2}
            onChange={(e) => setForm({ ...form, fullAddress: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        {isEdit && user?.role !== 'track_incharge' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
            {existingDocs.photo && <a href={existingDocs.photo} target="_blank" className="text-xs text-primary block mb-1">View existing photo</a>}
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-primary file:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marksheet</label>
            {existingDocs.marksheet && <a href={existingDocs.marksheet} target="_blank" className="text-xs text-primary block mb-1">View existing marksheet</a>}
            <input type="file" accept="image/*,.pdf" onChange={(e) => setMarksheet(e.target.files[0])}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-primary file:text-white" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
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
