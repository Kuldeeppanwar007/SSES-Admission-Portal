import { useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { registerPlugin } from '@capacitor/core';

const LocationTracking = registerPlugin('LocationTracking');

const REQUIRED_PERMISSIONS = [
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

// Battery optimization — optional, non-blocking
const OPTIONAL_PERMISSIONS = [
  {
    key: 'battery',
    label: 'Background Activity',
    reason: 'Required to track attendance even when app is in background.',
    request: async () => { try { await LocationTracking.requestBatteryOptimization(); } catch { } },
  },
];

const PERMISSIONS = [...OPTIONAL_PERMISSIONS, ...REQUIRED_PERMISSIONS];

async function checkAllGranted() {
  try {
    const results = await Promise.all(REQUIRED_PERMISSIONS.map((p) => p.check()));
    return REQUIRED_PERMISSIONS.every((p, i) => p.granted(results[i]));
  } catch {
    return false;
  }
}

async function requestAllSequentially(onBatteryRequested) {
  // Battery optional — request karo but block mat karo
  try {
    await LocationTracking.requestBatteryOptimization();
    await onBatteryRequested();
  } catch { }
  // Required permissions
  for (const p of REQUIRED_PERMISSIONS) {
    try { await p.request(); } catch { }
  }
}

export default function PermissionGate({ children }) {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    // TODO: Re-enable after testing phase — abhi sab bypass
    setStatus('granted');
  }, []);

  const recheck = async () => {
    const ok = await checkAllGranted();
    setStatus(ok ? 'granted' : 'denied');
    return ok;
  };

  const handleRequest = async () => {
    // Battery dialog ke baad app focus wapas aane ka wait karo
    const waitForFocus = () => new Promise((resolve) => {
      const sub = App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) { sub.then(l => l.remove()); resolve(); }
      });
    });

    await requestAllSequentially(waitForFocus);
    await recheck();
  };

  const openSettings = async () => App.openUrl({ url: 'app-settings:' });

  // Settings se wapas aane pe recheck
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && (status === 'denied' || status === 'needed')) recheck();
    });
    return () => { listener.then(l => l.remove()); };
  }, [status]);

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
                {key === 'battery' ? '🔋' : key === 'location' ? '📍' : key === 'camera' ? '📷' : '🔔'}
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
