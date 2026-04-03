import { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiMapPin } from 'react-icons/fi';

const emptyForm = { track: '', towns: '' };

export default function TrackManager() {
  const [configs, setConfigs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ track: '', towns: '' });

  const fetchConfigs = () =>
    api.get('/track-config').then(({ data }) => setConfigs(data)).catch(() => toast.error('Failed to load'));

  useEffect(() => { fetchConfigs(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.track.trim()) return;
    setSaving(true);
    try {
      const towns = form.towns.split(',').map(t => t.trim()).filter(Boolean);
      await api.post('/track-config', { track: form.track.trim(), towns });
      toast.success('Track created!');
      setForm(emptyForm);
      fetchConfigs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const startEdit = (cfg) => {
    setEditId(cfg._id);
    setEditForm({ track: cfg.track, towns: cfg.towns.join(', ') });
  };

  const handleEditSave = async (id) => {
    try {
      const towns = editForm.towns.split(',').map(t => t.trim()).filter(Boolean);
      await api.put(`/track-config/${id}`, { track: editForm.track.trim(), towns });
      toast.success('Updated!');
      setEditId(null);
      fetchConfigs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Is track ko delete karo?')) return;
    try {
      await api.delete(`/track-config/${id}`);
      toast.success('Deleted!');
      fetchConfigs();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Track Manager</h2>
        <p className="text-sm text-gray-500 mt-0.5">Tracks aur unke towns manage karo</p>
      </div>

      {/* Add Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FiPlus size={15} className="text-primary" /> Naya Track Add Karo
        </p>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Track Name *</label>
            <input value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })}
              placeholder="e.g. Rehti" required
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Towns (comma separated)</label>
            <input value={form.towns} onChange={(e) => setForm({ ...form, towns: e.target.value })}
              placeholder="e.g. GOPALPUR, BHERUNDA, REHTI"
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 invisible">Save</label>
            <button type="submit" disabled={saving}
              className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors">
              {saving ? 'Saving...' : 'Add Track'}
            </button>
          </div>
        </form>
      </div>

      {/* Track Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {configs.length === 0 && (
          <div className="col-span-4 text-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
            Koi track nahi mila. Upar se add karo.
          </div>
        )}
        {configs.map((cfg) => (
          <div key={cfg._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
              {editId === cfg._id ? (
                <input value={editForm.track}
                  onChange={(e) => setEditForm({ ...editForm, track: e.target.value })}
                  className="border border-primary/40 rounded-lg px-2 py-1 text-sm font-bold text-gray-800 outline-none w-full mr-2" />
              ) : (
                <p className="font-bold text-gray-800 text-sm">{cfg.track}</p>
              )}
              <div className="flex items-center gap-1 shrink-0">
                {editId === cfg._id ? (
                  <>
                    <button onClick={() => handleEditSave(cfg._id)}
                      className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100">
                      <FiCheck size={13} />
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500">
                      <FiX size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(cfg)}
                      className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center text-primary hover:bg-orange-100">
                      <FiEdit2 size={12} />
                    </button>
                    <button onClick={() => handleDelete(cfg._id)}
                      className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 hover:bg-rose-100">
                      <FiTrash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="px-5 py-4">
              {editId === cfg._id ? (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Towns (comma separated)</label>
                  <input value={editForm.towns}
                    onChange={(e) => setEditForm({ ...editForm, towns: e.target.value })}
                    placeholder="TOWN1, TOWN2"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
                </div>
              ) : cfg.towns.length === 0 ? (
                <p className="text-xs text-gray-300 italic">Koi town nahi</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {cfg.towns.map((town) => (
                    <span key={town} className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-primary border border-orange-100">
                      <FiMapPin size={9} /> {town}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
