import { create } from 'zustand';
import api from '../api/axios';
import { startLocationTracking, stopLocationTracking } from '../utils/locationTracking';

const API_URL = import.meta.env.VITE_API_URL;

const storedUser = JSON.parse(localStorage.getItem('sses_user') || 'null');
// Resume tracking if already logged in as track_incharge (app reload)
if (storedUser?.role === 'track_incharge' && storedUser?.token)
  startLocationTracking(storedUser.token, storedUser.refreshToken, API_URL);

const useAuthStore = create((set) => ({
  user: storedUser,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('sses_user', JSON.stringify(data));
    set({ user: data });
    if (data.role === 'track_incharge')
      startLocationTracking(data.token, data.refreshToken, API_URL);
    return data;
  },

  logout: async () => {
    stopLocationTracking();
    await api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('sses_user');
    set({ user: null });
  },
}));

export default useAuthStore;
