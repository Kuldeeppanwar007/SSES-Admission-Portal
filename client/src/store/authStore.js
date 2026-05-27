import { create } from 'zustand';
import api from '../api/axios';
import { startLocationTracking, stopLocationTracking } from '../utils/locationTracking';
import { applyTheme } from '../hooks/useTheme';

const API_URL = import.meta.env.VITE_API_URL || 'https://sses-admission-portal.onrender.com/api';

const storedUser = JSON.parse(localStorage.getItem('sses_user') || 'null');
// Apply saved theme immediately on app load
applyTheme(localStorage.getItem('theme') || 'orange');
// Resume tracking if already logged in as track_incharge (app reload)
if (storedUser?.role === 'track_incharge' && storedUser?.token)
  startLocationTracking(storedUser.token, storedUser.refreshToken, API_URL);

const useAuthStore = create((set) => ({
  user: storedUser,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('sses_user', JSON.stringify(data));
    set({ user: data });
    // Fetch & apply this user's saved theme from DB
    api.get('/users/me/theme').then(({ data: t }) => {
      localStorage.setItem('theme', t.theme);
      applyTheme(t.theme);
    }).catch(() => {});
    if (data.role === 'track_incharge')
      startLocationTracking(data.token, data.refreshToken, API_URL);
    return data;
  },

  sendOtp: async (email) => {
    const { data } = await api.post('/auth/send-otp', { email });
    return data;
  },

  loginWithOtp: async (email, otp) => {
    const { data } = await api.post('/auth/login-otp', { email, otp });
    localStorage.setItem('sses_user', JSON.stringify(data));
    set({ user: data });
    // Fetch & apply this user's saved theme from DB
    api.get('/users/me/theme').then(({ data: t }) => {
      localStorage.setItem('theme', t.theme);
      applyTheme(t.theme);
    }).catch(() => {});
    if (data.role === 'track_incharge')
      startLocationTracking(data.token, data.refreshToken, API_URL);
    return data;
  },

  logout: async () => {
    stopLocationTracking();
    await api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('sses_user');
    localStorage.removeItem('theme');
    set({ user: null });
    window.location.href = '/login';
  },
}));

export default useAuthStore;
