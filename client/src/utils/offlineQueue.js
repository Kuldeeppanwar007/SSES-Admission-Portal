import api from '../api/axios';

const QUEUE_KEY = 'sses_offline_queue';
const CACHE_KEY = 'sses_students_cache';

export const isOnline = () => navigator.onLine;

// Pending action queue mein add karo
export const enqueueAction = (action) => {
  const queue = getQueue();
  queue.push({ ...action, id: Date.now(), timestamp: new Date().toISOString() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const getQueue = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
};

export const clearQueue = () => localStorage.removeItem(QUEUE_KEY);

// Students list cache
export const cacheStudents = (data) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, cachedAt: new Date().toISOString() }));
};

export const getCachedStudents = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); }
  catch { return null; }
};

// Pending actions sync karo — internet aane par call karo
export const syncOfflineQueue = async () => {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0, failed = 0;
  const remaining = [];

  for (const action of queue) {
    try {
      const { method, url, data } = action;
      await api({ method, url, data });
      synced++;
    } catch {
      failed++;
      remaining.push(action);
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { synced, failed };
};

// Online event listener setup — ek baar call karo app start pe
export const setupOfflineSync = (onSynced) => {
  window.addEventListener('online', async () => {
    const result = await syncOfflineQueue();
    if (result.synced > 0 && onSynced) onSynced(result);
  });
};
