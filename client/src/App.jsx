import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { useEffect } from 'react';
import { setupOfflineSync } from './utils/offlineQueue';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
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

export default function App() {
  useEffect(() => {
    setupOfflineSync(({ synced }) => {
      toast.success(`${synced} pending action${synced > 1 ? 's' : ''} sync ho gaye!`);
    });
  }, []);
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
