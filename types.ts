
export enum LogState {
  OFF = 0,
  ON = 1,
  QUESTIONABLE = 2
}

export type CategoryType = 'binary' | 'scalar';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  type?: CategoryType;
  units?: string;
}

export interface DailyLog {
  entries: { [categoryId: string]: LogState | number };
  atmosphere?: number; // 1-10 scale
  note?: string;
}

export interface MonthlyLogs {
  [day: number]: DailyLog;
}

export interface StorageData {
  categories: Category[];
  logs: {
    [monthKey: string]: MonthlyLogs; // Key format: YYYY-MM
  };
  evidence?: {
    [monthKey: string]: string; // Base64 image
  };
  evidenceTitles?: {
    [monthKey: string]: string; // Custom title for the artifact
  };
  locations?: {
    [monthKey: string]: string; // Site name or coords
  };
}

export interface ProgressData {
  name: string;
  count: number;
  total: number;
  percentage: number;
  color: string;
  type: CategoryType;
}
