import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { agent } from '../../api/agentApi';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  FiArrowLeft, FiEdit2, FiPhone, FiClock, FiSend, FiUser,
  FiBook, FiAlertCircle, FiXCircle, FiVolume2
} from 'react-icons/fi';

export default function StudentCalling() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [agentData, setAgentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [schedNotes, setSchedNotes] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [waText, setWaText] = useState('');
  const [sendingWa, setSendingWa] = useState(false);
  const [expandedTx, setExpandedTx] = useState({});

  // Mark DNC Confirmation state
  const [showDNCConfirm, setShowDNCConfirm] = useState(false);
  const [updatingDNC, setUpdatingDNC] = useState(false);

  const fetchStudentAndHistory = useCallback(async () => {
    try {
      // 1. Fetch student info
      const studentRes = await api.get(`/students/${id}`);
      setStudent(studentRes.data);

      // 2. Fetch agent history if mobileNo is available
      const phone = studentRes.data?.mobileNo || studentRes.data?.mobile;
      if (phone) {
        const historyData = await agent.getHistory(phone);
        setAgentData(historyData);
      }
    } catch (err) {
      console.error('Error fetching calling view data:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStudentAndHistory();
  }, [fetchStudentAndHistory]);

  const handleCall = async () => {
    const phone = student?.mobileNo || student?.mobile;
    if (!phone) {
      toast.error('Phone number not available');
      return;
    }
    setCalling(true);
    try {
      await agent.triggerCall(phone, student.name);
      toast.success('AI call initiated!');
      setTimeout(fetchStudentAndHistory, 3000);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Call failed');
    } finally {
      setCalling(false);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    const phone = student?.mobileNo || student?.mobile;
    if (!phone) {
      toast.error('Phone number not available');
      return;
    }
    if (!schedDate || !schedTime) return;
    setScheduling(true);
    try {
      const iso = new Date(`${schedDate}T${schedTime}:00+05:30`).toISOString();
      await agent.scheduleCallback(phone, student.name, iso, schedNotes, 'agent');
      toast.success('Callback scheduled!');
      setShowSchedule(false);
      setSchedDate(''); setSchedTime(''); setSchedNotes('');
      fetchStudentAndHistory();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to schedule');
    } finally {
      setScheduling(false);
    }
  };

  const handleSendWa = async () => {
    const phone = student?.mobileNo || student?.mobile;
    if (!phone) {
      toast.error('Phone number not available');
      return;
    }
    if (!waText.trim()) return;
    setSendingWa(true);
    try {
      await agent.sendWhatsApp(phone, waText.trim());
      toast.success('WhatsApp message sent!');
      setWaText('');
      setTimeout(fetchStudentAndHistory, 2000);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to send');
    } finally {
      setSendingWa(false);
    }
  };

  // Mark Do Not Call handler
  const handleMarkDNC = async () => {
    setUpdatingDNC(true);
    try {
      // Update student status to Calling and funnel stage to Not Interested in our DB
      await api.put(`/students/${id}`, {
        status: 'Calling',
        funnelStage: 'Not Interested',
        remarks: 'Marked as Do Not Call from dashboard.'
      });
      toast.success('Student marked as Not Interested / Do Not Call!');
      setShowDNCConfirm(false);
      fetchStudentAndHistory();
    } catch (err) {
      console.error('Error marking DNC:', err);
      toast.error('Failed to update DNC status');
    } finally {
      setUpdatingDNC(false);
    }
  };

  const STATUS_BADGE = {
    interested: 'bg-green-100 text-green-700 border-green-200',
    not_interested: 'bg-red-100 text-red-700 border-red-200',
    callback_scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
    not_answered: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    calling: 'bg-orange-100 text-orange-700 border-orange-200',
    converted: 'bg-purple-100 text-purple-700 border-purple-200',
    pending: 'bg-gray-100 text-gray-600 border-gray-200',
    failed: 'bg-red-50 text-red-500 border-red-200',
  };

  const lead = agentData?.lead;
  const convs = agentData?.conversations ?? [];
  const cbs = (agentData?.callbacks ?? []).filter(c => c.status === 'pending');

  const fmtTime = (iso) => iso
    ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
    : null;

  const fmtDur = (s) => s ? (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`) : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-115px)] md:h-[calc(100vh-130px)] overflow-hidden px-2 pb-1">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
        <button onClick={() => navigate(`/students/${id}`)}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm shrink-0">
          <FiArrowLeft size={16} /> Back
        </button>
        <h2 className="text-lg font-bold text-gray-800">Calling View</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch flex-1 min-h-0 overflow-hidden">
        {/* ==================== LEFT COLUMN: Student Profile & Controls ==================== */}
        <div className="md:col-span-5 h-full overflow-y-auto space-y-4 pr-1.5 pb-2">

          {/* 1. Student Card */}
          <div className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden p-5 relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-800 tracking-tight leading-tight">{student.name}</h1>
                <p className="text-sm font-semibold text-primary mt-1 flex items-center gap-1">
                  {student.mobileNo || student.mobile}
                </p>
                {student.trackName || student.track ? (
                  <p className="text-xs text-gray-400 font-semibold mt-0.5">{student.trackName || student.track}</p>
                ) : null}
              </div>

              {/* Status Badge */}
              <div className="flex flex-col items-end gap-1">
                {lead?.status && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[lead.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {lead.status === 'interested' ? '✓ ' : ''}{lead.status.replace(/_/g, ' ')}
                  </span>
                )}
                {student.status && (
                  <span className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                    {student.status}
                  </span>
                )}
              </div>
            </div>

            {/* Course Badge */}
            {student.subject && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-orange-50 text-primary text-xs font-bold uppercase tracking-wider mb-4 border border-orange-100">
                <FiBook size={12} /> {student.subject}
              </div>
            )}

            {/* Address */}
            {student.fullAddress && (
              <p className="text-xs text-gray-500 leading-relaxed font-medium bg-gray-50 p-3 rounded-xl border border-gray-100/50 mb-4">
                📍 {student.fullAddress}
              </p>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2 text-center pt-4 border-t border-gray-100">
              {[
                { label: 'Calls', value: lead?.call_count ?? 0 },
                { label: 'WhatsApp', value: lead?.whatsapp_count ?? 0 },
                { label: 'Callbacks', value: lead?.pending_callbacks ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl py-2">
                  <p className="text-base font-bold text-gray-800 leading-none">{value}</p>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {lead?.last_call_at && (
              <p className="text-[10px] text-gray-400 text-center font-semibold mt-3">
                Last call: {fmtTime(lead.last_call_at)}
              </p>
            )}
          </div>

          {/* 2. Action Controls */}
          <div className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Trigger Call (Primary Action) */}
              <button onClick={handleCall} disabled={calling || !(student?.mobileNo || student?.mobile)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-50 active:scale-95 transition-all duration-200 shadow-sm shadow-primary/20 hover:shadow-md">
                {calling ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <FiPhone size={14} />
                )}
                <span>{calling ? 'Calling…' : 'Trigger Call'}</span>
              </button>

              {/* Edit Student */}
              <button onClick={() => navigate(`/students/${id}/edit`)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all duration-200 bg-white">
                <FiEdit2 size={13} /> Edit Student
              </button>

              {/* Schedule Callback */}
              <button onClick={() => setShowSchedule(s => !s)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold active:scale-95 transition-all duration-200 ${showSchedule
                    ? 'border-primary bg-orange-50/50 text-primary'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}>
                <FiClock size={13} /> Schedule Callback
              </button>
            </div>

            {/* Schedule Callback Form */}
            {showSchedule && (
              <form onSubmit={handleSchedule} className="flex flex-col gap-2 p-3 bg-orange-50/40 rounded-xl border border-orange-100 animate-in fade-in duration-200">
                <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} required
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
                <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} required
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
                <input type="text" value={schedNotes} onChange={e => setSchedNotes(e.target.value)} placeholder="Notes (optional)"
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
                <div className="flex gap-2">
                  <button type="submit" disabled={scheduling}
                    className="flex-1 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold disabled:opacity-50 active:scale-95 transition-all duration-200 shadow-sm shadow-primary/10">
                    {scheduling ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setShowSchedule(false)}
                    className="flex-1 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-500 active:scale-95 transition-all duration-200">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Pending Callback Pills */}
            {cbs.length > 0 && (
              <div className="flex flex-col gap-1">
                {cbs.map(cb => (
                  <div key={cb.id} className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-orange-50/80 text-primary border border-orange-100/70 shadow-sm">
                    <FiClock size={9} className="shrink-0" />
                    <span className="truncate">{fmtTime(cb.scheduled_at)}{cb.notes ? ` · ${cb.notes}` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Riya's Memory Card */}
          <div className="bg-orange-50/30 rounded-2xl p-5 border border-orange-100 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Riya's Memory</p>
              {lead?.last_call_at && (
                <span className="text-[9px] text-gray-400">{fmtTime(lead.last_call_at)}</span>
              )}
            </div>
            {lead?.status && (
              <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-md bg-green-100 text-green-700 border border-green-200 uppercase tracking-wide">
                Last Intent: {lead.status.replace(/_/g, ' ')}
              </span>
            )}
            {lead?.memory_summary ? (
              <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-line font-medium">{lead.memory_summary}</p>
            ) : (
              <p className="text-[11px] text-gray-400 italic font-medium">
                No active call memory summary generated yet. Start an outbound call to see Riya's AI extracted memory notes here!
              </p>
            )}
          </div>

          {/* 4. Academic & Profile Details Card */}
          <div className="rounded-2xl border border-gray-100 shadow-sm bg-white p-5 space-y-3.5">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Academic & Profile Details</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100/50">
                <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Course Interest</p>
                <p className="font-bold text-gray-800">
                  {student.branch
                    ? (student.subject ? `${student.branch} (${student.subject})` : student.branch)
                    : (student.subject || student.course || 'Not Specified')}
                </p>
              </div>
              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100/50">
                <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Admission Type</p>
                <p className="font-bold text-gray-800">{student.admissionType || student.feesScheme || 'Not Specified'}</p>
              </div>
              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100/50">
                <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Father's Name</p>
                <p className="font-bold text-gray-800 truncate">{student.fatherName || 'Not Specified'}</p>
              </div>
              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100/50">
                <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Current Status</p>
                <span className="inline-block font-bold text-primary mt-0.5">{student.status || 'Active'}</span>
              </div>
              {student.schoolName && (
                <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100/50 col-span-2">
                  <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Previous Education (School)</p>
                  <p className="font-bold text-gray-800 truncate">{student.schoolName}</p>
                </div>
              )}
            </div>
          </div>

          {/* 5. AI Outbound Guideline Card */}
          <div className="rounded-2xl border border-orange-100 bg-orange-50/20 p-5 space-y-3">
            <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
              💡 Outbound Calling Guide
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-100 text-primary flex items-center justify-center shrink-0 font-bold text-[10px]">1</span>
                <div>
                  <p className="font-bold text-gray-800">Warm Greeting (Namaste)</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">"Namaste {student.name.split(' ')[0]} ji, main SSISM College se baat kar raha hoon..."</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-100 text-primary flex items-center justify-center shrink-0 font-bold text-[10px]">2</span>
                <div>
                  <p className="font-bold text-gray-800">Verify Interest</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Student se unke selected course interest (<strong>{student.subject || 'selected subject'}</strong>) ko re-verify karein.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Send WhatsApp Card (Commented out as per user request)
          <div className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden p-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Send WhatsApp</p>
            <div className="flex gap-2">
              <textarea value={waText} onChange={e => setWaText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendWa(); } }}
                rows={2} placeholder="Type message..."
                className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-white text-gray-800" />
              <button onClick={handleSendWa} disabled={sendingWa || !waText.trim()}
                className="w-9 h-9 self-end rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0">
                {sendingWa
                  ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <FiSend size={13} />}
              </button>
            </div>
          </div>
          */}

        </div>

        {/* ==================== RIGHT COLUMN: Conversation History ==================== */}
        <div className="md:col-span-7 flex flex-col h-full overflow-hidden">
          <div className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden flex flex-col flex-1 h-full">

            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Conversation History ({convs.length})
              </p>
            </div>

            <div className="p-4 overflow-y-auto bg-gray-50/65 space-y-3 flex-1">
              {convs.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100/50 shadow-sm">
                  <FiPhone size={28} className="mx-auto mb-2 opacity-35" />
                  <p className="text-xs font-medium">No AI calls or WhatsApp messages logged yet</p>
                </div>
              ) : (
                convs.map(c => {
                  const isPhone = c.channel === 'phone';
                  const txOpen = expandedTx[c.id];
                  return (
                    <div key={c.id} className="bg-white rounded-2xl border border-gray-100/80 shadow-sm p-5 md:p-6 hover:shadow-md hover:border-gray-200 transition-all duration-200">

                      {/* Row: channel icon + type + direction + timestamp */}
                      <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${isPhone ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                            {isPhone ? '📞' : '💬'}
                          </span>
                          <span className="text-xs font-bold text-gray-700">
                            {isPhone ? 'Phone Call' : 'WhatsApp'} · <span className="capitalize text-gray-500 font-semibold">{c.direction}</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">{fmtTime(c.created_at)}</span>
                      </div>

                      {/* Intent badge & messages */}
                      {(c.intent || c.message) && (
                        <div className="mb-3 space-y-1.5">
                          {c.intent && (
                            <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 uppercase tracking-wide">
                              Intent: {c.intent}
                            </span>
                          )}
                          {c.message && (
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line font-medium bg-gray-50/50 p-4 rounded-xl border border-gray-100/30">
                              {c.message}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Outcomes & details */}
                      <div className="flex items-center gap-3 flex-wrap mb-3">
                        {c.outcome && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-primary border border-orange-100/50">
                            Outcome: {c.outcome.replace(/_/g, ' ')}
                          </span>
                        )}
                        {c.duration && (
                          <span className="text-[10px] text-gray-400 font-semibold">Duration: {fmtDur(c.duration)}</span>
                        )}
                      </div>

                      {/* Call Summary */}
                      {c.summary && (
                        <div className="bg-orange-50/10 rounded-xl p-5 border border-orange-100/30 mb-3 shadow-inner">
                          <p className="text-[9px] font-bold text-primary uppercase tracking-wide mb-2">AI Call Summary</p>
                          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line font-medium">{c.summary}</p>
                        </div>
                      )}

                      {/* Call Action buttons (Listen & Transcript) */}
                      <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-gray-50">
                        {c.recording_url && (
                          <a href={c.recording_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                            🎧 Listen to recording
                          </a>
                        )}
                        {c.transcript && (
                          <button onClick={() => setExpandedTx(p => ({ ...p, [c.id]: !p[c.id] }))}
                            className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1">
                            {txOpen ? '▲ Hide transcript' : '▾ Show transcript'}
                          </button>
                        )}
                      </div>

                      {/* Scrollable full transcript window */}
                      {txOpen && c.transcript && (
                        <div className="mt-3 bg-slate-900 text-slate-200 rounded-xl p-3.5 text-xs leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto font-mono border border-slate-800 shadow-inner">
                          {c.transcript}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ==================== DNC CONFIRMATION MODAL (Commented Out) ====================
      {showDNCConfirm && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white border border-gray-100 rounded-3xl max-w-md w-full p-6 text-left shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                <FiAlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Mark Do Not Call?</h3>
                <p className="text-xs text-gray-500 font-semibold">Confirm setting status to Not Interested</p>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 leading-relaxed mb-6">
              Setting student status to <strong>Do Not Call</strong> will automatically mark this candidate's funnel stage as <span className="text-red-600 font-bold">Not Interested</span> in our system. Are you sure you want to proceed?
            </p>

            <div className="flex gap-3">
              <button onClick={() => setShowDNCConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors bg-transparent">
                Cancel
              </button>
              <button onClick={handleMarkDNC} disabled={updatingDNC}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors shadow-lg shadow-red-600/10">
                {updatingDNC ? 'Updating…' : 'Mark DNC'}
              </button>
            </div>
          </div>
        </div>
      )}
      */}
    </div>
  );
}
