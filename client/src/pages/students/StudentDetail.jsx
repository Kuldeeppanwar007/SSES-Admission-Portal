import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { STATUSES, STATUS_COLORS } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [student, setStudent] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: '', remarks: '' });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    api.get(`/students/${id}`)
      .then(({ data }) => { setStudent(data); setStatusForm({ status: data.status, remarks: data.remarks || '' }); })
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

  if (!student) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div></div>;

  const info = [
    ['S.N.', student.sn], ['Name', student.name], ['Father Name', student.fatherName],
    ['Track', student.track], ['Mobile No', student.mobileNo], ['WhatsApp No', student.whatsappNo],
    ['Subject', student.subject], ['Other Track', student.otherTrack], ['Full Address', student.fullAddress],
    ['Added By', student.addedBy?.name], ['Added On', new Date(student.createdAt).toLocaleDateString('en-IN')],
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/students')} className="text-gray-500 hover:text-gray-700">← Back</button>
        <h2 className="text-2xl font-bold text-gray-800">Student Details</h2>
        <button onClick={() => navigate(`/students/${id}/edit`)}
          className="ml-auto bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-dark">Edit</button>
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

        <div className="grid grid-cols-2 gap-3">
          {info.map(([label, value]) => value ? (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-medium mt-0.5">{value}</p>
            </div>
          ) : null)}
        </div>

        {student.marksheet && (
          <div className="mt-4">
            <a href={student.marksheet} target="_blank"
              className="inline-flex items-center gap-2 bg-orange-50 text-primary px-4 py-2 rounded-lg text-sm hover:bg-orange-100">
              📄 View Marksheet
            </a>
          </div>
        )}
      </div>

      {user?.role !== 'track_incharge' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-4">Update Status</h3>
          <div className="flex flex-wrap gap-3">
            <select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input placeholder="Remarks (optional)" value={statusForm.remarks}
              onChange={(e) => setStatusForm({ ...statusForm, remarks: e.target.value })}
              className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" />
            <button onClick={handleStatusUpdate} disabled={updating}
              className="bg-primary text-white px-5 py-2 rounded-lg text-sm hover:bg-primary-dark disabled:opacity-60">
              {updating ? 'Updating...' : 'Update'}
            </button>
          </div>
          {student.remarks && <p className="text-sm text-gray-500 mt-2">Last remark: {student.remarks}</p>}
        </div>
      )}
    </div>
  );
}
