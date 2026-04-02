import { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { TRACKS, MAIN_TRACKS, TRACK_TOWNS } from '../../utils/constants';
import { FiEdit2, FiCheck, FiX, FiTarget } from 'react-icons/fi';

const SUBJECTS = ['B.Tech', 'BCA', 'BBA', 'Bcom', 'Bio', 'Micro'];

const SUBJECT_COLORS = {
  'B.Tech': 'bg-blue-100 text-blue-700',
  'BCA':    'bg-violet-100 text-violet-700',
  'BBA':    'bg-amber-100 text-amber-700',
  'Bcom':   'bg-emerald-100 text-emerald-700',
  'Bio':    'bg-rose-100 text-rose-700',
  'Micro':  'bg-cyan-100 text-cyan-700',
};

export default function Targets() {
  const [targets, setTargets] = useState([]);
  const [form, setForm] = useState({ track: 'all', subject: SUBJECTS[0], target: '' });
  const [saving, setSaving] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState('');
  const [editCell, setEditCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  const fetchTargets = () =>
    api.get('/targets').then(({ data }) => setTargets(data)).catch(() => toast.error('Failed to load targets'));

  useEffect(() => { fetchTargets(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tracksToSet = form.track === 'all' ? MAIN_TRACKS : [form.track];
      await Promise.all(tracksToSet.map((track) =>
        api.post('/targets', { track, subject: form.subject, target: Number(form.target) })
      ));
      toast.success(`Target set for ${form.track === 'all' ? 'all tracks' : form.track}!`);
      fetchTargets();
      setForm({ ...form, target: '' });
    } catch { toast.error('Failed to save target'); }
    finally { setSaving(false); }
  };

  const handleEditSave = async (track, subject) => {
    try {
      await api.post('/targets', { track, subject, target: Number(editValue) });
      toast.success('Updated!');
      setEditCell(null);
      fetchTargets();
    } catch { toast.error('Failed to update'); }
  };

  const grouped = targets.reduce((acc, t) => {
    if (!acc[t.track]) acc[t.track] = [];
    acc[t.track].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Targets</h2>
        <p className="text-sm text-gray-500 mt-0.5">Set and manage admission targets per track</p>
      </div>

      {/* Set Target Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
            <FiTarget size={16} className="text-primary" />
          </div>
          <p className="text-sm font-bold text-gray-800">Set Target</p>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Track</label>
            <select value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition">
              <option value="all">All Tracks</option>
              {MAIN_TRACKS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Subject</label>
            <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition">
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Target</label>
            <input type="number" min="0" value={form.target} required
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              placeholder="e.g. 50"
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 invisible">Save</label>
            <button type="submit" disabled={saving}
              className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors shadow-sm shadow-orange-200">
              {saving ? 'Saving...' : 'Save Target'}
            </button>
          </div>
        </form>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter by Track:</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSelectedTrack('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!selectedTrack ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            All
          </button>
          {MAIN_TRACKS.map((t) => (
            <button key={t} onClick={() => setSelectedTrack(t === selectedTrack ? '' : t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selectedTrack === t ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Track Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {(selectedTrack ? [selectedTrack] : MAIN_TRACKS).map((track) => {
          const items = grouped[track] || [];
          const totalTarget = items.reduce((s, i) => s + i.target, 0);
          const towns = TRACK_TOWNS[track] || [];
          return (
            <div key={track} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Card Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-gray-800 text-sm">{track}</p>
                  <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                    <FiTarget size={15} className="text-primary" />
                  </div>
                </div>
                {/* Towns */}
                <div className="flex flex-wrap gap-1 mb-1">
                  {towns.map((town) => (
                    <span key={town} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-primary border border-orange-100">
                      {town}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400">Total target: <span className="font-semibold text-gray-600">{totalTarget}</span></p>
              </div>

              {/* Subject rows */}
              <div className="divide-y divide-gray-50">
                {SUBJECTS.map((subject) => {
                  const found = items.find((i) => i.subject === subject);
                  const isEditing = editCell?.track === track && editCell?.subject === subject;
                  return (
                    <div key={subject} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/70 transition-colors group">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SUBJECT_COLORS[subject] || 'bg-gray-100 text-gray-600'}`}>
                          {subject}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <input type="number" min="0" value={editValue} autoFocus
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(track, subject); if (e.key === 'Escape') setEditCell(null); }}
                              className="w-16 border border-primary/40 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
                            <button onClick={() => handleEditSave(track, subject)} className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition">
                              <FiCheck size={12} />
                            </button>
                            <button onClick={() => setEditCell(null)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition">
                              <FiX size={12} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className={`text-sm font-bold tabular-nums ${found ? 'text-gray-800' : 'text-gray-300'}`}>
                              {found ? found.target : '—'}
                            </span>
                            <button onClick={() => { setEditCell({ track, subject }); setEditValue(found?.target ?? ''); }}
                              className="w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 bg-orange-50 flex items-center justify-center text-primary hover:bg-orange-100 transition-all">
                              <FiEdit2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
