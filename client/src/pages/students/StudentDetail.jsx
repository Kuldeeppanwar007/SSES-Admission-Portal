import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { STATUSES, STATUS_COLORS } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import {
  FiEdit2, FiArrowLeft, FiImage, FiFileText, FiExternalLink,
  FiClock, FiDownload, FiSend, FiPhone, FiMapPin, FiUser,
  FiCalendar, FiBook, FiAward, FiCheckCircle, FiAlertCircle,
} from 'react-icons/fi';
import BottomSheet from '../../components/BottomSheet';

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
  const [editReqForm, setEditReqForm] = useState(null);
  const [editReqLoading, setEditReqLoading] = useState(false);
  const [flagLoading, setFlagLoading] = useState(false);
  const [receptionEntries, setReceptionEntries] = useState([]);
  const [receptionLoading, setReceptionLoading] = useState(true);

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
      .then(({ data }) => setStudent(data))
      .catch(() => toast.error('Failed to load student'));
    api.get(`/interviews/${id}`)
      .then(({ data }) => setInterviews(data))
      .catch(() => {});
    api.get(`/reception/all-by-student/${id}`)
      .then(({ data }) => setReceptionEntries(data))
      .catch(() => {})
      .finally(() => setReceptionLoading(false));
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

  const handleFlagToggle = async (flag) => {
    setFlagLoading(true);
    try {
      const { data } = await api.put(`/students/${id}`, { [flag]: !student[flag] });
      setStudent(data);
      toast.success(`${flag === 'isTopper' ? 'Topper' : 'Priority'} flag ${!student[flag] ? 'set' : 'removed'}!`);
    } catch { toast.error('Update failed'); }
    finally { setFlagLoading(false); }
  };

  if (!student) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
    </div>
  );

  const s = student;
  const fmt = (v) => (v !== null && v !== undefined && v !== '') ? String(v) : null;

  // ─── Profile Header Card ───────────────────────────────────────────────────
  const ProfileHeader = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      {/* Top color strip */}
      <div className="h-2 bg-gradient-to-r from-primary to-orange-400" />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {s.photo ? (
            <img src={s.photo} alt="Photo"
              className="w-20 h-20 rounded-2xl object-cover border-2 border-orange-100 shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white text-3xl font-bold shrink-0 shadow-sm">
              {s.name?.[0]?.toUpperCase()}
            </div>
          )}

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-gray-900 leading-tight">{s.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">S/O {s.fatherName || '—'}</p>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${STATUS_COLORS[s.status]}`}>
                {s.status}
              </span>
            </div>

            {/* Quick info pills */}
            <div className="flex flex-wrap gap-2 mt-3">
              {s.track && (
                <span className="flex items-center gap-1 text-xs bg-orange-50 text-primary border border-orange-100 px-2.5 py-1 rounded-full font-medium">
                  <FiMapPin size={11} /> {s.trackName ? `${s.track} · ${s.trackName}` : s.track}
                </span>
              )}
              {s.subject && (
                <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full font-medium">
                  <FiBook size={11} /> {s.subject}
                </span>
              )}
              {s.formSource && (
                <span className="flex items-center gap-1 text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-full font-medium">
                  <FiFileText size={11} /> {s.formSource === 'btech' ? 'B.Tech Form' : s.formSource === 'ssism' ? 'SSISM Form' : 'Manual'}
                </span>
              )}
              {s.funnelStage && (
                <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-medium">
                  <FiCheckCircle size={11} /> {s.funnelStage}
                </span>
              )}
              {s.isTopper && (
                <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2.5 py-1 rounded-full font-semibold">🏆 Topper</span>
              )}
              {s.isPriority && (
                <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-full font-semibold">⚡ Priority</span>
              )}
            </div>
          </div>
        </div>

        {/* Contact row */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100">
          {s.mobileNo && (
            <a href={`tel:${s.mobileNo}`}
              className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 hover:bg-orange-50 hover:text-primary border border-gray-200 px-3 py-1.5 rounded-xl transition-colors">
              <FiPhone size={13} className="text-primary" /> {s.mobileNo}
            </a>
          )}
          {(s.whatsappNo || s.whatsappNumber) && (
            <a href={`https://wa.me/91${s.whatsappNo || s.whatsappNumber}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 hover:bg-green-50 hover:text-green-700 border border-gray-200 px-3 py-1.5 rounded-xl transition-colors">
              <span className="text-green-600 text-xs font-bold">WA</span> {s.whatsappNo || s.whatsappNumber}
            </a>
          )}
          {s.email && (
            <span className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
              ✉️ {s.email}
            </span>
          )}
        </div>

        {/* Flags toggle — admin/manager/track_incharge */}
        {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'track_incharge') && (
          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
            <label className={`flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-xl border-2 transition-all text-sm ${
              s.isTopper ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-gray-50'
            } ${flagLoading ? 'opacity-60 pointer-events-none' : ''}`}>
              <input type="checkbox" checked={!!s.isTopper} onChange={() => handleFlagToggle('isTopper')}
                className="w-4 h-4 accent-yellow-500 cursor-pointer" />
              <span className="font-semibold text-yellow-700">🏆 Topper</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-xl border-2 transition-all text-sm ${
              s.isPriority ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-gray-50'
            } ${flagLoading ? 'opacity-60 pointer-events-none' : ''}`}>
              <input type="checkbox" checked={!!s.isPriority} onChange={() => handleFlagToggle('isPriority')}
                className="w-4 h-4 accent-violet-500 cursor-pointer" />
              <span className="font-semibold text-violet-700">⚡ Priority</span>
            </label>
          </div>
        )}

        {/* Remarks */}
        {s.remarks && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Remarks</p>
            <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              💬 {s.remarks}
            </p>
          </div>
        )}

        {/* Meta footer */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-gray-100">
          {s.sn && <span className="text-xs text-gray-400">S.N. <span className="font-semibold text-gray-600">#{s.sn}</span></span>}
          {s.addedBy?.name && <span className="text-xs text-gray-400">Added by <span className="font-semibold text-gray-600">{s.addedBy.name}</span></span>}
          {s.createdAt && <span className="text-xs text-gray-400">On <span className="font-semibold text-gray-600">{new Date(s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></span>}
          {s.admissionFormNo && <span className="text-xs text-gray-400">Form No. <span className="font-semibold text-gray-600">{s.admissionFormNo}</span></span>}
        </div>
      </div>
    </div>
  );

  // ─── Info Field ───────────────────────────────────────────────────────────
  const InfoField = ({ label, value, full = false }) => {
    if (!value) return null;
    return (
      <div className={`bg-gray-50 rounded-xl p-3 ${full ? 'col-span-2' : ''}`}>
        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-800 break-words">{value}</p>
      </div>
    );
  };

  // ─── Personal Details Card ─────────────────────────────────────────────────
  const hasPersonal = !!(s.gender || s.dob || s.category || s.aadharNo || s.district || s.village || s.tehsil || s.pincode || s.fullAddress);
  const hasFather   = !!(s.fatherOccupation || s.fatherIncome || s.fatherContactNumber);

  const PersonalDetailsCard = () => {
    if (!hasPersonal && !hasFather) return null;
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <FiUser size={14} className="text-blue-600" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Personal Details</p>
        </div>

        <div className="p-5 space-y-5">
          {hasPersonal && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Personal Info</p>
              <div className="grid grid-cols-2 gap-2">
                <InfoField label="Gender"        value={fmt(s.gender)} />
                <InfoField label="Date of Birth" value={fmt(s.dob)} />
                <InfoField label="Category"      value={fmt(s.category)} />
                <InfoField label="Aadhar No"     value={fmt(s.aadharNo)} />
              </div>
            </div>
          )}

          {(s.district || s.village || s.tehsil || s.pincode || s.fullAddress) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Address</p>
              <div className="grid grid-cols-2 gap-2">
                <InfoField label="District"      value={fmt(s.district)} />
                <InfoField label="Village / City" value={fmt(s.village)} />
                <InfoField label="Tehsil"         value={fmt(s.tehsil)} />
                <InfoField label="Pincode"        value={fmt(s.pincode)} />
                {s.fullAddress && (
                  <div className="col-span-2 bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Full Address</p>
                    <p className="text-sm font-medium text-gray-800 break-words">{s.fullAddress}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {hasFather && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Father / Family</p>
              <div className="grid grid-cols-2 gap-2">
                <InfoField label="Occupation"     value={fmt(s.fatherOccupation)} />
                <InfoField label="Annual Income"  value={s.fatherIncome ? `\u20B9 ${s.fatherIncome}` : null} />
                <InfoField label="Father Contact" value={fmt(s.fatherContactNumber)} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Academic Details Card ────────────────────────────────────────────────
  const hasAcademic = !!(s.schoolName || s.school12Sub || s.persentage10 || s.persentage11 || s.persentage12 || s.rollNumber10 || s.rollNumber12 || s.passout12 || s.jeeScore || s.branch || s.priority1 || s.year || s.joinBatch || s.feesScheme || s.trackName || s.isTop20);

  const AcademicDetailsCard = () => {
    if (!hasAcademic) return null;

    const pct = (val) => val != null && val !== '' ? `${val}%` : null;

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
            <FiBook size={14} className="text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Academic Details</p>
        </div>

        <div className="p-5 space-y-5">

          {/* School & Marks */}
          {(s.schoolName || s.school12Sub || s.persentage10 || s.persentage11 || s.persentage12 || s.rollNumber10 || s.rollNumber12 || s.passout12) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">School & Marks</p>
              <div className="grid grid-cols-2 gap-2">
                {s.schoolName && (
                  <div className="col-span-2 bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">School Name</p>
                    <p className="text-sm font-medium text-gray-800">{s.schoolName}</p>
                  </div>
                )}
                <InfoField label="12th Subject"      value={fmt(s.school12Sub)} />
                <InfoField label="12th Passout Year" value={fmt(s.passout12)} />
                <InfoField label="10th Roll No"      value={fmt(s.rollNumber10)} />
                <InfoField label="12th Roll No"      value={fmt(s.rollNumber12)} />
              </div>

              {/* Percentage visual bars */}
              {(s.persentage10 || s.persentage11 || s.persentage12) && (
                <div className="mt-3 space-y-2">
                  {[
                    { label: '10th %', val: s.persentage10 },
                    { label: '11th %', val: s.persentage11 },
                    { label: '12th %', val: s.persentage12 },
                  ].filter(x => x.val != null && x.val !== '').map(({ label, val }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-semibold text-gray-700">{val}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            Number(val) >= 75 ? 'bg-emerald-400' :
                            Number(val) >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                          }`}
                          style={{ width: `${Math.min(Number(val), 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* JEE Score */}
          {s.jeeScore != null && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Entrance</p>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm text-blue-700 font-medium">JEE Score</span>
                <span className="text-lg font-bold text-blue-700">{s.jeeScore}</span>
              </div>
            </div>
          )}

          {/* Course / Branch Preferences */}
          {(s.branch || s.priority1 || s.priority2 || s.priority3) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Branch / Preferences</p>
              <div className="grid grid-cols-2 gap-2">
                <InfoField label="Branch"      value={fmt(s.branch)} />
                <InfoField label="Priority 1"  value={fmt(s.priority1)} />
                <InfoField label="Priority 2"  value={fmt(s.priority2)} />
                <InfoField label="Priority 3"  value={fmt(s.priority3)} />
              </div>
            </div>
          )}

          {/* SSISM Details */}
          {(s.year || s.joinBatch || s.feesScheme || s.trackName || s.isTop20) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">SSISM Details</p>
              <div className="grid grid-cols-2 gap-2">
                <InfoField label="Year"        value={fmt(s.year)} />
                <InfoField label="Join Batch"  value={fmt(s.joinBatch)} />
                <InfoField label="Fees Scheme" value={fmt(s.feesScheme)} />
                <InfoField label="Track Name"  value={fmt(s.trackName)} />
                {s.isTop20 && (
                  <div className="col-span-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <span className="text-xs font-semibold text-amber-700">⭐ Top 20 Student</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  // ─── Payment / Registration Card ──────────────────────────────────────────
  const hasPayment = !!(s.applicationType || s.paymentStatus || s.transactionId || s.regFees || s.regFeesStatus || s.regFeeReceiptNo || s.regFeeDate || s.bookNo || s.receiptNo || s.admissionFormNo || s.admissionType);

  const PaymentCard = () => {
    if (!hasPayment) return null;
    const payStatusColor = {
      SUCCESS:             'bg-emerald-100 text-emerald-700 border-emerald-200',
      INITIATED:           'bg-amber-100 text-amber-700 border-amber-200',
      FAILED:              'bg-rose-100 text-rose-700 border-rose-200',
      NO_PAYMENT_REQUIRED: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    const isAdmitted = s.status === 'Admitted';
    const regFeesEffective = isAdmitted ? 'Paid' : (s.regFeesStatus || 'Unpaid');
    const regStatusColor = regFeesEffective === 'Paid'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : 'bg-rose-100 text-rose-700 border-rose-200';
    return (
      <div className="bg-white rounded-2xl">
        <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
            <FiAward size={14} className="text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Payment & Registration</p>
        </div>
        <div className="p-5 space-y-5">

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            {s.paymentStatus && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${payStatusColor[s.paymentStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                💳 {s.paymentStatus.replace(/_/g, ' ')}
              </span>
            )}
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${regStatusColor}`}>
              🧾 Reg. Fees: {regFeesEffective}
            </span>
            {s.admissionType && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-violet-50 text-violet-700 border-violet-200">
                🎓 {s.admissionType}
              </span>
            )}
          </div>

          {/* Reg Fees highlight */}
          {s.regFees && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm text-emerald-700 font-medium">Registration Fees</span>
              <span className="text-xl font-bold text-emerald-700">₹ {s.regFees}</span>
            </div>
          )}

          {/* Form & Application */}
          {(s.applicationType || s.admissionFormNo || s.bookNo || s.receiptNo) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Form & Application</p>
              <div className="grid grid-cols-2 gap-2">
                <InfoField label="Application Type"  value={fmt(s.applicationType)} />
                <InfoField label="Admission Form No" value={fmt(s.admissionFormNo)} />
              </div>
            </div>
          )}

          {/* Admission fields — Book No & Receipt No */}
          {(s.bookNo || s.receiptNo) && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Admission Details</p>
              <div className="grid grid-cols-2 gap-2">
                <InfoField label="Book No"    value={fmt(s.bookNo)} />
                <InfoField label="Receipt No" value={fmt(s.receiptNo)} />
              </div>
            </div>
          )}

          {/* Payment Details */}
          {(s.transactionId || s.regFeeDate || s.regFeeReceiptNo) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Payment Details</p>
              <div className="grid grid-cols-2 gap-2">
                <InfoField label="Transaction ID" value={fmt(s.transactionId)} />
                <InfoField label="Receipt No"     value={fmt(s.regFeeReceiptNo)} />
                <InfoField label="Payment Date"   value={s.regFeeDate ? new Date(s.regFeeDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  // ─── Reception Entries Card ─────────────────────────────────────────────
  const purposeColor = {
    Visit:        'bg-blue-100 text-blue-700 border-blue-200',
    Inquiry:      'bg-amber-100 text-amber-700 border-amber-200',
    Interview:    'bg-violet-100 text-violet-700 border-violet-200',
    'Re-Interview': 'bg-rose-100 text-rose-700 border-rose-200',
  };

  const ReceptionCard = () => (
    <div className="bg-white rounded-2xl">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <FiCalendar size={14} className="text-violet-600" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Reception Entries</p>
        </div>
        {receptionEntries.length > 0 && (
          <span className="text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-full">
            {receptionEntries.length} visit{receptionEntries.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="p-5">
        {receptionLoading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-400" />
          </div>
        ) : receptionEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <FiCalendar size={28} className="mb-2 opacity-30" />
            <p className="text-sm">Koi reception entry nahi mili</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {['Inquiry', 'Interview', 'Re-Interview'].map(p => {
                const count = receptionEntries.filter(e => e.visitPurpose === p).length;
                if (!count) return null;
                return (
                  <div key={p} className={`rounded-xl p-2.5 text-center border ${purposeColor[p]}`}>
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-[10px] font-medium leading-tight">{p}</p>
                  </div>
                );
              })}
            </div>

            {/* Entry list */}
            {receptionEntries.map((entry, idx) => (
              <div key={entry._id} className="flex gap-3 items-start">
                {/* Timeline dot */}
                <div className="flex flex-col items-center shrink-0 mt-1">
                  <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                    idx === 0 ? 'border-violet-500 bg-violet-500' : 'border-gray-300 bg-white'
                  }`} />
                  {idx < receptionEntries.length - 1 && (
                    <div className="w-0.5 h-full min-h-[24px] bg-gray-100 mt-1" />
                  )}
                </div>

                <div className={`flex-1 rounded-xl p-3 border ${
                  idx === 0 ? 'border-violet-100 bg-violet-50/40' : 'border-gray-100 bg-gray-50'
                }`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${purposeColor[entry.visitPurpose]}`}>
                        {entry.visitPurpose}
                      </span>
                      {entry.town && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <FiMapPin size={10} /> {entry.town}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0">
                      {new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {entry.branch && (
                      <span className="text-xs text-gray-500">Branch: <span className="font-medium text-gray-700">{entry.branch}</span></span>
                    )}
                    {entry.interviewer?.name && (
                      <span className="text-xs text-gray-500">Interviewer: <span className="font-medium text-gray-700">{entry.interviewer.name}</span></span>
                    )}
                    {entry.enteredBy?.name && (
                      <span className="text-xs text-gray-500">By: <span className="font-medium text-gray-700">{entry.enteredBy.name}</span></span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ─── Interview History Card ───────────────────────────────────────────────
  const InterviewCard = () => {
    if (interviews.length === 0 && !s.finalInterview?.result) return null;
    const technicalPassed = interviews.some(i => i.result === 'Pass');
    const isValidFormSource = ['ssism', 'btech'].includes(s.formSource);
    const canTakeFinal = technicalPassed && isValidFormSource;
    const resultColor = (r) => r === 'Pass' ? 'bg-emerald-100 text-emerald-700' : r === 'Fail' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700';
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center"><FiAward size={14} className="text-primary" /></div>
            <p className="text-sm font-semibold text-gray-800">Interview History</p>
          </div>
          <div className="flex items-center gap-2">
            {interviews.length > 0 && <span className="text-xs font-semibold bg-orange-50 text-primary border border-orange-100 px-2.5 py-1 rounded-full">{interviews.length} round{interviews.length !== 1 ? 's' : ''}</span>}
            {user?.role === 'admin' && <button onClick={() => canTakeFinal && setFinalForm({ remarks: '', result: 'Pending' })} disabled={!canTakeFinal} title={!isValidFormSource ? 'Sirf SSISM ya B.Tech form wale students ka final interview ho sakta hai' : !technicalPassed ? 'Technical interview pass hone ke baad hi final interview le sakte hain' : ''} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${canTakeFinal ? 'bg-primary text-white hover:bg-primary-dark' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>★ Final Interview</button>}
          </div>
        </div>
        <div className="p-5 space-y-4">
          {interviews.map((h) => (
            <div key={h._id} className="border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-primary bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">Round {h.round}</span>
                  {h.interviewType && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${h.interviewType === 'Online' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>{h.interviewType}</span>}
                  {h.interviewer?.name && <span className="text-xs text-gray-500 flex items-center gap-1"><FiUser size={10} /> {h.interviewer.name}</span>}
                  <span className="text-xs text-gray-400">{new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${resultColor(h.result)}`}>{h.result}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {[['Maths', h.mathematicsMarks], ['Subject', h.subjectiveKnowledge], ['Reasoning', h.reasoningMarks], ['Goal', h.goalClarity], ['Sincerity', h.sincerity], ['Comm.', h.communicationLevel], ['Confidence', h.confidenceLevel], ...(h.assignmentMarks != null ? [['Assignment', h.assignmentMarks]] : [])].map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-lg px-2.5 py-2 text-center"><p className="text-[10px] text-gray-400 leading-tight mb-0.5">{label}</p><p className="text-sm font-bold text-gray-700">{val}<span className="text-[10px] font-normal text-gray-400">/5</span></p></div>
                ))}
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 flex items-center justify-between"><span className="text-xs text-gray-500 font-medium">Total Score</span><span className="text-base font-bold text-primary">{h.totalMark}</span></div>
              {h.remarks && <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg px-3 py-2">💬 {h.remarks}</p>}
            </div>
          ))}
          {s.finalInterview?.result && (
            <div className="border-2 border-primary/20 bg-orange-50/30 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold bg-primary text-white px-3 py-1 rounded-full">★ Final Interview</span>
                  {s.finalInterview.doneBy?.name && <span className="text-xs text-gray-500 flex items-center gap-1"><FiUser size={10} /> {s.finalInterview.doneBy.name}</span>}
                  {s.finalInterview.doneAt && <span className="text-xs text-gray-400">{new Date(s.finalInterview.doneAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${resultColor(s.finalInterview.result)}`}>{s.finalInterview.result}</span>
              </div>
              {s.finalInterview.remarks && <p className="text-xs text-gray-500 bg-white border border-orange-100 rounded-lg px-3 py-2">💬 {s.finalInterview.remarks}</p>}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Modals ────────────────────────────────────────────────────────────────
  return (
    <div className="px-2 pb-10">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => navigate('/students')}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm shrink-0">
          <FiArrowLeft size={16} /> Back
        </button>
        <h2 className="text-lg font-bold text-gray-800">Student Profile</h2>
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

      <ProfileHeader />

      {/* Row 1: Personal + Academic side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 items-start">
        <div className="h-80 overflow-y-auto rounded-2xl"><PersonalDetailsCard /></div>
        <div className="h-80 overflow-y-auto rounded-2xl"><AcademicDetailsCard /></div>
      </div>

      {/* Row 2: Payment + Reception side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="h-80 overflow-y-auto rounded-2xl border border-gray-100 shadow-sm"><PaymentCard /></div>
        <div className="h-80 overflow-y-auto rounded-2xl border border-gray-100 shadow-sm"><ReceptionCard /></div>
      </div>

      <InterviewCard />

      {/* ── Modals ── */}
      {finalForm && (
        <BottomSheet open onClose={() => setFinalForm(null)} title="Take Final Interview" maxWidth="max-w-sm">
          <form onSubmit={handleFinalInterview} className="space-y-4 pt-2">
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
        </BottomSheet>
      )}

      {editReqForm && (
        <BottomSheet open onClose={() => setEditReqForm(null)} title="Request Edit" maxWidth="max-w-sm">
          <form onSubmit={handleEditRequest} className="space-y-4 pt-2">
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
        </BottomSheet>
      )}

      {showHistory && (
        <BottomSheet open onClose={() => setShowHistory(false)} title="Activity History"
          subtitle={`${history.length} update${history.length !== 1 ? 's' : ''} found`}>
          <div className="pt-2">
            {history.length === 0 ? (
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
                            <span className="text-[11px] text-gray-400 shrink-0">
                              {new Date(h.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
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
    </div>
  );
}
