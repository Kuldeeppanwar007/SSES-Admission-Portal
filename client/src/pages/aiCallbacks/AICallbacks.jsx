import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiPhone, FiClock, FiXCircle, FiPlus, FiRefreshCw, FiUser, FiCalendar, FiCheckCircle } from 'react-icons/fi';
import { agent } from '../../api/agentApi';

const STATUS_COLORS = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const TYPE_COLORS = {
  agent: 'bg-blue-50 text-blue-700 border-blue-200',
  human: 'bg-violet-50 text-violet-700 border-violet-200',
};

function formatIST(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function AICallbacks() {
  const navigate = useNavigate();
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [cancelling, setCancelling] = useState(null);

  // New callback modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ phone: '', name: '', date: '', time: '', notes: '', callback_type: 'agent' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await agent.getCallbacks(statusFilter);
      setCallbacks(data.callbacks || []);
    } catch {
      toast.error('Failed to load callbacks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this callback?')) return;
    setCancelling(id);
    try {
      await agent.cancelCallback(id);
      toast.success('Callback cancelled');
      setCallbacks(prev => prev.filter(c => c.id !== id));
    } catch {
      toast.error('Failed to cancel');
    } finally {
      setCancelling(null);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!form.phone || !form.date || !form.time) {
      toast.error('Phone, date and time are required');
      return;
    }
    setSaving(true);
    try {
      const scheduled_at = new Date(`${form.date}T${form.time}:00+05:30`).toISOString();
      await agent.scheduleCallback(form.phone, form.name, scheduled_at, form.notes, form.callback_type);
      toast.success('Callback scheduled');
      setShowModal(false);
      setForm({ phone: '', name: '', date: '', time: '', notes: '', callback_type: 'agent' });
      if (statusFilter === 'pending') load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">AI Agent Callbacks</h2>
          <p className="text-sm text-gray-500 mt-0.5">Scheduled and completed AI voice call callbacks</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500" title="Refresh">
            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-sm">
            <FiPlus size={15} />
            Schedule Callback
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {['pending', 'completed', 'cancelled'].map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors capitalize ${
              statusFilter === s
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* Callbacks List */}
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : callbacks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FiClock size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No {statusFilter} callbacks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {callbacks.map(cb => (
            <div key={cb.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FiUser size={15} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 leading-tight">{cb.lead_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{cb.lead_phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${TYPE_COLORS[cb.callback_type] || TYPE_COLORS.agent}`}>
                    {cb.callback_type === 'agent' ? '🤖 AI' : '👤 Human'}
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center gap-2 text-gray-600">
                <FiCalendar size={13} className="text-gray-400 shrink-0" />
                <span className="text-xs font-medium">{formatIST(cb.scheduled_at)}</span>
              </div>

              {/* Notes */}
              {cb.notes && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 line-clamp-2">{cb.notes}</p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-50">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_COLORS[cb.status] || STATUS_COLORS.pending}`}>
                  {cb.status}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/students?mobile=${cb.lead_phone}`)}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    <FiPhone size={12} />
                    View
                  </button>
                  {cb.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(cb.id)}
                      disabled={cancelling === cb.id}
                      className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:underline disabled:opacity-50">
                      <FiXCircle size={12} />
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Schedule Callback</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <FiXCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Phone *</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="9876543210"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Student name"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Time (IST) *</label>
                  <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Type</label>
                <select value={form.callback_type} onChange={e => setForm(f => ({ ...f, callback_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors bg-white">
                  <option value="agent">🤖 AI Agent Call</option>
                  <option value="human">👤 Human Callback</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Optional notes..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <FiCheckCircle size={15} />}
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
