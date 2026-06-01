import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { agent } from '../../api/agentApi';
import api from '../../api/axios';
import { STATUSES, STATUS_COLORS } from '../../utils/constants';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import {
  FiEdit2, FiArrowLeft, FiImage, FiFileText, FiExternalLink,
  FiClock, FiDownload, FiSend, FiPhone, FiMapPin, FiUser,
  FiCalendar, FiBook, FiAward, FiCheckCircle, FiAlertCircle, FiChevronDown,
  FiTrash2,
} from 'react-icons/fi';
import BottomSheet from '../../components/BottomSheet';
import ReceptionEntryModal from '../../components/ReceptionEntryModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [receptionOpen, setReceptionOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [localAdmType, setLocalAdmType] = useState('SNS');
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [adminEditForm, setAdminEditForm] = useState(null);
  const [adminSaving, setAdminSaving] = useState(false);
  const [editTab, setEditTab] = useState('general');
  const exportRef = useRef(null);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState({ type: '', id: '', idx: null, details: {} });

  useEffect(() => {
    if (student?.admissionType && ['SNS', 'SVS', 'Shri Ram'].includes(student.admissionType)) {
      setLocalAdmType(student.admissionType);
    }
  }, [student?.admissionType]);

  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExport = async (format = 'xlsx') => {
    setExporting(true);
    try {
      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;
      const namePart = student?.name ? student.name.replace(/[^a-zA-Z0-9]/g, '_') : 'student';
      const filename = `${namePart}_export_${dateStr}`;

      if (format === 'pdf') {
        const res = await api.post('/students/export', { ids: [id] }, { params: { format: 'json' } });
        const rows = res.data;
        if (!rows || rows.length === 0) {
          toast.error('No data to export');
          return;
        }

        const doc = new jsPDF('landscape');
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`Student Export (${dateStr})`, 10, 15);

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
        toast.success('Exported as PDF successfully');
      } else {
        const res = await api.post('/students/export', { ids: [id] }, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url; a.download = `${filename}.xlsx`; a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Exported as Excel successfully');
      }
    } catch (err) {
      console.error("Export error:", err);
      toast.error('Export failed');
    }
    finally { setExporting(false); }
  };

  const fetchReceptionEntries = () => {
    api.get(`/reception/all-by-student/${id}`)
      .then(({ data }) => setReceptionEntries(data))
      .catch(() => { })
      .finally(() => setReceptionLoading(false));
  };

  useEffect(() => {
    api.get(`/students/${id}`)
      .then(({ data }) => setStudent(data))
      .catch(() => toast.error('Failed to load student'));
    api.get(`/interviews/${id}`)
      .then(({ data }) => setInterviews(data))
      .catch(() => { });
    fetchReceptionEntries();
  }, [id]);

  const handleFinalInterview = (e) => {
    e.preventDefault();
    setShowFinalConfirm(true);
  };

  const handleConfirmFinalInterview = async () => {
    setShowFinalConfirm(false);
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

  const handleAdmTypeChange = async (val) => {
    setFlagLoading(true);
    try {
      const { data } = await api.put(`/students/${id}`, { admissionType: val });
      setStudent(data);
      toast.success(`Admission type ${val ? 'set to ' + val : 'removed'}!`);
    } catch { toast.error('Update failed'); }
    finally { setFlagLoading(false); }
  };

  const handleOpenAdminEdit = () => {
    const sFields = {};
    const whitelist = [
      'name', 'fatherName', 'track', 'mobileNo', 'whatsappNo', 'subject', 'fullAddress', 'otherTrack',
      'email', 'schoolName', 'district', 'village', 'whatsappNumber', 'jeeScore', 'persentage12', 'persentage10',
      'persentage11', 'branch', 'year', 'joinBatch', 'feesScheme', 'category', 'gender', 'school12Sub', 'dob',
      'aadharNo', 'fatherOccupation', 'fatherIncome', 'fatherContactNumber', 'pincode', 'tehsil', 'trackName',
      'isTopper', 'isPriority', 'bookNo', 'receiptNo', 'admissionFormNo', 'status', 'remarks', 'funnelStage',
      'applicationType', 'regFees', 'regFeesStatus', 'regFeeReceiptNo', 'regFeeDate', 'formSource', 'admissionType',
      'finalInterview'
    ];
    whitelist.forEach(f => {
      sFields[f] = student[f] !== undefined ? student[f] : '';
    });
    if (!sFields.finalInterview) {
      sFields.finalInterview = { round: '', remarks: '', result: '', interviewType: '', doneBy: '', doneAt: '' };
    }

    setAdminEditForm({
      studentUpdates: sFields,
      interviewUpdates: interviews.map(i => ({ ...i })),
      receptionUpdates: receptionEntries.map(r => ({ ...r }))
    });
    setEditTab('general');
    setAdminEditOpen(true);
  };

  const formatDateForInput = (dStr) => {
    if (!dStr) return '';
    try {
      return new Date(dStr).toISOString().slice(0, 10);
    } catch (_) {
      return '';
    }
  };

  const handleAdminSave = async (e) => {
    e.preventDefault();
    setAdminSaving(true);
    try {
      await api.put(`/students/${id}/admin-edit`, adminEditForm);
      toast.success('Student records fully updated!');
      setAdminEditOpen(false);
      setAdminEditForm(null);
      const { data: sData } = await api.get(`/students/${id}`);
      setStudent(sData);
      const { data: iData } = await api.get(`/interviews/${id}`);
      setInterviews(iData);
      fetchReceptionEntries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save admin edits');
    } finally {
      setAdminSaving(false);
    }
  };

  const handleDeleteReception = (entryId, idx) => {
    const entry = adminEditForm.receptionUpdates[idx];
    setDeleteInfo({
      type: 'reception',
      id: entryId,
      idx,
      details: {
        title: 'Delete Visit Entry',
        message: 'Kya aap sach me ye visit entry delete karna chahte hain?',
        fields: [
          { label: 'Visit Entry', value: `#${idx + 1}` },
          { label: 'Purpose', value: entry.visitPurpose || '—' },
          { label: 'Date', value: entry.date ? new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
          { label: 'Town', value: entry.town || '—' }
        ]
      }
    });
    setShowDeleteConfirm(true);
  };

  const handleDeleteInterview = (interviewId, idx) => {
    const inv = adminEditForm.interviewUpdates[idx];
    const totalMark =
      Number(inv.mathematicsMarks || 0) + Number(inv.subjectiveKnowledge || 0) +
      Number(inv.reasoningMarks || 0) + Number(inv.goalClarity || 0) +
      Number(inv.sincerity || 0) + Number(inv.communicationLevel || 0) +
      Number(inv.confidenceLevel || 0) + Number(inv.assignmentMarks || 0);

    setDeleteInfo({
      type: 'interview',
      id: interviewId,
      idx,
      details: {
        title: 'Delete Technical Round',
        message: 'Kya aap sach me ye technical round delete karna chahte hain? Remaining rounds automatically correct/re-index ho jayenge.',
        fields: [
          { label: 'Round', value: `#${inv.round}` },
          { label: 'Date', value: inv.date ? new Date(inv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
          { label: 'Type', value: inv.interviewType || '—' },
          { label: 'Result', value: inv.result || 'Pending' },
          { label: 'Total Score', value: `${totalMark} / 40` }
        ]
      }
    });
    setShowDeleteConfirm(true);
  };

  const handleDeleteFinalInterview = () => {
    const final = adminEditForm.studentUpdates.finalInterview;
    setDeleteInfo({
      type: 'final',
      id: null,
      idx: null,
      details: {
        title: 'Delete Final Interview',
        message: 'Kya aap sach me final interview details delete karna chahte hain?',
        fields: [
          { label: 'Round No', value: final?.round ? `#${final.round}` : '—' },
          { label: 'Result', value: final?.result || '—' },
          { label: 'Type', value: final?.interviewType || '—' },
          { label: 'Done By', value: final?.doneBy?.name || '—' }
        ]
      }
    });
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    const { type, id: deleteId, idx } = deleteInfo;
    setShowDeleteConfirm(false);
    try {
      if (type === 'reception') {
        await api.delete(`/reception/${deleteId}`);
        toast.success("Visit entry successfully deleted!");

        // Update local state in form
        const list = adminEditForm.receptionUpdates.filter(r => r._id !== deleteId);
        setAdminEditForm({ ...adminEditForm, receptionUpdates: list });

        // Update actual parent data state
        fetchReceptionEntries();
      } else if (type === 'interview') {
        await api.delete(`/interviews/${deleteId}`);
        toast.success("Technical round successfully deleted!");

        // Update local state in form
        const list = adminEditForm.interviewUpdates.filter(i => i._id !== deleteId);
        // Re-index local rounds in UI chronologically
        const reIndexed = list.sort((a, b) => new Date(a.date) - new Date(b.date)).map((item, i) => ({ ...item, round: i + 1 }));
        setAdminEditForm({ ...adminEditForm, interviewUpdates: reIndexed });

        // Update actual parent data state
        const { data: iData } = await api.get(`/interviews/${id}`);
        setInterviews(iData);
      } else if (type === 'final') {
        await api.delete(`/interviews/${id}/final`);
        toast.success("Final interview successfully deleted!");

        // Update local state in form
        setAdminEditForm({
          ...adminEditForm,
          studentUpdates: {
            ...adminEditForm.studentUpdates,
            finalInterview: { round: '', remarks: '', result: '', interviewType: '', doneBy: '', doneAt: '' }
          }
        });

        // Update actual parent data state
        const { data: sData } = await api.get(`/students/${id}`);
        setStudent(sData);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    } finally {
      setDeleteInfo({ type: '', id: '', idx: null, details: {} });
    }
  };

  const tabClass = (t) => `flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-xl transition-all duration-200 text-center ${editTab === t
      ? 'bg-primary text-white shadow-md shadow-primary/25 scale-[1.02]'
      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
    }`;

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
      <div className="h-2 bg-gradient-to-r from-primary to-primary-light" />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {s.photo ? (
            <img src={s.photo} alt="Photo"
              className="w-20 h-20 rounded-2xl object-cover border-2 border-primary/20 shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-3xl font-bold shrink-0 shadow-sm">
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
          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 flex-wrap">
            <label className={`flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-xl border-2 transition-all text-sm ${s.isTopper ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-gray-50'
              } ${flagLoading ? 'opacity-60 pointer-events-none' : ''}`}>
              <input type="checkbox" checked={!!s.isTopper} onChange={() => handleFlagToggle('isTopper')}
                className="w-4 h-4 accent-yellow-500 cursor-pointer" />
              <span className="font-semibold text-yellow-700">🏆 Topper</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-xl border-2 transition-all text-sm ${s.isPriority ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-gray-50'
              } ${flagLoading ? 'opacity-60 pointer-events-none' : ''}`}>
              <input type="checkbox" checked={!!s.isPriority} onChange={() => handleFlagToggle('isPriority')}
                className="w-4 h-4 accent-violet-500 cursor-pointer" />
              <span className="font-semibold text-violet-700">⚡ Priority</span>
            </label>

            {/* Admission Type Dropdown + Checkbox */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all text-sm ${['SNS', 'SVS', 'Shri Ram'].includes(s.admissionType) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'
              } ${flagLoading ? 'opacity-60 pointer-events-none' : ''}`}>
              <input type="checkbox"
                checked={['SNS', 'SVS', 'Shri Ram'].includes(s.admissionType)}
                onChange={(e) => handleAdmTypeChange(e.target.checked ? localAdmType : null)}
                className="w-4 h-4 accent-blue-500 cursor-pointer"
              />
              <select
                value={localAdmType}
                onChange={(e) => {
                  setLocalAdmType(e.target.value);
                  if (['SNS', 'SVS', 'Shri Ram'].includes(s.admissionType)) {
                    handleAdmTypeChange(e.target.value);
                  }
                }}
                className={`bg-transparent font-semibold outline-none cursor-pointer ${['SNS', 'SVS', 'Shri Ram'].includes(s.admissionType) ? 'text-blue-700' : 'text-gray-700'
                  }`}
              >
                <option value="SNS">SNS</option>
                <option value="SVS">SVS</option>
                <option value="Shri Ram">Shri Ram</option>
              </select>
            </div>
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
  const hasFather = !!(s.fatherOccupation || s.fatherIncome || s.fatherContactNumber);

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
                <InfoField label="Gender" value={fmt(s.gender)} />
                <InfoField label="Date of Birth" value={fmt(s.dob)} />
                <InfoField label="Category" value={fmt(s.category)} />
                <InfoField label="Aadhar No" value={fmt(s.aadharNo)} />
              </div>
            </div>
          )}

          {(s.district || s.village || s.tehsil || s.pincode || s.fullAddress) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Address</p>
              <div className="grid grid-cols-2 gap-2">
                <InfoField label="District" value={fmt(s.district)} />
                <InfoField label="Village / City" value={fmt(s.village)} />
                <InfoField label="Tehsil" value={fmt(s.tehsil)} />
                <InfoField label="Pincode" value={fmt(s.pincode)} />
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
                <InfoField label="Occupation" value={fmt(s.fatherOccupation)} />
                <InfoField label="Annual Income" value={s.fatherIncome ? `\u20B9 ${s.fatherIncome}` : null} />
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
                <InfoField label="12th Subject" value={fmt(s.school12Sub)} />
                <InfoField label="12th Passout Year" value={fmt(s.passout12)} />
                <InfoField label="10th Roll No" value={fmt(s.rollNumber10)} />
                <InfoField label="12th Roll No" value={fmt(s.rollNumber12)} />
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
                          className={`h-full rounded-full ${Number(val) >= 75 ? 'bg-emerald-400' :
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
                <InfoField label="Branch" value={fmt(s.branch)} />
                <InfoField label="Priority 1" value={fmt(s.priority1)} />
                <InfoField label="Priority 2" value={fmt(s.priority2)} />
                <InfoField label="Priority 3" value={fmt(s.priority3)} />
              </div>
            </div>
          )}

          {/* SSISM Details */}
          {(s.year || s.joinBatch || s.feesScheme || s.trackName || s.isTop20) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">SSISM Details</p>
              <div className="grid grid-cols-2 gap-2">
                <InfoField label="Year" value={fmt(s.year)} />
                <InfoField label="Join Batch" value={fmt(s.joinBatch)} />
                <InfoField label="Fees Scheme" value={fmt(s.feesScheme)} />
                <InfoField label="Track Name" value={fmt(s.trackName)} />
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
      SUCCESS: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      INITIATED: 'bg-amber-100 text-amber-700 border-amber-200',
      FAILED: 'bg-rose-100 text-rose-700 border-rose-200',
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
                <InfoField label="Application Type" value={fmt(s.applicationType)} />
                <InfoField label="Admission Form No" value={fmt(s.admissionFormNo)} />
              </div>
            </div>
          )}

          {/* Admission fields — Book No & Receipt No */}
          {(s.bookNo || s.receiptNo) && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Admission Details</p>
              <div className="grid grid-cols-2 gap-2">
                <InfoField label="Book No" value={fmt(s.bookNo)} />
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
                <InfoField label="Receipt No" value={fmt(s.regFeeReceiptNo)} />
                <InfoField label="Payment Date" value={s.regFeeDate ? new Date(s.regFeeDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  // ─── Reception Entries Card ─────────────────────────────────────────────
  const purposeColor = {
    Visit: 'bg-blue-100 text-blue-700 border-blue-200',
    Inquiry: 'bg-amber-100 text-amber-700 border-amber-200',
    Interview: 'bg-violet-100 text-violet-700 border-violet-200',
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
        <div className="flex items-center gap-2">
          {receptionEntries.length > 0 && (
            <span className="text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-full">
              {receptionEntries.length} visit{receptionEntries.length !== 1 ? 's' : ''}
            </span>
          )}
          {(user?.role === 'admin' || user?.role === 'receptionist' || user?.role === 'interviewer') && (
            <button onClick={() => setReceptionOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition-colors">
              <FiFileText size={13} /> Entry
            </button>
          )}
        </div>
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
                  <div className={`w-2.5 h-2.5 rounded-full border-2 ${idx === 0 ? 'border-violet-500 bg-violet-500' : 'border-gray-300 bg-white'
                    }`} />
                  {idx < receptionEntries.length - 1 && (
                    <div className="w-0.5 h-full min-h-[24px] bg-gray-100 mt-1" />
                  )}
                </div>

                <div className={`flex-1 rounded-xl p-3 border ${idx === 0 ? 'border-violet-100 bg-violet-50/40' : 'border-gray-100 bg-gray-50'
                  }`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${purposeColor[entry.visitPurpose]}`}>
                        {entry.visitPurpose}
                      </span>
                      {entry.entryType && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${entry.entryType === 'Online' ? 'bg-sky-100 text-sky-700' : 'bg-gray-200 text-gray-600'
                          }`}>
                          {entry.entryType.toUpperCase()}
                        </span>
                      )}
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

                  <div className="mt-3 space-y-1.5 pt-2 border-t border-gray-200">
                    {entry.branch && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-500 uppercase tracking-wide">Branch</span>
                        <span className="text-xs font-semibold text-gray-700">{entry.branch}</span>
                      </div>
                    )}
                    {entry.interviewer?.name && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-500 uppercase tracking-wide">Interviewer</span>
                        <span className="text-xs font-semibold text-gray-700">{entry.interviewer.name}</span>
                      </div>
                    )}
                    {entry.enteredBy?.name && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-500 uppercase tracking-wide">Entered By</span>
                        <span className="text-xs font-semibold text-gray-700">{entry.enteredBy.name}</span>
                      </div>
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
            {user?.role === 'admin' && <button onClick={() => canTakeFinal && setFinalForm({ remarks: '', result: 'Pending', interviewType: 'On Campus' })} disabled={!canTakeFinal} title={!isValidFormSource ? 'Sirf SSISM ya B.Tech form wale students ka final interview ho sakta hai' : !technicalPassed ? 'Technical interview pass hone ke baad hi final interview le sakte hain' : ''} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${canTakeFinal ? 'bg-primary text-white hover:bg-primary-dark' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>★ Final Interview</button>}
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
                  {s.finalInterview.interviewType && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.finalInterview.interviewType === 'Online' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>{s.finalInterview.interviewType}</span>}
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
          {user?.role === 'admin' && user?.canEditStudent && (
            <button onClick={handleOpenAdminEdit}
              className="flex items-center gap-1.5 bg-primary text-white px-3.5 py-1.5 rounded-lg text-sm hover:bg-primary-dark font-semibold shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
              <FiEdit2 size={13} /> Admin Edit
            </button>
          )}
          <button onClick={() => navigate(`/students/${id}/edit`)}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-sm hover:bg-primary-dark hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
            <FiEdit2 size={13} /> Edit
          </button>
          <button onClick={() => navigate(`/students/${id}/calling`)}
            className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg text-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-md shadow-orange-600/20 font-semibold">
            <FiPhone size={13} /> Calling
          </button>
          <div className="relative" ref={exportRef}>
            <button onClick={() => setExportOpen(!exportOpen)} disabled={exporting}
              className="flex items-center gap-1.5 border border-primary text-primary px-3 py-1.5 rounded-lg text-sm hover:bg-primary/5 disabled:opacity-60 transition-colors">
              <FiDownload size={13} /> {exporting ? 'Exporting...' : 'Export'}
              <FiChevronDown size={14} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <button onClick={() => { handleExport('xlsx'); setExportOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-primary/5 hover:text-primary">
                  Excel
                </button>
                <button onClick={() => { handleExport('pdf'); setExportOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-primary/5 hover:text-primary">
                  PDF
                </button>
              </div>
            )}
          </div>
          <button onClick={handleViewHistory}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
            <FiClock size={13} /> History
          </button>
          {user?.role === 'track_incharge' && (
            <button onClick={() => setEditReqForm({ field: '', newValue: '', reason: '' })}
              className="flex items-center gap-1.5 border border-primary/20 text-primary px-3 py-1.5 rounded-lg text-sm hover:bg-primary/5">
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
      {receptionOpen && (
        <ReceptionEntryModal
          student={student}
          onClose={() => setReceptionOpen(false)}
          onSaved={fetchReceptionEntries}
        />
      )}

      {finalForm && (
        <BottomSheet open onClose={() => setFinalForm(null)} title="Take Final Interview" maxWidth="max-w-sm">
          <form onSubmit={handleFinalInterview} className="space-y-4 pt-2">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFinalForm({ ...finalForm, interviewType: 'On Campus' })}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${finalForm.interviewType === 'On Campus' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                On Campus
              </button>
              <button
                type="button"
                onClick={() => setFinalForm({ ...finalForm, interviewType: 'Online' })}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${finalForm.interviewType === 'Online' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Online
              </button>
            </div>
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

      {showFinalConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col my-auto max-h-[90vh] text-left">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-orange-50/50 to-white">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-primary shrink-0">
                <FiAlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Confirm Final Interview</h3>
                <p className="text-xs text-gray-500 font-medium">Please review final decision details before submitting</p>
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
                  <span className="text-gray-400 font-semibold uppercase tracking-wide">Interview Round</span>
                  <span className="text-gray-700 font-bold">Final Round ({interviews.length + 1})</span>
                </div>
                {finalForm.interviewType && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">Type</span>
                    <span className="text-gray-700 font-bold">{finalForm.interviewType}</span>
                  </div>
                )}
              </div>

              {/* Decision */}
              <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 flex justify-between items-center">
                <span className="text-xs text-gray-600 font-semibold">Final Result Decision</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${finalForm.result === 'Pass' ? 'bg-emerald-100 text-emerald-700' :
                    finalForm.result === 'Fail' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                  }`}>{finalForm.result}</span>
              </div>

              {/* Remarks */}
              {finalForm.remarks && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Remarks</p>
                  <p className="text-xs text-gray-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 italic">
                    "{finalForm.remarks}"
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowFinalConfirm(false)}
                className="flex-1 border border-slate-200 bg-white text-gray-500 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all duration-200"
              >
                Cancel / Edit
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalInterview}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl text-xs font-bold hover:bg-primary-dark hover:shadow-lg active:scale-95 transition-all duration-200"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
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

      {adminEditOpen && adminEditForm && (
        <BottomSheet open onClose={() => { setAdminEditOpen(false); setAdminEditForm(null); }} title="Admin Control Center — Edit Profile" subtitle={`Enforced Admin Edit Mode · Student: ${student.name}`} maxWidth="max-w-5xl">
          <div className="flex flex-col max-h-[75vh] sm:max-h-[70vh]">
            {/* Tabs */}
            <div className="flex p-1.5 bg-gray-50 border border-gray-100 rounded-2xl mb-6 shrink-0 flex-wrap gap-1">
              <button type="button" onClick={() => setEditTab('general')} className={tabClass('general')}>
                <FiUser size={14} /> General & Personal
              </button>
              <button type="button" onClick={() => setEditTab('academic')} className={tabClass('academic')}>
                <FiBook size={14} /> Academic Info
              </button>
              <button type="button" onClick={() => setEditTab('reception')} className={tabClass('reception')}>
                <FiCalendar size={14} /> Reception Visits ({adminEditForm.receptionUpdates.length})
              </button>
              <button type="button" onClick={() => setEditTab('interviews')} className={tabClass('interviews')}>
                <FiAward size={14} /> Technical Rounds ({adminEditForm.interviewUpdates.length})
              </button>
              <button type="button" onClick={() => setEditTab('final')} className={tabClass('final')}>
                <FiCheckCircle size={14} /> Final Interview
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAdminSave} className="flex flex-col flex-1 min-h-0 text-left">
              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto pr-1 pb-5 space-y-5">
                {editTab === 'general' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Student Name <span className="text-primary">*</span></label>
                      <input type="text" required value={adminEditForm.studentUpdates.name}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, name: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Father's Name</label>
                      <input type="text" value={adminEditForm.studentUpdates.fatherName}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, fatherName: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mobile Number <span className="text-primary">*</span></label>
                      <input type="text" required value={adminEditForm.studentUpdates.mobileNo}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, mobileNo: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">WhatsApp Number</label>
                      <input type="text" value={adminEditForm.studentUpdates.whatsappNo || adminEditForm.studentUpdates.whatsappNumber || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, whatsappNo: e.target.value, whatsappNumber: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Track</label>
                      <select value={adminEditForm.studentUpdates.track}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, track: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 cursor-pointer bg-white">
                        <option value="">No Track</option>
                        {['Harda', 'Khategaon', 'Rehti', 'Satwas & Kannod'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Town / Village</label>
                      <input type="text" value={adminEditForm.studentUpdates.village || adminEditForm.studentUpdates.trackName || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, village: e.target.value, trackName: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Branch</label>
                      <input type="text" value={adminEditForm.studentUpdates.branch || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, branch: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Subject</label>
                      <input type="text" value={adminEditForm.studentUpdates.subject || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, subject: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Admission Form No</label>
                      <input type="text" value={adminEditForm.studentUpdates.admissionFormNo || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, admissionFormNo: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
                      <input type="email" value={adminEditForm.studentUpdates.email || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, email: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Gender</label>
                      <select value={adminEditForm.studentUpdates.gender || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, gender: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 cursor-pointer bg-white">
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date of Birth</label>
                      <input type="date" value={formatDateForInput(adminEditForm.studentUpdates.dob)}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, dob: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Category</label>
                      <input type="text" value={adminEditForm.studentUpdates.category || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, category: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Aadhar Number</label>
                      <input type="text" value={adminEditForm.studentUpdates.aadharNo || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, aadharNo: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tehsil</label>
                      <input type="text" value={adminEditForm.studentUpdates.tehsil || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, tehsil: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">District</label>
                      <input type="text" value={adminEditForm.studentUpdates.district || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, district: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Pincode</label>
                      <input type="number" value={adminEditForm.studentUpdates.pincode || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, pincode: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Father's Contact Number</label>
                      <input type="text" value={adminEditForm.studentUpdates.fatherContactNumber || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, fatherContactNumber: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Full Address</label>
                      <textarea rows={2} value={adminEditForm.studentUpdates.fullAddress || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, fullAddress: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 resize-none" />
                    </div>
                  </div>
                )}

                {editTab === 'academic' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">School Name</label>
                      <input type="text" value={adminEditForm.studentUpdates.schoolName || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, schoolName: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">12th Subject</label>
                      <input type="text" value={adminEditForm.studentUpdates.school12Sub || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, school12Sub: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">10th %</label>
                      <input type="number" step="0.01" value={adminEditForm.studentUpdates.persentage10 || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, persentage10: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">11th %</label>
                      <input type="text" value={adminEditForm.studentUpdates.persentage11 || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, persentage11: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">12th %</label>
                      <input type="number" step="0.01" value={adminEditForm.studentUpdates.persentage12 || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, persentage12: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">JEE Score</label>
                      <input type="number" step="0.01" value={adminEditForm.studentUpdates.jeeScore || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, jeeScore: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Join Batch (Year)</label>
                      <input type="number" value={adminEditForm.studentUpdates.joinBatch || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, joinBatch: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Fees Scheme</label>
                      <input type="text" value={adminEditForm.studentUpdates.feesScheme || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, feesScheme: e.target.value }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Admission Type</label>
                      <select value={adminEditForm.studentUpdates.admissionType || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, admissionType: e.target.value || null }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 cursor-pointer bg-white">
                        <option value="">Full Fees / None</option>
                        <option value="SNS">SNS</option>
                        <option value="SVS">SVS</option>
                        <option value="Shri Ram">Shri Ram</option>
                        <option value="Full Fees">Full Fees</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Form Source</label>
                      <select value={adminEditForm.studentUpdates.formSource || ''}
                        onChange={e => setAdminEditForm({
                          ...adminEditForm,
                          studentUpdates: { ...adminEditForm.studentUpdates, formSource: e.target.value || null }
                        })}
                        className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 cursor-pointer bg-white">
                        <option value="">None</option>
                        <option value="ssism">ssism</option>
                        <option value="btech">btech</option>
                        <option value="manual">manual</option>
                      </select>
                    </div>
                  </div>
                )}

                {editTab === 'reception' && (
                  <div className="space-y-4">
                    {adminEditForm.receptionUpdates.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-gray-50/30">
                        <FiCalendar size={32} className="mx-auto mb-2 opacity-30 text-gray-400" />
                        <p className="text-sm font-medium">Koi visit history nahi mili.</p>
                      </div>
                    ) : (
                      adminEditForm.receptionUpdates.map((entry, idx) => (
                        <div key={entry._id} className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm hover:shadow-md transition-all duration-300 space-y-4 relative">
                          <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                            <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                              <FiCalendar size={13} /> Visit Entry #{idx + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-2.5 py-0.5 rounded-lg border border-gray-100">ID: {entry._id}</span>
                              <button type="button" onClick={() => handleDeleteReception(entry._id, idx)}
                                className="text-xs font-semibold px-2 py-0.5 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg flex items-center gap-1 transition-colors" title="Delete Visit Entry">
                                <FiTrash2 size={11} /> Delete
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date</label>
                              <input type="date" required value={formatDateForInput(entry.date)}
                                onChange={e => {
                                  const list = [...adminEditForm.receptionUpdates];
                                  list[idx].date = e.target.value;
                                  setAdminEditForm({ ...adminEditForm, receptionUpdates: list });
                                }}
                                className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Town</label>
                              <input type="text" required value={entry.town}
                                onChange={e => {
                                  const list = [...adminEditForm.receptionUpdates];
                                  list[idx].town = e.target.value;
                                  setAdminEditForm({ ...adminEditForm, receptionUpdates: list });
                                }}
                                className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Purpose</label>
                              <select value={entry.visitPurpose}
                                onChange={e => {
                                  const list = [...adminEditForm.receptionUpdates];
                                  list[idx].visitPurpose = e.target.value;
                                  setAdminEditForm({ ...adminEditForm, receptionUpdates: list });
                                }}
                                className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 cursor-pointer bg-white">
                                {['Visit', 'Inquiry', 'Interview', 'Re-Interview'].map(p => <option key={p}>{p}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Branch / Course</label>
                              <input type="text" value={entry.branch || ''}
                                onChange={e => {
                                  const list = [...adminEditForm.receptionUpdates];
                                  list[idx].branch = e.target.value;
                                  setAdminEditForm({ ...adminEditForm, receptionUpdates: list });
                                }}
                                className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Admission Form No</label>
                              <input type="text" required value={entry.admissionFormNo}
                                onChange={e => {
                                  const list = [...adminEditForm.receptionUpdates];
                                  list[idx].admissionFormNo = e.target.value;
                                  setAdminEditForm({ ...adminEditForm, receptionUpdates: list });
                                }}
                                className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {editTab === 'interviews' && (
                  <div className="space-y-6">
                    {adminEditForm.interviewUpdates.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-gray-50/30">
                        <FiAward size={32} className="mx-auto mb-2 opacity-30 text-gray-400" />
                        <p className="text-sm font-medium">Koi interview history nahi mili.</p>
                      </div>
                    ) : (
                      adminEditForm.interviewUpdates.map((inv, idx) => (
                        <div key={inv._id} className="border border-primary/20 rounded-2xl p-5 bg-primary/5 hover:bg-primary/10 transition-all duration-300 space-y-5 relative">
                          <div className="flex items-center justify-between border-b border-primary/20 pb-3">
                            <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                              <FiAward size={15} /> Technical Round {inv.round}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-primary/60 font-mono bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20">ID: {inv._id}</span>
                              <button type="button" onClick={() => handleDeleteInterview(inv._id, idx)}
                                className="text-xs font-semibold px-2 py-0.5 text-red-600 hover:text-red-700 bg-white hover:bg-red-50 rounded-lg flex items-center gap-1 border border-red-200 transition-colors" title="Delete Technical Round">
                                <FiTrash2 size={11} /> Delete
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date</label>
                              <input type="date" required value={formatDateForInput(inv.date)}
                                onChange={e => {
                                  const list = [...adminEditForm.interviewUpdates];
                                  list[idx].date = e.target.value;
                                  setAdminEditForm({ ...adminEditForm, interviewUpdates: list });
                                }}
                                className="w-full bg-white border border-gray-200 focus:border-primary rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Interview Type</label>
                              <select value={inv.interviewType || ''}
                                onChange={e => {
                                  const list = [...adminEditForm.interviewUpdates];
                                  list[idx].interviewType = e.target.value || null;
                                  setAdminEditForm({ ...adminEditForm, interviewUpdates: list });
                                }}
                                className="w-full bg-white border border-gray-200 focus:border-primary rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 cursor-pointer">
                                <option value="">Select</option>
                                <option value="Online">Online</option>
                                <option value="On Campus">On Campus</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Result</label>
                              <select value={inv.result}
                                onChange={e => {
                                  const list = [...adminEditForm.interviewUpdates];
                                  list[idx].result = e.target.value;
                                  setAdminEditForm({ ...adminEditForm, interviewUpdates: list });
                                }}
                                className="w-full bg-white border border-gray-200 focus:border-primary rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 cursor-pointer">
                                <option value="Pending">Pending</option>
                                <option value="Pass">Pass</option>
                                <option value="Fail">Fail</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Round No</label>
                              <input type="number" required value={inv.round}
                                onChange={e => {
                                  const list = [...adminEditForm.interviewUpdates];
                                  list[idx].round = Number(e.target.value);
                                  setAdminEditForm({ ...adminEditForm, interviewUpdates: list });
                                }}
                                className="w-full bg-white border border-gray-200 focus:border-primary rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                            </div>
                          </div>

                          {/* Marks breakdown 1-5 */}
                          <div className="space-y-2">
                            <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                              <span>⚡ Round Ratings (1-5)</span>
                            </p>
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 bg-white/50 border border-primary/10 rounded-2xl p-3.5">
                              {[
                                ['Maths', 'mathematicsMarks'],
                                ['Subject', 'subjectiveKnowledge'],
                                ['Reasoning', 'reasoningMarks'],
                                ['Goal', 'goalClarity'],
                                ['Sincerity', 'sincerity'],
                                ['Comm.', 'communicationLevel'],
                                ['Confidence', 'confidenceLevel'],
                                ['Assignment', 'assignmentMarks']
                              ].map(([label, key]) => (
                                <div key={key}>
                                  <label className="block text-[10px] text-gray-500 text-center font-medium truncate mb-1">{label}</label>
                                  <select value={inv[key] !== null ? inv[key] : ''}
                                    onChange={e => {
                                      const list = [...adminEditForm.interviewUpdates];
                                      list[idx][key] = e.target.value !== '' ? Number(e.target.value) : null;
                                      setAdminEditForm({ ...adminEditForm, interviewUpdates: list });
                                    }}
                                    className="w-full border border-gray-200 hover:border-primary/40 focus:border-primary rounded-xl py-1.5 px-2 text-xs text-center focus:outline-none focus:ring-4 focus:ring-primary/10 bg-white cursor-pointer transition-all duration-200">
                                    <option value="">—</option>
                                    {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Remarks</label>
                            <textarea rows={2} value={inv.remarks || ''}
                              onChange={e => {
                                const list = [...adminEditForm.interviewUpdates];
                                list[idx].remarks = e.target.value;
                                setAdminEditForm({ ...adminEditForm, interviewUpdates: list });
                              }}
                              className="w-full bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 resize-none" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {editTab === 'final' && (
                  <div className="space-y-4">
                    {/* Final Interview Card Header with Delete Badge */}
                    <div className="border border-primary/20 rounded-2xl p-5 bg-primary/5 hover:bg-primary/10 transition-all duration-300 space-y-4">
                      <div className="flex items-center justify-between border-b border-primary/20 pb-3">
                        <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                          <FiCheckCircle size={15} /> Final Interview Record
                        </span>
                        {adminEditForm.studentUpdates.finalInterview?.result && (
                          <button type="button" onClick={handleDeleteFinalInterview}
                            className="text-xs font-semibold px-2 py-0.5 text-red-600 hover:text-red-700 bg-white hover:bg-red-50 rounded-lg flex items-center gap-1 border border-red-200 transition-colors" title="Delete Final Interview">
                            <FiTrash2 size={11} /> Delete
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Final Result</label>
                          <select value={adminEditForm.studentUpdates.finalInterview?.result || ''}
                            onChange={e => setAdminEditForm({
                              ...adminEditForm,
                              studentUpdates: {
                                ...adminEditForm.studentUpdates,
                                finalInterview: {
                                  ...adminEditForm.studentUpdates.finalInterview,
                                  result: e.target.value || null
                                }
                              }
                            })}
                            className="w-full bg-white hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 cursor-pointer bg-white">
                            <option value="">No Final Interview / None</option>
                            <option value="Pending">Pending</option>
                            <option value="Pass">Pass</option>
                            <option value="Fail">Fail</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Interview Type</label>
                          <select value={adminEditForm.studentUpdates.finalInterview?.interviewType || ''}
                            onChange={e => setAdminEditForm({
                              ...adminEditForm,
                              studentUpdates: {
                                ...adminEditForm.studentUpdates,
                                finalInterview: {
                                  ...adminEditForm.studentUpdates.finalInterview,
                                  interviewType: e.target.value || null
                                }
                              }
                            })}
                            className="w-full bg-white hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 cursor-pointer bg-white">
                            <option value="">Select</option>
                            <option value="Online">Online</option>
                            <option value="On Campus">On Campus</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Round No</label>
                          <input type="number" value={adminEditForm.studentUpdates.finalInterview?.round || ''}
                            onChange={e => setAdminEditForm({
                              ...adminEditForm,
                              studentUpdates: {
                                ...adminEditForm.studentUpdates,
                                finalInterview: {
                                  ...adminEditForm.studentUpdates.finalInterview,
                                  round: e.target.value !== '' ? Number(e.target.value) : null
                                }
                              }
                            })}
                            className="w-full bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200" />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Final Interview Remarks</label>
                          <textarea rows={3} value={adminEditForm.studentUpdates.finalInterview?.remarks || ''}
                            onChange={e => setAdminEditForm({
                              ...adminEditForm,
                              studentUpdates: {
                                ...adminEditForm.studentUpdates,
                                finalInterview: {
                                  ...adminEditForm.studentUpdates.finalInterview,
                                  remarks: e.target.value
                                }
                              }
                            })}
                            className="w-full bg-white border border-gray-200 focus:border-primary rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 resize-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-5 border-t border-gray-100 shrink-0 bg-white">
                <button type="button" onClick={() => { setAdminEditOpen(false); setAdminEditForm(null); }}
                  className="flex-1 border border-gray-200 text-gray-500 py-3 rounded-2xl text-sm font-semibold hover:bg-gray-50 hover:text-gray-700 active:scale-[0.98] transition-all duration-200">
                  Cancel
                </button>
                <button type="submit" disabled={adminSaving}
                  className="flex-1 bg-primary text-white py-3 rounded-2xl text-sm font-semibold hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none transition-all duration-200">
                  {adminSaving ? 'Saving Changes...' : 'Save All Changes'}
                </button>
              </div>
            </form>
          </div>
        </BottomSheet>
      )}

      {showDeleteConfirm && deleteInfo.details && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col my-auto max-h-[90vh] text-left">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-orange-50/50 to-white">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-primary shrink-0">
                <FiTrash2 size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{deleteInfo.details.title}</h3>
                <p className="text-xs text-gray-500 font-medium">Please review details carefully. This action cannot be undone.</p>
              </div>
            </div>

            {/* Content List */}
            <div className="px-6 py-5 overflow-y-auto space-y-4 flex-1">
              <p className="text-xs text-orange-800 font-semibold bg-orange-50/60 border border-orange-100 rounded-xl p-3.5 italic">
                "{deleteInfo.details.message}"
              </p>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/80 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 font-semibold uppercase tracking-wide">Student</span>
                  <span className="text-gray-800 font-bold">{student.name}</span>
                </div>
                {deleteInfo.details.fields?.map((f, i) => (
                  <div key={i} className="flex justify-between items-center text-xs border-t border-slate-100/60 pt-2.5">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">{f.label}</span>
                    <span className="text-gray-700 font-bold">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteInfo({ type: '', id: '', idx: null, details: {} }); }}
                className="flex-1 border border-slate-200 bg-white text-gray-500 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all duration-200"
              >
                Cancel / Keep
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl text-xs font-bold hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/20 active:scale-95 transition-all duration-200"
              >
                Confirm & Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
