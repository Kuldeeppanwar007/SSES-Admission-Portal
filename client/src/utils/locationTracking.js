import { Capacitor } from '@capacitor/core';

const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const getPlugin = () => {
  if (!isAndroid()) return null;
  try { return window.Capacitor?.Plugins?.LocationTracking || null; }
  catch { return null; }
};

export const startLocationTracking = (token, refreshToken, apiUrl) => {
  const plugin = getPlugin();
  if (!plugin) return;
  plugin.startTracking({ token, refreshToken, apiUrl });
};

export const stopLocationTracking = () => {
  const plugin = getPlugin();
  if (!plugin) return;
  plugin.stopTracking();
};
