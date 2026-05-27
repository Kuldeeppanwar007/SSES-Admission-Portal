import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import logo from '../../assets/web/icon-512.png';
import { FiEye, FiEyeOff, FiMapPin, FiMail, FiLock } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

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

  // OTP Login states
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' or 'otp'
  const [otpStep, setOtpStep] = useState('request'); // 'request' or 'verify'
  const [emailForOtp, setEmailForOtp] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [googleClient, setGoogleClient] = useState(null);

  const { login, sendOtp, loginWithOtp, loginWithGoogle } = useAuthStore();
  const navigate = useNavigate();

  // Handle Google OAuth callback
  const handleGoogleLogin = async (credentials) => {
    setLoading(true);
    try {
      const data = await loginWithGoogle(credentials);

      // track_incharge ke liye location check
      if (data.role === 'track_incharge') {
        const granted = await checkLocationPermission();
        if (!granted) {
          setLocationBlocked(true);
          setLoading(false);
          return;
        }
      }

      toast.success('Login successful via Google!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  // Switch between Native Google SDK on Android/iOS and Web Popup Flow on Browser
  const handleGoogleClick = async () => {
    if (Capacitor.isNativePlatform()) {
      setLoading(true);
      try {
        const user = await GoogleAuth.signIn();
        if (user && user.authentication.idToken) {
          await handleGoogleLogin({ idToken: user.authentication.idToken });
        } else {
          toast.error('Google Sign-In failed on mobile.');
        }
      } catch (err) {
        console.error('Mobile Google Login Error:', err);
        toast.error('Google login cancelled or failed.');
      } finally {
        setLoading(false);
      }
    } else {
      if (googleClient) {
        googleClient.requestAccessToken();
      } else {
        toast.error('Google client is loading, please try again.');
      }
    }
  };

  // Initialize Google OAuth Token Client (Implicit Popup Flow)
  useEffect(() => {
    const initGoogleOAuth = () => {
      if (window.google?.accounts?.oauth2) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '582014715224-6vfss07lfrolhgogmpg1kftnoehpo2ub.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          callback: async (tokenResponse) => {
             if (tokenResponse && tokenResponse.access_token) {
               handleGoogleLogin({ accessToken: tokenResponse.access_token });
             }
          },
        });
        setGoogleClient(client);
      } else {
        setTimeout(initGoogleOAuth, 500);
      }
    };

    initGoogleOAuth();
  }, []);

  // Handle resend countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

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

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await sendOtp(emailForOtp);
      toast.success(res.message || 'OTP sent to your registered email address!');
      setOtpStep('verify');
      setCountdown(60); // 60 seconds timer
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      const res = await sendOtp(emailForOtp);
      toast.success(res.message || 'Verification code resent successfully!');
      setCountdown(60);
      setOtpValue('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpValue.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      const data = await loginWithOtp(emailForOtp, otpValue);

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
      toast.error(err.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 w-full max-w-md">
        
        {/* Circular Logo Container from mockup */}
        <div className="w-20 h-20 bg-white rounded-full border border-gray-200 flex items-center justify-center mx-auto mb-3 shadow-sm overflow-hidden">
          <img src={logo} alt="SSES Logo" className="h-full w-full object-cover" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Login</h2>

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
          <div>
            {loginMethod === 'password' ? (
              /* Password Login Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 placeholder-gray-400 text-sm"
                    placeholder="Email"
                  />
                </div>
                <div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 placeholder-gray-400 text-sm"
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg shadow-sm transition-all duration-200 disabled:opacity-60 text-sm"
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>
            ) : (
              /* OTP Login Container */
              <div>
                {otpStep === 'request' ? (
                  /* Step 1: Send OTP Form */
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <input
                        type="email"
                        required
                        value={emailForOtp}
                        onChange={(e) => setEmailForOtp(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 placeholder-gray-400 text-sm"
                        placeholder="Registered Email"
                      />
                      <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                        Verification code will be sent to your registered email if it is active in our database.
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg shadow-sm transition-all duration-200 disabled:opacity-60 text-sm"
                    >
                      {loading ? 'Checking & Sending...' : 'Send OTP Code'}
                    </button>
                  </form>
                ) : (
                  /* Step 2: Verify OTP Form */
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5 text-center">
                      <p className="text-xs text-gray-500 font-medium">OTP Code sent to</p>
                      <p className="text-sm font-bold text-gray-800 break-all my-1">{emailForOtp}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep('request');
                          setOtpValue('');
                        }}
                        className="text-xs text-primary font-bold hover:underline"
                      >
                        ✏️ Change Email
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                        Enter 6-Digit Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        pattern="\d{6}"
                        value={otpValue}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setOtpValue(val);
                        }}
                        className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-[0.75em] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-gray-900 placeholder:text-gray-200"
                        placeholder="000000"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otpValue.length !== 6}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg shadow-sm transition-all duration-200 disabled:opacity-60 text-sm"
                    >
                      {loading ? 'Verifying OTP...' : 'Verify & Login'}
                    </button>

                    <div className="text-center pt-2">
                      {countdown > 0 ? (
                        <p className="text-xs text-gray-500 font-medium">
                          Resend code in <strong className="text-primary font-semibold">{countdown}</strong> seconds
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={loading}
                          className="text-xs font-bold text-primary hover:underline hover:text-primary-dark disabled:opacity-50"
                        >
                          🔄 Resend Verification Code
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Divider 'or' */}
            <div className="relative flex py-5 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Alternative Login buttons from mockup */}
            <div className="space-y-3">
              {loginMethod === 'password' ? (
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('otp');
                    setOtpStep('request');
                  }}
                  className="w-full flex items-center justify-center gap-3 border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all duration-200 text-sm"
                >
                  <FiMail className="text-red-500 text-lg" />
                  <span>Login with Email OTP</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('password');
                  }}
                  className="w-full flex items-center justify-center gap-3 border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all duration-200 text-sm"
                >
                  <FiLock className="text-orange-500 text-lg" />
                  <span>Login with Password</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleGoogleClick}
                className="w-full flex items-center justify-center gap-3 border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all duration-200 text-sm"
              >
                <FcGoogle className="text-lg" />
                <span>Login With Google</span>
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
