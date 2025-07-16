import { promises as fs } from 'fs';
import path from 'path';
import { AWSIPRanges } from '@/types';

interface CacheData {
  data: AWSIPRanges;
  timestamp: number;
  createDate: string;
  syncToken: string;
}

// Use /tmp directory in serverless environments (Vercel), fallback to .cache locally
const CACHE_DIR = process.env.VERCEL 
  ? '/tmp' 
  : path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'aws-ip-ranges.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// In-memory fallback cache for when file system is unavailable
let memoryCache: CacheData | null = null;

/**
 * Ensure cache directory exists (only for local development)
 */
async function ensureCacheDir(): Promise<void> {
  // Skip directory creation for Vercel (use /tmp which already exists)
  if (process.env.VERCEL) {
    return;
  }
  
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
  // Try file cache first
  try {
    await ensureCacheDir();
    const cacheContent = await fs.readFile(CACHE_FILE, 'utf-8');
    const cached: CacheData = JSON.parse(cacheContent);
    
    const now = Date.now();
    const isExpired = (now - cached.timestamp) > CACHE_DURATION;
    
    if (isExpired) {
      console.log('File cache expired, checking memory cache');
    } else {
      console.log(`Using cached AWS IP ranges data from file (${new Date(cached.timestamp).toISOString()})`);
      // Update memory cache with file data
      memoryCache = cached;
      return cached.data;
    }
  } catch (error) {
    console.log('File cache unavailable, checking memory cache');
  }

  // Fallback to memory cache
  if (memoryCache) {
    const now = Date.now();
    const isExpired = (now - memoryCache.timestamp) > CACHE_DURATION;
    
    if (!isExpired) {
      console.log(`Using memory cached AWS IP ranges data (${new Date(memoryCache.timestamp).toISOString()})`);
      return memoryCache.data;
    } else {
      console.log('Memory cache expired');
      memoryCache = null;
    }
  }

  console.log('No valid cache found, will fetch fresh data');
  return null;
}

/**
 * Save data to cache
 */
export async function setCachedData(data: AWSIPRanges): Promise<void> {
  const cacheData: CacheData = {
    data,
    timestamp: Date.now(),
    createDate: data.createDate,
    syncToken: data.syncToken,
  };

  // Always update memory cache
  memoryCache = cacheData;
  console.log(`Cached AWS IP ranges data in memory at ${new Date().toISOString()}`);

  // Try to save to file cache (may fail in serverless environments)
  try {
    await ensureCacheDir();
    await fs.writeFile(CACHE_FILE, JSON.stringify(cacheData, null, 2));
    console.log(`Cached AWS IP ranges data to file at ${new Date().toISOString()}`);
  } catch (error) {
    console.log('File caching unavailable, using memory cache only');
    // Don't throw - caching failure shouldn't break the app
  }
}

/**
 * Clear the cache (useful for testing or manual refresh)
 */
export async function clearCache(): Promise<void> {
  // Clear memory cache
  memoryCache = null;
  console.log('Memory cache cleared');

  // Try to clear file cache
  try {
    await fs.unlink(CACHE_FILE);
    console.log('File cache cleared');
  } catch (error) {
    console.log('No file cache to clear');
  }
}

/**
 * Get cached data with version information
 */
export async function getCachedDataWithVersion(): Promise<{
  data: AWSIPRanges | null;
  createDate?: string;
  syncToken?: string;
  timestamp?: number;
}> {
  // Try file cache first
  try {
    await ensureCacheDir();
    const cacheContent = await fs.readFile(CACHE_FILE, 'utf-8');
    const cached: CacheData = JSON.parse(cacheContent);
    
    const now = Date.now();
    const isExpired = (now - cached.timestamp) > CACHE_DURATION;
    
    if (!isExpired) {
      return {
        data: cached.data,
        createDate: cached.createDate,
        syncToken: cached.syncToken,
        timestamp: cached.timestamp,
      };
    }
  } catch {
    // File cache failed, continue to memory cache
  }

  // Fallback to memory cache
  if (memoryCache) {
    const now = Date.now();
    const isExpired = (now - memoryCache.timestamp) > CACHE_DURATION;
    
    if (!isExpired) {
      return {
        data: memoryCache.data,
        createDate: memoryCache.createDate,
        syncToken: memoryCache.syncToken,
        timestamp: memoryCache.timestamp,
      };
    }
  }

  return { data: null };
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
  source?: 'file' | 'memory';
} | null> {
  // Try file cache first
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
      source: 'file',
    };
  } catch {
    // File cache failed, check memory cache
  }

  // Check memory cache
  if (memoryCache) {
    const now = Date.now();
    const age = now - memoryCache.timestamp;
    const expired = age > CACHE_DURATION;
    
    return {
      exists: true,
      timestamp: memoryCache.timestamp,
      age,
      expired,
      size: JSON.stringify(memoryCache).length,
      createDate: memoryCache.createDate,
      syncToken: memoryCache.syncToken,
      source: 'memory',
    };
  }

  return {
    exists: false,
  };
} 