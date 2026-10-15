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
  /** real-world position [latitude, longitude] of the beacon on the city map */
  ll: [number, number];
  /** which side of the beacon its label sits on, so neighbouring labels do not overlap */
  labelSide: 'l' | 'r';
}

// One neighborhood per category. Adding one = add an entry here and to the Category type;
// the career page, the city map, and the neighborhood scene all pick it up automatically.
export const NEIGHBORHOODS: Neighborhood[] = [
  { category: 'games', name: 'Times Square', label: 'Games', blurb: 'Games I have built', color: '#e8505b', icon: '🎮', building: 'arcade', buildingH: 260, lot: '#efe7d6', ll: [40.758, -73.9855], labelSide: 'l' },
  { category: 'playtesting', name: 'Chelsea', label: 'Playtesting & Research', blurb: 'Professional playtesting and player research', color: '#4f9d8f', icon: '🧪', building: 'lab', buildingH: 260, lot: '#e9eee4', ll: [40.7465, -74.0014], labelSide: 'l' },
  { category: 'engineering', name: 'Financial District', label: 'Software Engineering', blurb: 'Software engineering and data', color: '#4c7bd9', icon: '💻', building: 'bank', buildingH: 260, lot: '#e6e4ec', ll: [40.7075, -74.0113], labelSide: 'l' },
  { category: 'apps', name: 'Flatiron', label: 'Apps & Web', blurb: 'iOS apps and websites', color: '#3fa7c4', icon: '📱', building: 'flatiron', buildingH: 320, lot: '#e8efee', ll: [40.7411, -73.9897], labelSide: 'r' },
  { category: 'modeling', name: 'DUMBO', label: '3D & Animation', blurb: 'Maya: 3D modeling, rendering, and animation', color: '#9a6fd1', icon: '🧊', building: 'warehouse', buildingH: 280, lot: '#d8c9b3', ll: [40.7033, -73.9881], labelSide: 'r' },
  { category: 'design', name: 'SoHo', label: 'Design & Marketing', blurb: 'Design and marketing', color: '#e9a23b', icon: '🎨', building: 'gallery', buildingH: 260, lot: '#eee2cc', ll: [40.7233, -74.003], labelSide: 'l' },
  { category: 'experience', name: 'Midtown', label: 'Experience', blurb: 'Work experience', color: '#6b7f94', icon: '💼', building: 'office', buildingH: 300, lot: '#e4e6ea', ll: [40.7549, -73.9707], labelSide: 'r' },
  { category: 'involvement', name: 'Union Square', label: 'Leadership & Involvement', blurb: 'Leadership and community involvement', color: '#d9708c', icon: '🤝', building: 'hall', buildingH: 260, lot: '#efe3e3', ll: [40.7359, -73.9911], labelSide: 'l' },
  { category: 'spots', name: 'My Spots', label: 'Hobbies', blurb: 'Hobbies and favorite places', color: '#2f7d5b', icon: '📍', building: 'bodega', buildingH: 240, lot: '#e8efdf', ll: [40.7411, -73.9897], labelSide: 'r' },
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

/** Where hobby spots sit on the city map ([latitude, longitude]), keyed by the entry's file name. Entries not listed get no pin. */
export const SPOT_POS: Record<string, { ll: [number, number]; icon: string }> = {
  'citi-bike-west-side': { ll: [40.73, -74.0103], icon: '🚲' },
  'dumbo-walks': { ll: [40.7036, -73.9944], icon: '🌉' },
  'park-picnics': { ll: [40.7716, -73.9766], icon: '🧺' },
  gym: { ll: [40.758, -73.992], icon: '🏋️' },
  'food-spots': { ll: [40.7185, -73.987], icon: '🍕' },
};

/** The "About me" pin: a general spot in Brooklyn, not an address. */
export const HOME_LL: [number, number] = [40.6785, -73.977];
