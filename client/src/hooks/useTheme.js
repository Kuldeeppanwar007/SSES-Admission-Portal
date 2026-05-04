import { useState, useEffect } from 'react';
import api from '../api/axios';

export const THEMES = [
  { id: 'orange', name: 'Orange', desc: 'Default warm orange', primary: '#f97316', light: '#fb923c', dark: '#ea580c' },
  { id: 'blue',   name: 'Blue',   desc: 'Classic ocean blue',  primary: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
  { id: 'green',  name: 'Green',  desc: 'Fresh nature green',  primary: '#22c55e', light: '#4ade80', dark: '#16a34a' },
  { id: 'purple', name: 'Purple', desc: 'Royal violet purple', primary: '#a855f7', light: '#c084fc', dark: '#9333ea' },
  { id: 'rose',   name: 'Rose',   desc: 'Vibrant rose red',    primary: '#f43f5e', light: '#fb7185', dark: '#e11d48' },
  { id: 'teal',   name: 'Teal',   desc: 'Cool teal cyan',      primary: '#14b8a6', light: '#2dd4bf', dark: '#0f766e' },
  { id: 'indigo',   name: 'Indigo',   desc: 'Deep indigo blue',    primary: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
  { id: 'crimson',  name: 'Crimson',  desc: 'Bold deep crimson',    primary: '#dc2626', light: '#ef4444', dark: '#b91c1c' },
  { id: 'amber',    name: 'Amber',    desc: 'Warm golden amber',     primary: '#d97706', light: '#f59e0b', dark: '#b45309' },
  { id: 'slate',    name: 'Slate',    desc: 'Modern cool slate',     primary: '#475569', light: '#64748b', dark: '#334155' },
  { id: 'cyan',     name: 'Cyan',     desc: 'Fresh electric cyan',   primary: '#0891b2', light: '#06b6d4', dark: '#0e7490' },
  { id: 'violet',   name: 'Violet',   desc: 'Soft dreamy violet',    primary: '#7c3aed', light: '#8b5cf6', dark: '#6d28d9' },
];

export function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  document.documentElement.style.setProperty('--color-primary', theme.primary);
  document.documentElement.style.setProperty('--color-primary-light', theme.light);
  document.documentElement.style.setProperty('--color-primary-dark', theme.dark);
}

export function useTheme() {
  const [themeId, setThemeId] = useState(() => localStorage.getItem('theme') || 'orange');

  // Fetch from DB on mount
  useEffect(() => {
    api.get('/users/me/theme')
      .then(({ data }) => {
        setThemeId(data.theme);
        localStorage.setItem('theme', data.theme);
        applyTheme(data.theme);
      })
      .catch(() => applyTheme(themeId)); // fallback to localStorage
  }, []);

  // Apply CSS vars whenever themeId changes
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  const changeTheme = async (id) => {
    setThemeId(id);
    localStorage.setItem('theme', id);
    await api.patch('/users/me/theme', { theme: id });
  };

  return { themeId, changeTheme };
}
