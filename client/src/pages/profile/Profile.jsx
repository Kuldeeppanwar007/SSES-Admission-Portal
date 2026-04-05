import { useState } from 'react';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

const fields = [
  { label: 'Current Password', field: 'currentPassword', showKey: 'current' },
  { label: 'New Password', field: 'newPassword', showKey: 'new' },
  { label: 'Confirm New Password', field: 'confirmPassword', showKey: 'confirm' },
];

export default function Profile() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword)
      return toast.error('New passwords do not match');
    if (form.newPassword.length < 6)
      return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password updated! Please login again.');
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 1500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-800">{user?.name}</p>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <FiLock size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-gray-700">Change Password</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(({ label, field, showKey }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <div className="relative">
                <input
                  type={show[showKey] ? 'text' : 'password'}
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  required
                />
                <button type="button" onClick={() => setShow(s => ({ ...s, [showKey]: !s[showKey] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {show[showKey] ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60">
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
