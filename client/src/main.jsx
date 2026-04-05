import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import './index.css';
import App from './App.jsx';

if (Capacitor.isNativePlatform()) {
  // Zoom disable karo sirf app mein
  const viewport = document.querySelector('meta[name=viewport]');
  if (viewport) viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  SplashScreen.hide({ fadeOutDuration: 500 });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
