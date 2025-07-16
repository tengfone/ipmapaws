import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Papa from 'papaparse';
import copy from 'clipboard-copy';
import { CombinedPrefix } from '@/types';

/**
 * Merges class names using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Exports data to CSV format
 */
export function exportToCSV(data: CombinedPrefix[], filename: string = 'aws-ip-ranges.csv'): void {
  try {
    const csv = Papa.unparse(data, {
      header: true,
      columns: ['prefix', 'region', 'service', 'network_border_group', 'type'],
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error('Error exporting CSV:', error);
    throw new Error('Failed to export CSV file');
  }
}

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await copy(text);
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    
    // Fallback to navigator.clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (fallbackError) {
        console.error('Fallback clipboard error:', fallbackError);
      }
    }
    
    return false;
  }
}

/**
 * Debounces a function call
 */
export function debounce<T extends any[]>(
  func: (...args: T) => void,
  delay: number
): (...args: T) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Formats a date string into a readable format
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return dateString;
  }
}

/**
 * Formats a number with thousands separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Validates if a string is a valid CIDR notation
 */
export function isValidCIDR(cidr: string): boolean {
  const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/;
  const ipv6CidrRegex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\/([0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8])$/;
  
  return cidrRegex.test(cidr) || ipv6CidrRegex.test(cidr);
}

/**
 * Truncates text to a specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Checks if code is running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Gets value from localStorage safely
 */
export function getLocalStorage<T>(key: string, defaultValue: T): T {
  if (!isBrowser()) return defaultValue;
  
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Sets value in localStorage safely
 */
export function setLocalStorage<T>(key: string, value: T): boolean {
  if (!isBrowser()) return false;
  
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error setting localStorage key "${key}":`, error);
    return false;
  }
} 