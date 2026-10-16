export type RegionId = 'delhi' | 'mumbai' | 'chennai' | 'global';

export interface Region {
  id: RegionId;
  label: string;
  urgency: 'Critical' | 'High' | 'Moderate' | 'Stable';
  color: string;
  x: number; // % position on stylized map
  y: number;
  incidents: number;
  aqi: number;
  temp: string;
  summary: string;
}

export interface FeedItem {
  id: string;
  source: string;
  title: string;
  time: string;
  urgency: 'Critical' | 'High' | 'Moderate';
  region: RegionId;
  url?: string;
}

export interface TriageRow {
  id: string;
  category: string;
  location: string;
  score: number;
  status: 'Dispatched' | 'Triaging' | 'Monitoring' | 'Verified';
}

export const REGIONS: Region[] = [
  {
    id: 'delhi',
    label: 'Delhi-NCR',
    urgency: 'Critical',
    color: '#EF4444',
    x: 38,
    y: 28,
    incidents: 6,
    aqi: 312,
    temp: '41.2°C',
    summary: 'Severe AQI spike + heatwave stress. Industrial zone emissions flagged.',
  },
  {
    id: 'mumbai',
    label: 'Mumbai',
    urgency: 'High',
    color: '#F97316',
    x: 24,
    y: 58,
    incidents: 4,
    aqi: 168,
    temp: '33.8°C',
    summary: 'Coastal flood risk + heavy rainfall cells moving inland.',
  },
  {
    id: 'chennai',
    label: 'Chennai',
    urgency: 'Moderate',
    color: '#EAB308',
    x: 48,
    y: 74,
    incidents: 3,
    aqi: 92,
    temp: '35.1°C',
    summary: 'Cyclone watch, reservoir levels elevated. Pre-emptive monitoring.',
  },
  {
    id: 'global',
    label: 'Global',
    urgency: 'Stable',
    color: '#38BDF8',
    x: 78,
    y: 32,
    incidents: 1,
    aqi: 54,
    temp: '—',
    summary: 'Background watch: 1 cross-border smoke plume under verification.',
  },
];

export const INITIAL_FEED: FeedItem[] = [
  { id: 'f1', source: 'TinyFish Search', title: 'Delhi AQI crosses 300 in Anand Vihar — CPCB live dashboard', time: '12s ago', urgency: 'Critical', region: 'delhi' },
  { id: 'f2', source: 'Municipal Dashboard', title: 'Mumbai BMC issues high-tide + rainfall advisory for Versova', time: '38s ago', urgency: 'High', region: 'mumbai' },
  { id: 'f3', source: 'Regional News', title: 'Chennai reservoirs at 82% — PWD releases controlled outflow plan', time: '1m ago', urgency: 'Moderate', region: 'chennai' },
  { id: 'f4', source: 'TinyFish Fetch', title: 'Markdown extracted: Delhi heatwave hospital admissions bulletin', time: '2m ago', urgency: 'Critical', region: 'delhi' },
  { id: 'f5', source: 'Social Feeds', title: 'Cluster of 14 citizen reports: smog + low visibility near Noida Expy', time: '3m ago', urgency: 'High', region: 'delhi' },
  { id: 'f6', source: 'Regional News', title: 'Mumbai local trains on caution — waterlogging at Kurla junction', time: '5m ago', urgency: 'High', region: 'mumbai' },
  { id: 'f7', source: 'TinyFish Search', title: 'IMD cyclone watch: Bay of Bengal depression 60km SE of Chennai', time: '7m ago', urgency: 'Moderate', region: 'chennai' },
  { id: 'f8', source: 'Municipal Dashboard', title: 'Delhi DJB water quality check flagged 2 industrial discharge points', time: '9m ago', urgency: 'Critical', region: 'delhi' },
];

export const TRIAGE_ROWS: TriageRow[] = [
  { id: 'ECO-1042', category: 'Air Quality', location: 'Anand Vihar, Delhi-NCR', score: 9.4, status: 'Dispatched' },
  { id: 'ECO-1041', category: 'Heatwave', location: 'Noida Sector 62, Delhi-NCR', score: 9.1, status: 'Triaging' },
  { id: 'ECO-1039', category: 'Urban Flood', location: 'Kurla, Mumbai', score: 8.2, status: 'Dispatched' },
  { id: 'ECO-1036', category: 'Coastal Risk', location: 'Versova, Mumbai', score: 7.6, status: 'Monitoring' },
  { id: 'ECO-1033', category: 'Cyclone Watch', location: 'ECR Belt, Chennai', score: 6.8, status: 'Monitoring' },
  { id: 'ECO-1031', category: 'Reservoir Level', location: 'Poondi, Chennai', score: 5.9, status: 'Verified' },
  { id: 'ECO-1028', category: 'Industrial Leak', location: 'Wazirpur, Delhi-NCR', score: 8.8, status: 'Triaging' },
];

export const DEMO_TITLES = [
  'Fresh TinyFish hit: stubble-burning plume drifting toward Delhi-NCR',
  'Live fetch: BMC disaster cell updates flood pump status to active',
  'New cluster: 9 citizen SOS posts geo-tagged near Yamuna floodplain',
  'Markdown parsed: IMD nowcast warns of 65km/h gusts off Chennai coast',
  'Cross-source verification: 3 outlets confirm smog emergency in Ghaziabad',
];
