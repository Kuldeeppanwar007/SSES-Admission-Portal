import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { TRACKS, ROLES, MAIN_TRACKS } from '../../utils/constants';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiEdit2, FiEye, FiEyeOff } from 'react-icons/fi';
import BottomSheet from '../../components/BottomSheet';

const emptyForm = { name: '', email: '', password: '', role: 'track_incharge', track: '', isActive: true };

const ROLE_COLORS = {
  admin:         { bg: 'rgba(139,92,246,0.12)', text: '#a78bfa', border: 'rgba(139,92,246,0.25)' },
  manager:       { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.25)' },
  track_incharge:{ bg: 'rgba(6,182,212,0.12)',  text: '#22d3ee', border: 'rgba(6,182,212,0.25)'  },
  interviewer:   { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  receptionist:  { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'admin', label: 'Admin' },
    { key: 'manager', label: 'Manager' },
    { key: 'track_incharge', label: 'Track' },
    { key: 'interviewer', label: 'Interviewer' },
    { key: 'receptionist', label: 'Reception' },
  ];
  const filteredUsers = activeTab === 'all' ? users : users.filter(u => u.role === activeTab);

  const fetchUsers = () => api.get('/users').then(({ data }) => setUsers(data)).catch(() => toast.error('Failed'));
  useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (editId) await api.put(`/users/${editId}`, form);
      else await api.post('/users', form);
      toast.success(`User ${editId ? 'updated' : 'created'}`);
      setShowForm(false); setForm(emptyForm); setEditId(null);
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleEdit = (u) => {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, track: u.track || '', isActive: u.isActive });
    setEditId(u._id); setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try { await api.delete(`/users/${id}`); toast.success('Deleted'); fetchUsers(); }
    catch { toast.error('Delete failed'); }
  };

  const inputCls = "w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#f3f4f6]">Users</h2>
          <p className="text-sm text-[#6b7280] mt-0.5">{users.length} total users</p>
        </div>
        <button onClick={() => { setShowForm(true); setForm(emptyForm); setEditId(null); }}
          className="hud-btn-primary">
          <FiPlus size={15} /> Add User
        </button>
      </div>

      {/* Form Modal */}
      <BottomSheet open={showForm} onClose={() => { setShowForm(false); setEditId(null); }}
        title={editId ? 'Edit User' : 'Add New User'} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {[['Name', 'name', 'text'], ['Email', 'email', 'email']].map(([label, key, type]) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-[#9ca3af] uppercase tracking-wide mb-1.5">
                {label} <span className="text-red-400">*</span>
              </label>
              <input type={type} value={form[key]} required
                onChange={e => setForm({ ...form, [key]: e.target.value })}
                className={inputCls} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-[#9ca3af] uppercase tracking-wide mb-1.5">
              Password {!editId && <span className="text-red-400">*</span>}
            </label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={form.password} required={!editId}
                placeholder={editId ? 'Leave blank to keep' : ''}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className={`${inputCls} pr-10`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#9ca3af]">
                {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9ca3af] uppercase tracking-wide mb-1.5">Role</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputCls}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          {(form.role === 'track_incharge' || form.role === 'interviewer') && (
            <div>
              <label className="block text-xs font-semibold text-[#9ca3af] uppercase tracking-wide mb-1.5">
                Track <span className="text-red-400">*</span>
              </label>
              <select value={form.track} required onChange={e => setForm({ ...form, track: e.target.value })} className={inputCls}>
                <option value="">Select Track</option>
                {MAIN_TRACKS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <input type="checkbox" id="isActive" checked={form.isActive}
              onChange={e => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded" />
            <label htmlFor="isActive" className="text-sm text-[#d1d5db]">Active</label>
          </div>
          <div className="sm:col-span-2 mt-2">
            <button type="submit" disabled={loading} className="hud-btn-primary w-full py-3">
              {loading ? 'Saving...' : editId ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {tabs.map(t => {
          const count = t.key === 'all' ? users.length : users.filter(u => u.role === t.key).length;
          const isActive = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
              style={{
                background: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? 'white' : '#9ca3af',
                boxShadow: isActive ? '0 0 12px var(--color-primary-glow)' : 'none',
              }}>
              {t.label}
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)' }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* User Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(u => {
          const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.admin;
          return (
            <div key={u._id} className="hud-card hud-card-lift p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
                    style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))', boxShadow: '0 0 12px var(--color-primary-glow)' }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#f3f4f6] truncate">{u.name}</p>
                    <p className="text-xs text-[#6b7280] truncate">{u.email}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                  style={{ background: u.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: u.isActive ? '#34d399' : '#f87171', border: `1px solid ${u.isActive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-[#6b7280]">Role</span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                    style={{ background: roleStyle.bg, color: roleStyle.text, border: `1px solid ${roleStyle.border}` }}>
                    {u.role.replace('_', ' ')}
                  </span>
                </div>
                {u.track && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#6b7280]">Track</span>
                    <span className="text-[#d1d5db] font-medium">{u.track}</span>
                  </div>
                )}
                {u.role === 'track_incharge' && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#6b7280]">Points</span>
                    <span className="font-bold" style={{ color: 'var(--color-primary)' }}>🏆 {u.points || 0}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <button onClick={() => handleEdit(u)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <FiEdit2 size={12} /> Edit
                </button>
                <button onClick={() => handleDelete(u._id)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ml-auto"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <FiTrash2 size={12} /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
