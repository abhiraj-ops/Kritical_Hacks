import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import type { Alert, HazardType } from '@/api/client';
import { SEVERITY_META, TYPE_META } from '@/lib/format';
import { LAYERS } from '@/lib/layers';
import { REGION_CENTER, type RegionId } from '@/hooks/useEcoData';

interface Props {
  alerts: Alert[];
  region: RegionId;
  activeLayers: Set<HazardType>;
  onSelect: (a: Alert) => void;
}

/** Recentre the map when the region chip changes. */
function Recentre({ region }: { region: RegionId }) {
  const map = useMap();
  useEffect(() => {
    const c = REGION_CENTER[region];
    map.flyTo([c.lat, c.lng], c.zoom, { duration: 0.9 });
  }, [region, map]);
  return null;
}

function severityMarkerIcon(sev: Alert['severity']): L.DivIcon {
  const meta = SEVERITY_META[sev];
  const size = meta.weight >= 3 ? 20 : 13;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:50%;
      background:var(${meta.varName});
      border:2px solid rgba(255,255,255,0.85);
      ${meta.weight >= 3 ? `box-shadow:0 0 0 5px color-mix(in srgb, var(${meta.varName}) 28%, transparent);` : ''}
    "></span>`,
  });
}

/**
 * Imperative marker layer. leaflet.markercluster has no official React binding,
 * so we manage the group directly and keep it in sync with `alerts`.
 */
function ClusterLayer({ alerts, onSelect }: { alerts: Alert[]; onSelect: (a: Alert) => void }) {
  const map = useMap();

  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
    });
    map.addLayer(group);

    const markers = alerts.map((a) =>
      L.marker([a.lat, a.lng], {
        icon: severityMarkerIcon(a.severity),
        title: `${TYPE_META[a.type].label} — ${a.region}`,
        alt: `${TYPE_META[a.type].label} in ${a.region}`,
      }).on('click', () => onSelect(a)),
    );

    group.addLayers(markers);

    return () => {
      map.removeLayer(group);
      group.clearLayers();
    };
  }, [alerts, onSelect, map]);

  return null;
}

export function HazardMap({ alerts, region, activeLayers, onSelect }: Props) {
  const centre = REGION_CENTER[region];

  const visible = useMemo(() => alerts.filter((a) => activeLayers.has(a.type)), [alerts, activeLayers]);

  return (
    <MapContainer
      center={[centre.lat, centre.lng]}
      zoom={centre.zoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
      zoomControl
      worldCopyJump
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={18}
      />
      <Recentre region={region} />
      <ClusterLayer alerts={visible} onSelect={onSelect} />
    </MapContainer>
  );
}

/** Severity legend overlay. */
export function MapLegend({ counts }: { counts: Record<string, number> }) {
  return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap gap-2 rounded-xl border p-2"
      style={{
        borderColor: 'var(--border-strong)',
        background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {(['critical', 'high', 'medium', 'low'] as const).map((s) => (
        <span key={s} className="flex items-center gap-1.5 text-[11px] font-bold">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: `var(${SEVERITY_META[s].varName})` }}
          />
          <span style={{ color: 'var(--text-muted)' }}>
            {SEVERITY_META[s].label} {counts[s] ?? 0}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Layer toggle chips. */
export function LayerToggles({
  active,
  onToggle,
}: {
  active: Set<HazardType>;
  onToggle: (t: HazardType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LAYERS.map((l) => (
        <button key={l.id} type="button" className="chip" aria-pressed={active.has(l.id)} onClick={() => onToggle(l.id)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}