import type { HazardType } from '@/api/client';

export interface MapLayer {
  id: HazardType;
  label: string;
}

export const LAYERS: MapLayer[] = [
  { id: 'earthquake', label: 'Earthquakes' },
  { id: 'weather', label: 'Weather' },
  { id: 'air_quality', label: 'Air Quality' },
  { id: 'fire', label: 'Fires' },
  { id: 'flood', label: 'Flood' },
  { id: 'storm', label: 'Storms' },
];