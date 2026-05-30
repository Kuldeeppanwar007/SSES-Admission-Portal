import axios from 'axios';

const AGENT_BASE = import.meta.env.VITE_AGENT_API_URL ?? 'https://ssism-voice-agent-nwm7.vercel.app/api/v1';
const API_KEY    = import.meta.env.VITE_AGENT_API_KEY  ?? 'sses-internal-key-2024';

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
};
