import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

const CENTER = [40.8990, 14.2785];

const dotIcons = {};
function dot(color) {
  if (!dotIcons[color]) {
    dotIcons[color] = L.divIcon({ className: '', html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};opacity:.65;border:1px solid white"></div>`, iconSize: [10, 10], iconAnchor: [5, 5] });
  }
  return dotIcons[color];
}

function pin(emoji, color = '#1e7b4f', pulse = false) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin ${pulse ? 'pulse' : ''}" style="--pin:${color};position:relative">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

function FitBounds({ points, padding = 40, maxZoom = 16, once }) {
  const map = useMap();
  const done = useRef(false);
  const key = points.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join('|');
  useEffect(() => {
    if (!points.length) return;
    if (once && done.current) return;
    done.current = true;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [padding, padding], maxZoom });
  }, [key]);
  return null;
}

/**
 * markers: [{ id, lat, lng, emoji, color, label, pulse, popup }]
 * lines: [[ [lat,lng], [lat,lng] ]]
 */
export default function MapView({ markers = [], lines = [], className = 'h-72', fit = true, onMarkerClick }) {
  const valid = useMemo(() => markers.filter((m) => m.lat != null && m.lng != null), [markers]);
  const points = valid.map((m) => [Number(m.lat), Number(m.lng)]);
  return (
    <div className={`overflow-hidden rounded-2xl border border-stone-200 ${className}`}>
      <MapContainer center={points[0] || CENTER} zoom={15} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {lines.map((l, i) => (
          <Polyline key={i} positions={l} pathOptions={{ color: '#e8822a', weight: 4, dashArray: '6 8', opacity: 0.8 }} />
        ))}
        {valid.map((m, i) => (
          <Marker
            key={m.id ?? i}
            position={[Number(m.lat), Number(m.lng)]}
            icon={m.dot ? dot(m.color || '#1e7b4f') : pin(m.emoji || '📍', m.color, m.pulse)}
            eventHandlers={onMarkerClick ? { click: () => onMarkerClick(m) } : undefined}
          >
            {(m.popup || m.label) && <Popup>{m.popup || m.label}</Popup>}
          </Marker>
        ))}
        {fit && <FitBounds points={points} once={fit === 'once'} />}
      </MapContainer>
    </div>
  );
}
