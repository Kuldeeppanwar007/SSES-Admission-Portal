import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import logo from '../../assets/web/icon-512.png';
import { FiEye, FiEyeOff, FiMapPin } from 'react-icons/fi';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

async function checkLocationPermission() {
  try {
    if (!Capacitor.isNativePlatform()) return true; // Browser pe block nahi karna
    const status = await Geolocation.checkPermissions();
    return status.location === 'granted';
  } catch {
    return false;
  }
}

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Pehle credentials se role check karo
      const data = await login(form.email, form.password);

      // track_incharge ke liye location check
      if (data.role === 'track_incharge') {
        const granted = await checkLocationPermission();
        if (!granted) {
          setLocationBlocked(true);
          setLoading(false);
          return;
        }
      }

      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="SSES Logo" className="h-16 object-contain mx-auto mb-2" />
          <p className="text-gray-500 text-base font-medium">Admission Portal</p>
        </div>

        {/* Location blocked screen — login ho gaya but location nahi hai */}
        {locationBlocked ? (
          <div className="space-y-4 text-center">
            <div className="text-5xl">📍</div>
            <h2 className="text-lg font-bold text-gray-900">Location Permission Chahiye</h2>
            <p className="text-sm text-gray-500">
              Track Incharge ke liye location permission zaroori hai. Bina location ke app use nahi kar sakte.
            </p>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-left">
              <p className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Steps:</p>
              {Capacitor.isNativePlatform() ? (
                <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Phone Settings → Apps → SSES Portal</li>
                  <li>Permissions → Location</li>
                  <li>"Allow all the time" select karein</li>
                  <li>Wapas aayein aur neeche button dabayein</li>
                </ol>
              ) : (
                <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Browser address bar mein lock icon click karein</li>
                  <li>Location → Allow select karein</li>
                </ol>
              )}
            </div>
            <button
              onClick={async () => {
                const granted = await checkLocationPermission();
                if (granted) { navigate('/dashboard'); }
                else { toast.error('Location abhi bhi off hai. Please allow karein.'); }
              }}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
              <FiMapPin size={16} /> Location On Kar Di — Continue
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary text-gray-900"
                placeholder="Enter your email" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} required value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-primary text-gray-900"
                  placeholder="Enter your password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
