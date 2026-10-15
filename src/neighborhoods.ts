export type Category =
  | 'games'
  | 'playtesting'
  | 'engineering'
  | 'apps'
  | 'modeling'
  | 'design'
  | 'experience'
  | 'involvement'
  | 'spots';

export interface Neighborhood {
  category: Category;
  /** neighborhood name, used in the world and shown as a tag on the career page */
  name: string;
  /** category name shown on the career page */
  label: string;
  blurb: string;
  color: string;
  icon: string;
  /** building sprite in public/art/buildings (3D versions live in public/art-v3/buildings) */
  building: string;
  /** viewBox height of that sprite (the width is always 282) */
  buildingH: number;
  /** colour of the paved lots in the neighborhood scene */
  lot: string;
  /** position on the city map: t runs south (0) to north (1) along Manhattan, off is pixels east of the centerline */
  map: { t: number; off: number };
  /** which side of the beacon its label sits on (default: left of the island centerline, right of it otherwise) */
  labelSide?: 'l' | 'r';
}

// One neighborhood per category. Adding one = add an entry here and to the Category type;
// the career page, the city map, and the neighborhood scene all pick it up automatically.
export const NEIGHBORHOODS: Neighborhood[] = [
  { category: 'games', name: 'Times Square', label: 'Games', blurb: 'Games I have built', color: '#e8505b', icon: '🎮', building: 'arcade', buildingH: 260, lot: '#efe7d6', map: { t: 0.38, off: -20 } },
  { category: 'playtesting', name: 'Chelsea', label: 'Playtesting & Research', blurb: 'Professional playtesting and player research', color: '#4f9d8f', icon: '🧪', building: 'lab', buildingH: 260, lot: '#e9eee4', map: { t: 0.22, off: -65 } },
  { category: 'engineering', name: 'Financial District', label: 'Software Engineering', blurb: 'Software engineering and data', color: '#4c7bd9', icon: '💻', building: 'bank', buildingH: 260, lot: '#e6e4ec', map: { t: 0.03, off: 0 }, labelSide: 'r' },
  { category: 'apps', name: 'Flatiron', label: 'Apps & Web', blurb: 'iOS apps and websites', color: '#3fa7c4', icon: '📱', building: 'flatiron', buildingH: 320, lot: '#e8efee', map: { t: 0.29, off: 30 } },
  { category: 'modeling', name: 'DUMBO', label: '3D & Animation', blurb: 'Maya: 3D modeling, rendering, and animation', color: '#9a6fd1', icon: '🧊', building: 'warehouse', buildingH: 280, lot: '#d8c9b3', map: { t: 0.07, off: 235 } },
  { category: 'design', name: 'SoHo', label: 'Design & Marketing', blurb: 'Design and marketing', color: '#e9a23b', icon: '🎨', building: 'gallery', buildingH: 260, lot: '#eee2cc', map: { t: 0.12, off: -30 } },
  { category: 'experience', name: 'Midtown', label: 'Experience', blurb: 'Work experience', color: '#6b7f94', icon: '💼', building: 'office', buildingH: 300, lot: '#e4e6ea', map: { t: 0.46, off: 45 } },
  { category: 'involvement', name: 'Union Square', label: 'Leadership & Involvement', blurb: 'Leadership and community involvement', color: '#d9708c', icon: '🤝', building: 'hall', buildingH: 260, lot: '#efe3e3', map: { t: 0.2, off: 45 } },
  { category: 'spots', name: 'My Spots', label: 'Hobbies', blurb: 'Hobbies and favorite places', color: '#2f7d5b', icon: '📍', building: 'bodega', buildingH: 240, lot: '#e8efdf', map: { t: 0.3, off: 0 } },
];

export const neighborhoodFor = (c: Category): Neighborhood =>
  NEIGHBORHOODS.find((n) => n.category === c)!;

/** Order of the category chips on the career page (spots are world-only). */
export const CAREER_ORDER: Category[] = [
  'experience',
  'engineering',
  'games',
  'playtesting',
  'apps',
  'design',
  'modeling',
  'involvement',
];

/** Where hobby spots sit on the city map, keyed by the entry's file name. Entries not listed here get no pin. */
export const SPOT_POS: Record<string, { t: number; off: number; icon: string }> = {
  'citi-bike-west-side': { t: 0.3, off: -92, icon: '🚲' },
  'dumbo-walks': { t: 0.06, off: 205, icon: '🌉' },
  'park-picnics': { t: 0.68, off: 0, icon: '🧺' },
  gym: { t: 0.4, off: 78, icon: '🏋️' },
  'food-spots': { t: 0.15, off: 80, icon: '🍕' },
};
