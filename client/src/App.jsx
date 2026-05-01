import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { setupOfflineSync } from './utils/offlineQueue';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import PermissionGate from './components/PermissionGate';
import LocationBlocker from './components/LocationBlocker';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import TrackDashboard from './pages/dashboard/TrackDashboard';
import AdminTrackDashboard from './pages/dashboard/AdminTrackDashboard';
import Students from './pages/students/Students';
import StudentForm from './pages/students/StudentForm';
import StudentDetail from './pages/students/StudentDetail';
import Users from './pages/users/Users';
import Targets from './pages/targets/Targets';
import Attendance from './pages/attendance/Attendance';
import EditRequests from './pages/students/EditRequests';
import TrackManager from './pages/settings/TrackManager';
import ActivityLog from './pages/activity/ActivityLog';
import Profile from './pages/profile/Profile';

const CURRENT_APP_VERSION = 3; // Har naye build pe yeh badhao
const API_BASE = import.meta.env.VITE_API_URL || 'https://mkt.central.ssism.org';

// Android back button handler
function BackButtonHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const lastBackPress = useRef(0);

  const rootPaths = ['/dashboard', '/track-dashboard'];
  const isRoot = rootPaths.includes(location.pathname);

  // Web — browser back button on root page
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!isRoot) return;

    window.history.pushState(null, '', window.location.href);
    const handler = () => {
      window.history.pushState(null, '', window.location.href);
      // Custom modal nahi laga sakte popstate mein, toast use karo
      toast('Browser back se bahar nahi ja sakte. Logout button use karein.', { icon: 'ℹ️', duration: 3000 });
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [isRoot]);

  // Native Android back button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handler = CapApp.addListener('backButton', () => {
      if (isRoot) {
        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          CapApp.exitApp();
        } else {
          lastBackPress.current = now;
          toast('Press back again to exit', { icon: '👋', duration: 2000 });
        }
      } else {
        navigate(-1);
      }
    });

    return () => { handler.then(l => l.remove()); };
  }, [isRoot, navigate]);

  return null;
}

export default function App() {
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    fetch(`${API_BASE.replace(/\/api$/, '')}/api/app-version`)
      .then(r => r.json())
      .then(({ minVersion }) => {
        if (CURRENT_APP_VERSION < minVersion) setUpdateRequired(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setupOfflineSync(({ synced }) => {
      toast.success(`${synced} pending action${synced > 1 ? 's' : ''} sync ho gaye!`);
    });
  }, []);

  if (updateRequired) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '2rem', textAlign: 'center', background: '#f9fafb' }}>
        <img src="/icon-512.png" alt="logo" style={{ width: 80, marginBottom: 24 }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 12 }}>Update Required</h2>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>Naya version available hai. App use karne ke liye please update karein.</p>
        <a
          href="https://drive.google.com/uc?export=download&id=1YZXMIGaZR6DAcZi_C4ez_yevjUTcDHs_"
          style={{ background: '#2563eb', color: '#fff', padding: '12px 32px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}
        >
          Update Karein (v1.2)
        </a>
      </div>
    );
  }
  return (
    <PermissionGate>
    <BrowserRouter>
      <Toaster position="top-right" />
      <LocationBlocker />
      <BackButtonHandler />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/track-dashboard" element={
            <ProtectedRoute roles={['track_incharge']}>
              <TrackDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin-track/:track" element={
            <ProtectedRoute roles={['admin']}>
              <AdminTrackDashboard />
            </ProtectedRoute>
          } />
          <Route path="/students" element={<Students />} />
          <Route path="/students/add" element={<StudentForm />} />
          <Route path="/students/:id" element={<StudentDetail />} />
          <Route path="/students/:id/edit" element={<StudentForm />} />
          <Route path="/targets" element={
            <ProtectedRoute roles={['admin']}>
              <Targets />
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute roles={['admin']}>
              <Users />
            </ProtectedRoute>
          } />
          <Route path="/attendance" element={
            <ProtectedRoute roles={['admin']}>
              <Attendance />
            </ProtectedRoute>
          } />
          <Route path="/edit-requests" element={<EditRequests />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/activity-log" element={
            <ProtectedRoute roles={['admin', 'track_incharge']}>
              <ActivityLog />
            </ProtectedRoute>
          } />
          <Route path="/track-manager" element={
            <ProtectedRoute roles={['admin']}>
              <TrackManager />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
    </PermissionGate>
  );
}
