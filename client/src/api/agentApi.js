import axios from 'axios';

const AGENT_BASE = import.meta.env.VITE_AGENT_API_URL ?? (window.location.origin + '/api/v1');
const API_KEY    = import.meta.env.VITE_AGENT_API_KEY  ?? 'ae7e9b3c18c819532a773c9a6f1e633fc8fd2d29e802cda2ffc1cb8d7b597bfb';

const agentApi = axios.create({
  baseURL: AGENT_BASE,
  headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
});

export const agent = {
  getStats: () =>
    agentApi.get('/agent/stats').then(r => r.data),

  triggerCall: (phone, name) =>
    agentApi.post('/agent/call', { phone, name }).then(r => r.data),

  getHistory: (phone) =>
    agentApi.get('/agent/history', { params: { phone } }).then(r => r.data),

  scheduleCallback: (phone, name, scheduled_at, notes = '', callback_type = 'human') =>
    agentApi.post('/agent/callback', { phone, name, scheduled_at, notes, callback_type }).then(r => r.data),

  getCallbacks: (status = 'pending') =>
    agentApi.get('/agent/callbacks', { params: { status } }).then(r => r.data),

  cancelCallback: (id) =>
    agentApi.patch(`/agent/callbacks/${id}/cancel`).then(r => r.data),

  sendWhatsApp: (phone, text) =>
    agentApi.post('/agent/whatsapp', { phone, text }).then(r => r.data),
};
