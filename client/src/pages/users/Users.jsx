import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { TRACKS, ROLES, MAIN_TRACKS } from '../../utils/constants';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiEdit2, FiEye, FiEyeOff } from 'react-icons/fi';

const emptyForm = { name: '', email: '', password: '', role: 'track_incharge', track: '', isActive: true };

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
    { key: 'track_incharge', label: 'Track Incharge' },
  ];
  const filteredUsers = activeTab === 'all' ? users : users.filter((u) => u.role === activeTab);

  const fetchUsers = () => api.get('/users').then(({ data }) => setUsers(data)).catch(() => toast.error('Failed to load users'));

  useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
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
    try { await api.delete(`/users/${id}`); toast.success('User deleted'); fetchUsers(); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Users</h2>
        <button onClick={() => { setShowForm(true); setForm(emptyForm); setEditId(null); }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark text-sm">
          <FiPlus /> Add User
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h3 className="font-semibold mb-4">{editId ? 'Edit User' : 'Add New User'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[['Name', 'name', 'text'], ['Email', 'email', 'email']].map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}<span className="text-red-500">*</span></label>
                <input type={type} value={form[key]} required
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password{!editId && <span className="text-red-500">*</span>}</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password} required={!editId}
                  placeholder={editId ? 'Leave blank to keep current' : ''}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
                {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            {form.role === 'track_incharge' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Track</label>
                <select value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
                  <option value="">Select Track</option>
                  {MAIN_TRACKS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" id="isActive" checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={loading}
                className="bg-primary text-white px-5 py-2 rounded-lg text-sm hover:bg-primary-dark disabled:opacity-60">
                {loading ? 'Saving...' : editId ? 'Update' : 'Create User'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === t.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {t.key === 'all' ? users.length : users.filter((u) => u.role === t.key).length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((u) => (
          <div key={u._id} className="bg-white rounded-xl shadow p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {u.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">Role</span>
                <span className="capitalize font-medium">{u.role.replace('_', ' ')}</span>
              </div>
              {u.track && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Track</span>
                  <span className="font-medium">{u.track}</span>
                </div>
              )}
              {u.role === 'track_incharge' && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Points</span>
                  <span className="font-semibold text-primary">🏆 {u.points || 0}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1 border-t border-gray-100">
              <button onClick={() => handleEdit(u)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                <FiEdit2 size={13} /> Edit
              </button>
              <button onClick={() => handleDelete(u._id)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors ml-auto">
                <FiTrash2 size={13} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
