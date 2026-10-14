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
  name: string;
  blurb: string;
  color: string;
  icon: string;
}

// One neighborhood per category. Adding a category = add an entry here and to the Category type;
// the Browse page and (later) the world pick it up automatically.
export const NEIGHBORHOODS: Neighborhood[] = [
  { category: 'games', name: 'Times Square', blurb: 'Games I have built', color: '#e8505b', icon: '🎮' },
  { category: 'playtesting', name: 'Chelsea', blurb: 'Professional playtesting and player research', color: '#4f9d8f', icon: '🧪' },
  { category: 'engineering', name: 'Financial District', blurb: 'Software engineering and data', color: '#4c7bd9', icon: '💻' },
  { category: 'apps', name: 'Flatiron', blurb: 'iOS apps and websites', color: '#3fa7c4', icon: '📱' },
  { category: 'modeling', name: 'DUMBO', blurb: 'Maya: 3D modeling, rendering, and animation', color: '#9a6fd1', icon: '🧊' },
  { category: 'design', name: 'SoHo', blurb: 'Design and marketing', color: '#e9a23b', icon: '🎨' },
  { category: 'experience', name: 'Midtown', blurb: 'Work experience', color: '#6b7f94', icon: '💼' },
  { category: 'involvement', name: 'Union Square', blurb: 'Leadership and community involvement', color: '#d9708c', icon: '🤝' },
  { category: 'spots', name: 'My Spots', blurb: 'Hobbies and favorite places', color: '#2f7d5b', icon: '📍' },
];

export const neighborhoodFor = (c: Category): Neighborhood =>
  NEIGHBORHOODS.find((n) => n.category === c)!;
