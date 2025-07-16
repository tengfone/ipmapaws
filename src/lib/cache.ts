import { promises as fs } from 'fs';
import path from 'path';
import { AWSIPRanges } from '@/types';

interface CacheData {
  data: AWSIPRanges;
  timestamp: number;
  createDate: string;
  syncToken: string;
}

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'aws-ip-ranges.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.access(CACHE_DIR);
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }
}

/**
 * Read cached data if it exists and is valid
 */
export async function getCachedData(): Promise<AWSIPRanges | null> {
  try {
    await ensureCacheDir();
    const cacheContent = await fs.readFile(CACHE_FILE, 'utf-8');
    const cached: CacheData = JSON.parse(cacheContent);
    
    const now = Date.now();
    const isExpired = (now - cached.timestamp) > CACHE_DURATION;
    
    if (isExpired) {
      console.log('Cache expired, will fetch fresh data');
      return null;
    }
    
    console.log(`Using cached AWS IP ranges data from ${new Date(cached.timestamp).toISOString()}`);
    return cached.data;
  } catch (error) {
    console.log('No valid cache found, will fetch fresh data');
    return null;
  }
}

/**
 * Save data to cache
 */
export async function setCachedData(data: AWSIPRanges): Promise<void> {
  try {
    await ensureCacheDir();
    
    const cacheData: CacheData = {
      data,
      timestamp: Date.now(),
      createDate: data.createDate,
      syncToken: data.syncToken,
    };
    
    await fs.writeFile(CACHE_FILE, JSON.stringify(cacheData, null, 2));
    console.log(`Cached AWS IP ranges data at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Failed to cache data:', error);
    // Don't throw - caching failure shouldn't break the app
  }
}

/**
 * Clear the cache (useful for testing or manual refresh)
 */
export async function clearCache(): Promise<void> {
  try {
    await fs.unlink(CACHE_FILE);
    console.log('Cache cleared');
  } catch (error) {
    // File might not exist, that's ok
    console.log('No cache to clear');
  }
}

// checkForUpdates function removed - now handled by background sync

/**
 * Get cached data with version information
 */
export async function getCachedDataWithVersion(): Promise<{
  data: AWSIPRanges | null;
  createDate?: string;
  syncToken?: string;
  timestamp?: number;
}> {
  try {
    await ensureCacheDir();
    const cacheContent = await fs.readFile(CACHE_FILE, 'utf-8');
    const cached: CacheData = JSON.parse(cacheContent);
    
    const now = Date.now();
    const isExpired = (now - cached.timestamp) > CACHE_DURATION;
    
    if (isExpired) {
      return { data: null };
    }
    
    return {
      data: cached.data,
      createDate: cached.createDate,
      syncToken: cached.syncToken,
      timestamp: cached.timestamp,
    };
  } catch {
    return { data: null };
  }
}

/**
 * Get cache info for debugging
 */
export async function getCacheInfo(): Promise<{
  exists: boolean;
  timestamp?: number;
  age?: number;
  expired?: boolean;
  size?: number;
  createDate?: string;
  syncToken?: string;
} | null> {
  try {
    await ensureCacheDir();
    const stats = await fs.stat(CACHE_FILE);
    const cacheContent = await fs.readFile(CACHE_FILE, 'utf-8');
    const cached: CacheData = JSON.parse(cacheContent);
    
    const now = Date.now();
    const age = now - cached.timestamp;
    const expired = age > CACHE_DURATION;
    
    return {
      exists: true,
      timestamp: cached.timestamp,
      age,
      expired,
      size: stats.size,
      createDate: cached.createDate,
      syncToken: cached.syncToken,
    };
  } catch {
    return {
      exists: false,
    };
  }
} 