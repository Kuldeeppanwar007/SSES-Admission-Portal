import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { FiEye, FiEyeOff, FiMapPin, FiLock, FiMail } from 'react-icons/fi';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

async function checkLocationPermission() {
  try {
    if (!Capacitor.isNativePlatform()) return true;
    const status = await Geolocation.checkPermissions();
    return status.location === 'granted';
  } catch { return false; }
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
      const data = await login(form.email, form.password);
      if (data.role === 'track_incharge') {
        const granted = await checkLocationPermission();
        if (!granted) { setLocationBlocked(true); setLoading(false); return; }
      }
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  const cardStyle = {
    background: 'rgba(17,24,39,0.85)',
    border: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(24px)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-[#0b0f19]"
      style={{
        backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(6,182,212,0.12) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 90%, rgba(59,130,246,0.07) 0%, transparent 50%)',
      }}>

      {/* Decorative grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))', boxShadow: '0 0 32px var(--color-primary-glow)' }}>
            <span className="text-white text-2xl font-black">S</span>
          </div>
          <h1 className="text-2xl font-bold text-[#f3f4f6]">SSES Portal</h1>
          <p className="text-sm text-[#6b7280] mt-1">Admission Management System</p>
        </div>

        <div className="rounded-2xl p-8" style={cardStyle}>
          {locationBlocked ? (
            <div className="space-y-5 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <FiMapPin size={24} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#f3f4f6]">Location Required</h2>
                <p className="text-sm text-[#6b7280] mt-1">Track Incharge requires location permission to continue.</p>
              </div>
              <div className="rounded-xl p-4 text-left" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wide mb-2">Steps:</p>
                {Capacitor.isNativePlatform() ? (
                  <ol className="text-xs text-[#9ca3af] space-y-1 list-decimal list-inside">
                    <li>Phone Settings → Apps → SSES Portal</li>
                    <li>Permissions → Location</li>
                    <li>"Allow all the time" select karein</li>
                    <li>Wapas aayein aur neeche button dabayein</li>
                  </ol>
                ) : (
                  <ol className="text-xs text-[#9ca3af] space-y-1 list-decimal list-inside">
                    <li>Browser address bar mein lock icon click karein</li>
                    <li>Location → Allow select karein</li>
                  </ol>
                )}
              </div>
              <button
                onClick={async () => {
                  const granted = await checkLocationPermission();
                  if (granted) navigate('/dashboard');
                  else toast.error('Location abhi bhi off hai. Please allow karein.');
                }}
                className="hud-btn-primary w-full"
              >
                <FiMapPin size={15} /> Location On Kar Di — Continue
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-[#f3f4f6]">Welcome back</h2>
                <p className="text-sm text-[#6b7280]">Sign in to your account</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Email</label>
                <div className="relative">
                  <FiMail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" />
                  <input
                    type="email" required value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="hud-input pl-10"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Password</label>
                <div className="relative">
                  <FiLock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" />
                  <input
                    type={showPassword ? 'text' : 'password'} required value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="hud-input pl-10 pr-10"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#9ca3af] transition-colors">
                    {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="hud-btn-primary w-full mt-2 py-3">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-[#4b5563] mt-6">
          SSES Admission Portal &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
