
import { StorageData, Category, MonthlyLogs, DailyLog } from '../types';

const STORAGE_KEY = 'life_tracker_v1';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'veg', name: 'Vegetables', icon: '🥒', color: '#10b981' },
  { id: 'sports', name: 'Sports', icon: '🏀', color: '#3b82f6' },
  { id: 'piano', name: 'Piano', icon: '🎹', color: '#4b5563' },
  { id: 'art', name: 'Art', icon: '🎨', color: '#ec4899' },
  { id: 'prog', name: 'Programming', icon: '💻', color: '#06b6d4' },
  { id: 'sci', name: 'Science', icon: '🧪', color: '#8b5cf6' },
  { id: 'hike', name: 'Hiking', icon: '🥾', color: '#15803d' },
  { id: 'theater', name: 'Theater', icon: '🎭', color: '#7c3aed' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#0ea5e9' },
  { id: 'movie', name: 'Movie', icon: '🎬', color: '#f43f5e' },
  { id: 'fastfood', name: 'Fast Food', icon: '🍕', color: '#f97316' },
  { id: 'alc', name: 'Alcohol', icon: '🍷', color: '#991b1b' },
  { id: 'sugar', name: 'Sugar Heavy', icon: '🍦', color: '#facc15' },
];

export const loadData = (): StorageData => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      const migratedLogs: { [key: string]: MonthlyLogs } = {};
      
      if (data.logs) {
        Object.entries(data.logs).forEach(([monthKey, monthData]) => {
          const castMonthData = monthData as Record<string, any>;
          migratedLogs[monthKey] = {};
          
          Object.entries(castMonthData).forEach(([day, dayData]) => {
            const dayNum = parseInt(day);
            if (dayData && typeof dayData === 'object' && !dayData.entries) {
              migratedLogs[monthKey][dayNum] = {
                entries: dayData as DailyLog['entries'],
                note: ''
              };
            } else {
              migratedLogs[monthKey][dayNum] = dayData as DailyLog;
            }
          });
        });
      }

      return {
        categories: data.categories || DEFAULT_CATEGORIES,
        logs: migratedLogs,
        evidence: data.evidence || {},
        evidenceTitles: data.evidenceTitles || {},
        locations: data.locations || {}
      };
    } catch (e) {
      console.error("Storage corruption. Resetting to defaults.", e);
    }
  }
  return {
    categories: DEFAULT_CATEGORIES,
    logs: {},
    evidence: {},
    evidenceTitles: {},
    locations: {}
  };
};

export const saveData = (data: StorageData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};
