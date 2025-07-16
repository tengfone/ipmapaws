import { put, head, del } from '@vercel/blob';
import { AWSIPRanges } from '@/types';

interface CacheData {
  data: AWSIPRanges;
  timestamp: number;
  createDate: string;
  syncToken: string;
}

const CACHE_BLOB_NAME = 'cache/aws-ip-ranges.json';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// In-memory fallback cache for performance
let memoryCache: CacheData | null = null;

/**
 * Read cached data if it exists and is valid
 */
export async function getCachedData(): Promise<AWSIPRanges | null> {
  // Try blob cache first
  try {
    // Check if blob exists
    const blobInfo = await head(CACHE_BLOB_NAME).catch(() => null);
    
    if (blobInfo) {
      // Fetch blob content
      const response = await fetch(blobInfo.url);
      const cacheContent = await response.text();
      const cached: CacheData = JSON.parse(cacheContent);
      
      const now = Date.now();
      const isExpired = (now - cached.timestamp) > CACHE_DURATION;
      
      if (isExpired) {
        console.log('Blob cache expired, checking memory cache');
      } else {
        console.log(`Using cached AWS IP ranges data from blob (${new Date(cached.timestamp).toISOString()})`);
        // Update memory cache with blob data
        memoryCache = cached;
        return cached.data;
      }
    }
  } catch (error) {
    console.log('Blob cache unavailable, checking memory cache:', error);
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

  // Try to save to blob cache
  try {
    const cacheContent = JSON.stringify(cacheData, null, 2);
    const blob = await put(CACHE_BLOB_NAME, cacheContent, {
      access: 'public',
      allowOverwrite: true,
      contentType: 'application/json',
    });
    
    console.log(`Cached AWS IP ranges data to blob at ${new Date().toISOString()}: ${blob.url}`);
  } catch (error) {
    console.log('Blob caching failed, using memory cache only:', error);
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

  // Try to clear blob cache
  try {
    await del(CACHE_BLOB_NAME);
    console.log('Blob cache cleared');
  } catch (error) {
    console.log('No blob cache to clear:', error);
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
  // Try blob cache first
  try {
    const blobInfo = await head(CACHE_BLOB_NAME).catch(() => null);
    
    if (blobInfo) {
      const response = await fetch(blobInfo.url);
      const cacheContent = await response.text();
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
    }
  } catch (error) {
    console.log('Blob cache failed, checking memory cache:', error);
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
  source?: 'blob' | 'memory';
} | null> {
  // Try blob cache first
  try {
    const blobInfo = await head(CACHE_BLOB_NAME).catch(() => null);
    
    if (blobInfo) {
      const response = await fetch(blobInfo.url);
      const cacheContent = await response.text();
      const cached: CacheData = JSON.parse(cacheContent);
      
      const now = Date.now();
      const age = now - cached.timestamp;
      const expired = age > CACHE_DURATION;
      
      return {
        exists: true,
        timestamp: cached.timestamp,
        age,
        expired,
        size: blobInfo.size,
        createDate: cached.createDate,
        syncToken: cached.syncToken,
        source: 'blob',
      };
    }
  } catch (error) {
    console.log('Blob cache failed, checking memory cache:', error);
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