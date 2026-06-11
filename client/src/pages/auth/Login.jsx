import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import axios from 'axios';
import logo from '../../assets/web/icon-512.png';
import {
  FiEye, FiEyeOff, FiMapPin, FiMail, FiLock,
  FiArrowRight, FiShield, FiUsers, FiTrendingUp, FiRefreshCw,
} from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

async function checkLocationPermission() {
  try {
    if (!Capacitor.isNativePlatform()) return true;
    const status = await Geolocation.checkPermissions();
    return status.location === 'granted';
  } catch { return false; }
}

/* ── Floating label input ── */
function FloatingInput({ id, type, value, onChange, label, icon: Icon, required, maxLength, pattern, extra }) {
  const [focused, setFocused] = useState(false);
  const active = focused || value;
  return (
    <div className="relative group">
      <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 z-10
        ${active ? 'text-orange-500' : 'text-gray-400 group-hover:text-orange-400'}`}>
        <Icon size={16} />
      </div>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        pattern={pattern}
        placeholder=" "
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`peer w-full rounded-xl pl-10 pr-4 pt-6 pb-2 text-sm font-medium text-gray-800 outline-none transition-all duration-200 placeholder-transparent
          ${active
            ? 'bg-orange-50 border-2 border-orange-400 shadow-[0_0_0_3px_rgba(249,115,22,0.10)]'
            : 'bg-gray-50 border-2 border-gray-200 hover:border-orange-300 hover:bg-orange-50/40'
          }`}
        {...extra}
      />
      <label htmlFor={id}
        className={`absolute left-10 pointer-events-none font-medium transition-all duration-200
          ${active ? 'top-2 text-[10px] text-orange-500 uppercase tracking-wide' : 'top-1/2 -translate-y-1/2 text-sm text-gray-400'}`}>
        {label}
      </label>
    </div>
  );
}



export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [loginMethod, setLoginMethod] = useState('password');
  const [otpStep, setOtpStep] = useState('request');
  const [emailForOtp, setEmailForOtp] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [googleClient, setGoogleClient] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [publicStats, setPublicStats] = useState({ total: 0, admitted: 0, admissionRate: 0 });

  const { login, sendOtp, loginWithOtp, loginWithGoogle } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  // Fetch real stats for login page cards
  useEffect(() => {
    const baseURL = import.meta.env.VITE_API_URL || 'https://sses-admission-portal-1.onrender.com/api';
    axios.get(`${baseURL}/students/public-stats`)
      .then(res => setPublicStats(res.data))
      .catch(() => {});
  }, []);

  const STATS = [
    { icon: FiUsers,      label: 'Students Managed', value: publicStats.total > 0 ? publicStats.total.toLocaleString('en-IN') : '—' },
    { icon: FiTrendingUp, label: 'Admission Rate',   value: publicStats.total > 0 ? `${publicStats.admissionRate}% (${publicStats.admitted})` : '—' },
    { icon: FiShield,     label: 'Uptime',           value: '99.9%' },
  ];

  const handleGoogleLogin = async (credentials) => {
    setLoading(true);
    try {
      const data = await loginWithGoogle(credentials);
      if (data.role === 'track_incharge') {
        const granted = await checkLocationPermission();
        if (!granted) { setLocationBlocked(true); setLoading(false); return; }
      }
      toast.success('Welcome back!'); navigate('/dashboard');
    } catch (err) { toast.error(err.response?.data?.message || 'Google sign-in failed.'); }
    finally { setLoading(false); }
  };

  const handleGoogleClick = async () => {
    if (Capacitor.isNativePlatform()) {
      setLoading(true);
      try {
        const user = await GoogleAuth.signIn();
        if (user?.authentication?.idToken) await handleGoogleLogin({ idToken: user.authentication.idToken });
        else toast.error('Google Sign-In failed on mobile.');
      } catch { toast.error('Google login cancelled or failed.'); }
      finally { setLoading(false); }
    } else {
      if (googleClient) googleClient.requestAccessToken();
      else toast.error('Google client is loading, please try again.');
    }
  };

  useEffect(() => {
    const init = () => {
      if (window.google?.accounts?.oauth2) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '582014715224-6vfss07lfrolhgogmpg1kftnoehpo2ub.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          callback: async (r) => { if (r?.access_token) handleGoogleLogin({ accessToken: r.access_token }); },
        });
        setGoogleClient(client);
      } else setTimeout(init, 500);
    };
    init();
  }, []);

  useEffect(() => {
    if (countdown > 0) { const t = setTimeout(() => setCountdown(c => c - 1), 1000); return () => clearTimeout(t); }
  }, [countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const data = await login(form.email, form.password);
      if (data.role === 'track_incharge') {
        const granted = await checkLocationPermission();
        if (!granted) { setLocationBlocked(true); setLoading(false); return; }
      }
      toast.success('Welcome back!'); navigate('/dashboard');
    } catch (err) { toast.error(err.response?.data?.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await sendOtp(emailForOtp);
      toast.success(res.message || 'OTP sent!'); setOtpStep('verify'); setCountdown(60);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send OTP.'); }
    finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return; setLoading(true);
    try {
      const res = await sendOtp(emailForOtp);
      toast.success(res.message || 'Code resent!'); setCountdown(60); setOtpValue('');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to resend.'); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpValue.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      const data = await loginWithOtp(emailForOtp, otpValue);
      if (data.role === 'track_incharge') {
        const granted = await checkLocationPermission();
        if (!granted) { setLocationBlocked(true); setLoading(false); return; }
      }
      toast.success('Verified! Welcome back.'); navigate('/dashboard');
    } catch (err) { toast.error(err.response?.data?.message || 'Invalid or expired OTP'); }
    finally { setLoading(false); }
  };

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 50%, #fef3c7 100%)' }}>

      {/* ── Left Branding Panel ── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[50%] relative flex-col overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #fff7ed 0%, #ffedd5 60%, #fed7aa 100%)' }}>

        {/* Light decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 65%)', top: '-80px', left: '-80px', animation: 'blobFloat1 9s ease-in-out infinite' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.10) 0%, transparent 65%)', bottom: '-60px', right: '-60px', animation: 'blobFloat2 12s ease-in-out infinite' }} />
          <div className="absolute w-[250px] h-[250px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)', top: '40%', left: '60%', animation: 'blobFloat3 15s ease-in-out infinite' }} />
          {/* Dot pattern */}
          <div className="absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.12) 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }} />
        </div>

        {/* Decorative orange ring */}
        <div className="absolute top-16 right-16 w-64 h-64 rounded-full border-[40px] border-orange-200/50 opacity-60"
          style={{ animation: 'blobFloat1 10s ease-in-out infinite' }} />
        <div className="absolute bottom-20 left-10 w-40 h-40 rounded-full border-[28px] border-amber-200/60 opacity-50"
          style={{ animation: 'blobFloat2 13s ease-in-out infinite' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-md shadow-orange-200 flex items-center justify-center overflow-hidden border border-orange-100">
              <img src={logo} alt="SSES" className="h-9 w-9 object-contain" />
            </div>
            <div>
              <p className="text-orange-600 font-black text-xl tracking-tight leading-none">SSES</p>
              <p className="text-orange-400 text-[10px] font-bold uppercase tracking-widest">Admission Portal</p>
            </div>
          </div>

          {/* Hero */}
          <div className="mt-auto mb-10">
            <div className="inline-flex items-center gap-2 bg-orange-100 border border-orange-200 rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-orange-600 text-xs font-bold tracking-wide">Admission Management System</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-black leading-[1.1] tracking-tight mb-4" style={{ color: '#1c1917' }}>
              Manage Every<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400">
                Admission
              </span>{' '}
              Seamlessly.
            </h1>
            <p className="text-orange-800/60 text-base leading-relaxed max-w-sm">
              A centralized platform to track, manage and accelerate student admissions across all tracks and campuses.
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {STATS.map(({ icon: Icon, label, value }) => (
              <div key={label}
                className="rounded-2xl p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(249,115,22,0.15)', backdropFilter: 'blur(8px)' }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: 'linear-gradient(135deg, #fed7aa, #fdba74)' }}>
                  <Icon size={15} className="text-orange-600" />
                </div>
                <p className="font-black text-lg leading-none mb-1 text-gray-800">{value}</p>
                <p className="text-orange-700/60 text-[11px] font-medium leading-tight">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-orange-200/60">
            <p className="text-orange-700/40 text-xs">© 2025 SSES · Sant SIngaji Educational Society. All Rights Reserved</p>
          </div>
        </div>
      </div>

      {/* ── Right Login Panel ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-3 sm:px-5 sm:py-6 relative h-full overflow-hidden">
        {/* Soft bg circles */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(253,186,116,0.18)', transform: 'translate(40%,-40%)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(254,215,170,0.20)', transform: 'translate(-40%,40%)' }} />

        <div className="relative w-full max-w-md transition-all duration-700"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(24px)' }}>

          {/* ── Card ── */}
          <div className="rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10"
            style={{
              background: '#ffffff',
              border: '1.5px solid rgba(249,115,22,0.12)',
              boxShadow: '0 4px 6px -1px rgba(249,115,22,0.06), 0 20px 60px -16px rgba(249,115,22,0.15), 0 2px 4px -1px rgba(0,0,0,0.04)',
            }}>

            {/* Location Blocked */}
            {locationBlocked ? (
              <div className="space-y-5 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
                  <FiMapPin size={26} className="text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 mb-1">Location Required</h2>
                  <p className="text-sm text-gray-500 leading-relaxed">Track Incharge ko location permission zaroori hai.</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-left">
                  <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-2">Steps to Enable:</p>
                  {Capacitor.isNativePlatform() ? (
                    <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
                      <li>Phone Settings → Apps → SSES Portal</li>
                      <li>Permissions → Location → "Allow all the time"</li>
                      <li>Wapas aayein aur neeche button dabayein</li>
                    </ol>
                  ) : (
                    <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
                      <li>Browser address bar mein lock icon click karein</li>
                      <li>Location → Allow select karein</li>
                    </ol>
                  )}
                </div>
                <button
                  onClick={async () => {
                    const granted = await checkLocationPermission();
                    if (granted) navigate('/dashboard');
                    else toast.error('Location abhi bhi off hai.');
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-2xl font-bold text-sm shadow-lg shadow-orange-200 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <FiMapPin size={15} /> Continue
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="mb-4 sm:mb-7">
                  {/* Mobile logo */}
                  <div className="flex lg:hidden items-center gap-2 mb-3 sm:mb-5">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center overflow-hidden">
                      <img src={logo} alt="SSES" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />
                    </div>
                    <span className="text-base sm:text-lg font-black text-orange-500 tracking-tight">SSES</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                    {loginMethod === 'otp' && otpStep === 'verify' ? 'Enter Your Code' : 'Welcome Back 👋'}
                  </h2>
                  <p className="text-gray-400 text-sm mt-1 font-medium">
                    {loginMethod === 'password'
                      ? 'Sign in to your SSES account'
                      : otpStep === 'request'
                        ? 'We\'ll email you a one-time code'
                        : `Code sent to ${emailForOtp}`}
                  </p>
                </div>

                {/* Toggle tabs */}
                {!(loginMethod === 'otp' && otpStep === 'verify') && (
                  <div className="flex gap-1 p-1 rounded-xl mb-3 sm:mb-6"
                    style={{ background: '#fff7ed', border: '1.5px solid #fed7aa' }}>
                    {[
                      { key: 'password', icon: FiLock, label: 'Password' },
                      { key: 'otp',      icon: FiMail, label: 'Email OTP' },
                    ].map(({ key, icon: Icon, label }) => (
                      <button key={key} type="button"
                        onClick={() => { setLoginMethod(key); if (key === 'otp') setOtpStep('request'); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all duration-200
                          ${loginMethod === key
                            ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md shadow-orange-200/60'
                            : 'text-orange-600/60 hover:text-orange-600'}`}
                      >
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Password form ── */}
                {loginMethod === 'password' && (
                  <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                    <FloatingInput id="email" type="email" label="Email Address" icon={FiMail}
                      value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    <div className="relative">
                      <FloatingInput id="password" type={showPassword ? 'text' : 'password'} label="Password" icon={FiLock}
                        value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors z-10">
                        {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 sm:py-3.5 rounded-xl text-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0 mt-1 sm:mt-2"
                      style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)', boxShadow: '0 4px 20px rgba(249,115,22,0.30)' }}>
                      {loading
                        ? <><FiRefreshCw size={14} className="animate-spin" /> Signing In...</>
                        : <>Sign In <FiArrowRight size={14} /></>}
                    </button>
                  </form>
                )}

                {/* ── OTP flow ── */}
                {loginMethod === 'otp' && (
                  <div>
                    {otpStep === 'request' ? (
                      <form onSubmit={handleSendOtp} className="space-y-4">
                        <FloatingInput id="otp-email" type="email" label="Registered Email" icon={FiMail}
                          value={emailForOtp} onChange={(e) => setEmailForOtp(e.target.value)} required />
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                          A 6-digit code will be sent if your email is registered in our system.
                        </p>
                        <button type="submit" disabled={loading}
                          className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 mt-2"
                          style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)', boxShadow: '0 4px 20px rgba(249,115,22,0.30)' }}>
                          {loading
                            ? <><FiRefreshCw size={14} className="animate-spin" /> Sending...</>
                            : <>Send OTP Code <FiArrowRight size={14} /></>}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp} className="space-y-4">
                        {/* Email badge */}
                        <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FiMail size={13} className="text-orange-500 shrink-0" />
                            <p className="text-xs font-semibold text-gray-700 truncate max-w-[190px]">{emailForOtp}</p>
                          </div>
                          <button type="button" onClick={() => { setOtpStep('request'); setOtpValue(''); }}
                            className="text-xs text-orange-500 font-bold hover:text-orange-600 shrink-0 hover:underline">
                            Change
                          </button>
                        </div>

                        {/* OTP box */}
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-2">
                            Enter 6-Digit Code
                          </p>
                          <input
                            type="text" required maxLength={6} pattern="\d{6}" autoFocus
                            value={otpValue}
                            onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-orange-50 border-2 border-orange-300 focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(249,115,22,0.12)] rounded-xl px-4 py-4 text-center text-3xl font-black tracking-[0.6em] outline-none transition-all text-gray-800 placeholder-orange-200"
                            placeholder="000000"
                          />
                        </div>

                        <button type="submit" disabled={loading || otpValue.length !== 6}
                          className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 mt-2"
                          style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)', boxShadow: '0 4px 20px rgba(249,115,22,0.30)' }}>
                          {loading
                            ? <><FiRefreshCw size={14} className="animate-spin" /> Verifying...</>
                            : <>Verify & Sign In <FiArrowRight size={14} /></>}
                        </button>

                        <div className="text-center">
                          {countdown > 0
                            ? <p className="text-xs text-gray-400">Resend in <span className="font-bold text-orange-500">{countdown}s</span></p>
                            : <button type="button" onClick={handleResendOtp} disabled={loading}
                              className="text-xs font-bold text-orange-500 hover:text-orange-600 hover:underline disabled:opacity-50 flex items-center gap-1 mx-auto">
                              <FiRefreshCw size={11} /> Resend Code
                            </button>}
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* ── Divider ── */}
                <div className="relative flex items-center my-3 sm:my-6">
                  <div className="flex-grow border-t border-orange-100" />
                  <span className="flex-shrink mx-4 text-[10px] font-black uppercase tracking-widest text-orange-300 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">
                    or
                  </span>
                  <div className="flex-grow border-t border-orange-100" />
                </div>

                {/* ── Google ── */}
                <button type="button" onClick={handleGoogleClick}
                  className="w-full flex items-center justify-center gap-3 font-semibold py-2.5 sm:py-3 px-4 rounded-xl text-sm text-gray-600 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                  style={{ background: '#fafafa', border: '1.5px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#fed7aa'; e.currentTarget.style.background = '#fff7ed'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fafafa'; }}>
                  <FcGoogle className="text-lg shrink-0" />
                  <span>Continue with Google</span>
                </button>

                {/* Footer note */}
                <p className="text-center text-[11px] text-gray-400 mt-3 sm:mt-5 leading-relaxed">
                  By signing in you agree to{' '}
                  <span className="text-orange-500 font-semibold cursor-pointer hover:underline">Terms</span>
                  {' '}&{' '}
                  <span className="text-orange-500 font-semibold cursor-pointer hover:underline">Privacy Policy</span>
                </p>
              </>
            )}
          </div>

          <p className="hidden sm:block text-center text-[10px] text-orange-400/60 mt-4 font-medium">
            SSES Admission Portal · v2.0
          </p>
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes blobFloat1 {
          0%, 100% { transform: translate(0,0) scale(1); }
          33%       { transform: translate(24px,-32px) scale(1.04); }
          66%       { transform: translate(-16px,16px) scale(0.97); }
        }
        @keyframes blobFloat2 {
          0%, 100% { transform: translate(0,0) scale(1); }
          33%       { transform: translate(-20px,24px) scale(1.06); }
          66%       { transform: translate(16px,-16px) scale(0.96); }
        }
        @keyframes blobFloat3 {
          0%, 100% { transform: translate(-50%,-50%) scale(1); }
          50%       { transform: translate(-50%,-50%) scale(1.18); }
        }
      `}</style>
    </div>
  );
}
