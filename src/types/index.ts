// Re-export all AWS IP range types
export * from './aws-ip-ranges';

// General utility types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface BaseComponent {
  className?: string;
  children?: any;
}

// Form and input types
export interface SelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

// Toast notification types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Theme types
export type Theme = 'light' | 'dark' | 'system';

// Navigation types
export interface NavItem {
  label: string;
  href: string;
  icon?: any;
}

// Local storage keys
export const STORAGE_KEYS = {
  THEME: 'ipmapaws-theme',
  FILTERS: 'ipmapaws-filters',
  PREFERENCES: 'ipmapaws-preferences',
} as const; 