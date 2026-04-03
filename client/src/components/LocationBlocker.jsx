import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import useAuthStore from '../store/authStore';

const CHECK_INTERVAL_MS = 10_000; // har 10 sec check karo

async function isLocationGranted() {
  try {
    if (!Capacitor.isNativePlatform()) {
      // Web browser — navigator.permissions se check karo
      if (!navigator.geolocation) return false;
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state === 'granted';
    }
    const status = await Geolocation.checkPermissions();
    return status.location === 'granted';
  } catch {
    return false;
  }
}

export default function LocationBlocker() {
  const { user } = useAuthStore();
  const [blocked, setBlocked] = useState(false);

  // Sirf track_incharge ke liye monitor karo
  const shouldMonitor = user?.role === 'track_incharge';

  const check = useCallback(async () => {
    if (!shouldMonitor) { setBlocked(false); return; }
    const granted = await isLocationGranted();
    setBlocked(!granted);
  }, [shouldMonitor]);

  // Initial check + interval
  useEffect(() => {
    if (!shouldMonitor) return;
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [check, shouldMonitor]);

  // App foreground pe aane pe turant recheck
  useEffect(() => {
    if (!shouldMonitor || !Capacitor.isNativePlatform()) return;
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) check();
    });
    return () => { listener.then(l => l.remove()); };
  }, [check, shouldMonitor]);

  if (!blocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5 text-center">

        <div className="text-5xl">📍</div>

        <div>
          <h2 className="text-xl font-bold text-gray-900">Location Band Hai!</h2>
          <p className="text-sm text-gray-500 mt-2">
            SSES Portal use karne ke liye location permission zaroori hai.
            Jab tak location on nahi hogi, app use nahi kar sakte.
          </p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs font-bold text-primary uppercase tracking-wide">Location on karne ke steps:</p>
          {Capacitor.isNativePlatform() ? (
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
              <li>Phone Settings kholein</li>
              <li>Apps → SSES Portal → Permissions</li>
              <li>Location → "Allow all the time" select karein</li>
              <li>Wapas app mein aayein</li>
            </ol>
          ) : (
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
              <li>Browser address bar mein lock icon click karein</li>
              <li>Location → Allow select karein</li>
              <li>Page refresh karein</li>
            </ol>
          )}
        </div>

        <button
          onClick={check}
          className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
        >
          📍 Location On Kar Di — Check Karo
        </button>

        <p className="text-xs text-gray-400">
          Yeh screen automatically hategi jab location permission mil jaayegi.
        </p>
      </div>
    </div>
  );
}
