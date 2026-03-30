import { useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const PERMISSIONS = [
  {
    key: 'location',
    label: 'Location',
    reason: 'Used to track attendance and verify your presence at work.',
    check: () => Geolocation.checkPermissions(),
    request: () => Geolocation.requestPermissions(),
    granted: (s) => s.location === 'granted',
  },
  {
    key: 'camera',
    label: 'Camera',
    reason: 'Used to capture photos for student records and documents.',
    check: () => Camera.checkPermissions(),
    request: () => Camera.requestPermissions(),
    granted: (s) => s.camera === 'granted',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    reason: 'Used to send you important updates and alerts.',
    check: () => PushNotifications.checkPermissions(),
    request: () => PushNotifications.requestPermissions(),
    granted: (s) => s.receive === 'granted',
  },
];

async function checkAllGranted() {
  const results = await Promise.all(PERMISSIONS.map((p) => p.check()));
  return PERMISSIONS.every((p, i) => p.granted(results[i]));
}

export default function PermissionGate({ children }) {
  const [status, setStatus] = useState('checking'); // checking | needed | denied | granted

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) { setStatus('granted'); return; }
    checkAllGranted().then((ok) => setStatus(ok ? 'granted' : 'needed'));
  }, []);

  const handleRequest = async () => {
    try {
      const results = await Promise.all(PERMISSIONS.map((p) => p.request()));
      const allGranted = PERMISSIONS.every((p, i) => p.granted(results[i]));
      setStatus(allGranted ? 'granted' : 'denied');
    } catch {
      setStatus('denied');
    }
  };

  const openSettings = () => App.openUrl({ url: 'app-settings:' });

  if (status === 'checking') return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (status === 'granted') return children;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200 p-6 space-y-5">

        <div className="text-center">
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="text-xl font-bold text-gray-800">Permissions Required</h1>
          <p className="text-sm text-gray-500 mt-1">
            This app needs the following permissions to work properly.
          </p>
        </div>

        <ul className="space-y-3">
          {PERMISSIONS.map(({ key, label, reason }) => (
            <li key={key} className="flex gap-3 items-start bg-gray-50 rounded-xl p-3">
              <span className="text-lg mt-0.5">
                {key === 'location' ? '📍' : key === 'camera' ? '📷' : '🔔'}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-700">{label}</p>
                <p className="text-xs text-gray-500">{reason}</p>
              </div>
            </li>
          ))}
        </ul>

        {status === 'denied' ? (
          <div className="space-y-3">
            <p className="text-sm text-red-500 text-center">
              Some permissions were denied. Please enable them in app settings.
            </p>
            <button onClick={openSettings}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors">
              Open App Settings
            </button>
          </div>
        ) : (
          <button onClick={handleRequest}
            className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors">
            Allow Permissions
          </button>
        )}
      </div>
    </div>
  );
}
