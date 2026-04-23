import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const COLLEGE = { lat: 22.563246, lng: 76.961334 };
const COLORS = ['#6366f1','#22c55e','#ef4444','#f59e0b','#3b82f6','#ec4899','#14b8a6','#a855f7'];

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2);
};

export default function CampusMap({ users }) {
  const mapRef = useRef(null);
  const mapObj = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapObj.current) {
      mapObj.current = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(mapObj.current);
    }

    const map = mapObj.current;
    map.eachLayer(l => { if (!(l instanceof L.TileLayer)) map.removeLayer(l); });

    // College marker
    const clgIcon = L.divIcon({
      className: '',
      html: `<div style="width:38px;height:38px;background:#f97316;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px #f9731644;font-size:20px">🏫</div>`,
      iconAnchor: [19, 19],
    });
    L.marker([COLLEGE.lat, COLLEGE.lng], { icon: clgIcon })
      .addTo(map)
      .bindPopup('<b>SSES College</b>');

    const bounds = [[COLLEGE.lat, COLLEGE.lng]];

    users.forEach((u, i) => {
      if (!u.lat || !u.lng) return;
      const color = COLORS[i % COLORS.length];
      const initials = u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const dist = haversineKm(COLLEGE.lat, COLLEGE.lng, u.lat, u.lng);
      const time = u.timestamp
        ? new Date(u.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : 'N/A';

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:36px;height:36px;background:${color};border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:13px;box-shadow:0 2px 8px ${color}88">${initials}</div>`,
        iconAnchor: [18, 18],
      });

      L.marker([u.lat, u.lng], { icon })
        .addTo(map)
        .bindPopup(`<b>${u.name}</b><br/>${u.track}<br/>📍 ${dist} km from college<br/>🕐 ${time}`);

      L.polyline([[COLLEGE.lat, COLLEGE.lng], [u.lat, u.lng]], {
        color, weight: 2, dashArray: '5 5', opacity: 0.6,
      }).addTo(map);

      bounds.push([u.lat, u.lng]);
    });

    if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds).pad(0.2));
    else map.setView([COLLEGE.lat, COLLEGE.lng], 13);

    setTimeout(() => map.invalidateSize(), 200);

    return () => {};
  }, [users]);

  useEffect(() => {
    return () => {
      if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; }
    };
  }, []);

  return <div ref={mapRef} style={{ height: 'clamp(300px, 50vw, 480px)', width: '100%', borderRadius: '12px', zIndex: 0 }} />;
}
