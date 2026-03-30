import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const START_ICON = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#22c55e;border:2px solid white;border-radius:50%;box-shadow:0 0 0 3px #22c55e55"></div>`,
  iconAnchor: [7, 7],
});

const END_ICON = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#ef4444;border:2px solid white;border-radius:50%;box-shadow:0 0 0 3px #ef444455"></div>`,
  iconAnchor: [7, 7],
});

const STOP_ICON = L.divIcon({
  className: '',
  html: `<div style="width:11px;height:11px;background:#f59e0b;border:2px solid white;border-radius:50%"></div>`,
  iconAnchor: [5, 5],
});

const DOT_ICON = L.divIcon({
  className: '',
  html: `<div style="width:8px;height:8px;background:#6366f1;border:1.5px solid white;border-radius:50%"></div>`,
  iconAnchor: [4, 4],
});

// Animated moving dot icon
const MOVER_ICON = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;background:#6366f1;border:3px solid white;border-radius:50%;box-shadow:0 0 8px #6366f1aa"></div>`,
  iconAnchor: [8, 8],
});

export default function TrackingMap({ points }) {
  const mapRef    = useRef(null);
  const mapObj    = useRef(null);
  const moverRef  = useRef(null);
  const animRef   = useRef(null);
  const indexRef  = useRef(0);

  useEffect(() => {
    if (!points?.length) return;

    // Init map
    if (!mapObj.current) {
      mapObj.current = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapObj.current);
    }

    const map = mapObj.current;

    // Clear old layers except tile
    map.eachLayer(l => { if (!(l instanceof L.TileLayer)) map.removeLayer(l); });
    if (animRef.current) clearInterval(animRef.current);

    const latlngs = points.map(p => [p.lat, p.lng]);

    // Draw full path (dashed gray)
    L.polyline(latlngs, { color: '#d1d5db', weight: 3, dashArray: '6 4' }).addTo(map);

    // Animated traveled path (solid indigo) — starts empty
    const traveledLine = L.polyline([], { color: '#6366f1', weight: 4 }).addTo(map);

    // Static markers
    points.forEach((pt, i) => {
      const isFirst = i === 0;
      const isLast  = i === points.length - 1;
      const icon    = isFirst ? START_ICON : isLast ? END_ICON : pt.isStopped ? STOP_ICON : DOT_ICON;

      const popupLines = [
        `<b>${new Date(pt.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</b>`,
        pt.location ? `📍 ${pt.location}` : '',
        isFirst ? '🟢 Start' : isLast ? '🔴 End' : pt.isStopped ? '🛑 Stopped' : '',
        i > 0 ? `+${pt.distFromPrev >= 1000 ? (pt.distFromPrev/1000).toFixed(2)+' km' : pt.distFromPrev+' m'}` : '',
      ].filter(Boolean).join('<br/>');

      L.marker([pt.lat, pt.lng], { icon }).addTo(map).bindPopup(popupLines);
    });

    // Moving dot marker
    moverRef.current = L.marker(latlngs[0], { icon: MOVER_ICON, zIndexOffset: 1000 }).addTo(map);

    // Fit bounds
    map.fitBounds(L.latLngBounds(latlngs).pad(0.15));

    // Animate dot along path
    indexRef.current = 0;
    animRef.current = setInterval(() => {
      const idx = indexRef.current;
      if (idx >= latlngs.length) {
        clearInterval(animRef.current);
        return;
      }
      moverRef.current.setLatLng(latlngs[idx]);
      traveledLine.addLatLng(latlngs[idx]);
      indexRef.current++;
    }, 600);

    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [points]);

  return (
    <div ref={mapRef} style={{ height: '420px', width: '100%', borderRadius: '12px', zIndex: 0 }} />
  );
}
