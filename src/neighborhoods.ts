export type Category = 'games' | 'playtesting' | 'data' | 'design' | 'modeling' | 'experience';

export interface Neighborhood {
  category: Category;
  name: string;
  blurb: string;
  color: string;
  icon: string;
}

// One neighborhood per project category. Adding a category = add an entry here
// (and to the Category type); the world and Browse page pick it up automatically.
export const NEIGHBORHOODS: Neighborhood[] = [
  { category: 'games', name: 'Times Square', blurb: 'Games I have built', color: '#e8505b', icon: '🎮' },
  { category: 'playtesting', name: 'Chelsea', blurb: 'Playtesting and player research', color: '#4f9d8f', icon: '🧪' },
  { category: 'data', name: 'Financial District', blurb: 'Data and analytics', color: '#4c7bd9', icon: '📊' },
  { category: 'design', name: 'SoHo', blurb: 'Design work', color: '#e9a23b', icon: '🎨' },
  { category: 'modeling', name: 'DUMBO', blurb: '3D modeling', color: '#9a6fd1', icon: '🧊' },
  { category: 'experience', name: 'Midtown', blurb: 'Work experience', color: '#6b7f94', icon: '💼' },
];

export const neighborhoodFor = (c: Category): Neighborhood =>
  NEIGHBORHOODS.find((n) => n.category === c)!;
