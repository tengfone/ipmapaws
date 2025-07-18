import { getCachedDataWithVersion, setCachedData } from './cache';
import type { AWSIPRanges } from '@/types';

const AWS_IP_RANGES_URL = 'https://ip-ranges.amazonaws.com/ip-ranges.json';
const CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour
const FORCE_REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // Force refresh every 24 hours

let syncInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Fetch fresh data from AWS
 */
async function fetchAWSIPRanges(): Promise<AWSIPRanges> {
  console.log('[BackgroundSync] Fetching AWS IP ranges...');
  
  try {
    const response = await fetch(AWS_IP_RANGES_URL, {
      headers: {
        'User-Agent': 'IPMapAWS/1.0 (Background Sync)',
        'Accept': 'application/json',
      },
      cache: 'no-store',
      // Add timeout for serverless environments
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`AWS API responded with status: ${response.status} ${response.statusText}`);
    }

    const data: AWSIPRanges = await response.json();

    // Validate the response structure
    if (!data.prefixes || !data.ipv6_prefixes || !data.syncToken || !data.createDate) {
      throw new Error('Invalid AWS IP ranges response structure');
    }

    console.log(`[BackgroundSync] Successfully fetched ${data.prefixes.length + data.ipv6_prefixes.length} IP prefixes`);
    console.log(`[BackgroundSync] AWS createDate: ${data.createDate}, syncToken: ${data.syncToken}`);
    
    return data;
  } catch (error) {
    console.error('[BackgroundSync] Failed to fetch AWS IP ranges:', error);
    throw error;
  }
}

/**
 * Check if we need to update based on AWS createDate
 */
async function shouldUpdate(): Promise<{ needsUpdate: boolean; reason: string; remoteData?: AWSIPRanges }> {
  try {
    // Get current cached data
    const cached = await getCachedDataWithVersion();
    
    // If no cache exists, we definitely need to update
    if (!cached.data) {
      try {
        const remoteData = await fetchAWSIPRanges();
        return { 
          needsUpdate: true, 
          reason: 'No cached data found',
          remoteData 
        };
      } catch (error) {
        console.error('[BackgroundSync] Failed to fetch initial data:', error);
        return {
          needsUpdate: false,
          reason: `Failed to fetch initial data: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }

    // Fetch remote data to compare
    let remoteData: AWSIPRanges;
    try {
      remoteData = await fetchAWSIPRanges();
    } catch (error) {
      console.error('[BackgroundSync] Failed to fetch remote data for comparison:', error);
      return {
        needsUpdate: false,
        reason: `Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
    
    // Compare createDate and syncToken
    const createDateChanged = remoteData.createDate !== cached.createDate;
    const syncTokenChanged = remoteData.syncToken !== cached.syncToken;
    
    if (createDateChanged || syncTokenChanged) {
      console.log(`[BackgroundSync] Update needed - createDate: ${cached.createDate} → ${remoteData.createDate}, syncToken: ${cached.syncToken} → ${remoteData.syncToken}`);
      return { 
        needsUpdate: true, 
        reason: `AWS data updated (${createDateChanged ? 'createDate' : 'syncToken'} changed)`,
        remoteData 
      };
    }

    // Check if cache is very old (force refresh)
    const cacheAge = Date.now() - (cached.timestamp || 0);
    if (cacheAge > FORCE_REFRESH_INTERVAL) {
      console.log(`[BackgroundSync] Force refresh - cache is ${Math.round(cacheAge / (60 * 60 * 1000))} hours old`);
      return { 
        needsUpdate: true, 
        reason: 'Force refresh due to cache age',
        remoteData 
      };
    }

    return { 
      needsUpdate: false, 
      reason: 'Data is up to date' 
    };

  } catch (error) {
    console.error('[BackgroundSync] Error checking for updates:', error);
    return { 
      needsUpdate: false, 
      reason: `Error checking updates: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Perform the background sync check
 */
async function performSync(): Promise<void> {
  if (isRunning) {
    console.log('[BackgroundSync] Sync already running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log('[BackgroundSync] Starting sync check...');
    
    const { needsUpdate, reason, remoteData } = await shouldUpdate();
    
    if (needsUpdate && remoteData) {
      console.log(`[BackgroundSync] ${reason} - updating cache...`);
      try {
        await setCachedData(remoteData);
        console.log('[BackgroundSync] Cache updated successfully');
      } catch (cacheError) {
        console.error('[BackgroundSync] Failed to update cache, but data is available:', cacheError);
        // Cache failure shouldn't be fatal - the API can still serve fresh data
      }
    } else {
      console.log(`[BackgroundSync] ${reason}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[BackgroundSync] Sync completed in ${duration}ms`);

  } catch (error) {
    console.error('[BackgroundSync] Sync failed:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the background sync process
 */
export function startBackgroundSync(): void {
  // In serverless environments, don't start persistent intervals
  if (process.env.VERCEL) {
    console.log('[BackgroundSync] Serverless environment detected - performing one-time sync');
    // Just perform a sync without setting up intervals
    performSync().catch(error => {
      console.error('[BackgroundSync] Initial sync failed:', error);
    });
    return;
  }

  if (syncInterval) {
    console.log('[BackgroundSync] Already running');
    return;
  }

  console.log(`[BackgroundSync] Starting background sync (check every ${CHECK_INTERVAL / (60 * 1000)} minutes)`);
  
  // Perform initial sync
  performSync().catch(error => {
    console.error('[BackgroundSync] Initial sync failed:', error);
  });
  
  // Set up periodic sync (only in non-serverless environments)
  syncInterval = setInterval(() => {
    performSync().catch(error => {
      console.error('[BackgroundSync] Periodic sync failed:', error);
    });
  }, CHECK_INTERVAL);
}

/**
 * Stop the background sync process
 */
export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[BackgroundSync] Stopped');
  }
}

/**
 * Get sync status
 */
export function getSyncStatus(): { running: boolean; interval: number; environment: string } {
  return {
    running: syncInterval !== null,
    interval: CHECK_INTERVAL,
    environment: process.env.VERCEL ? 'serverless' : 'traditional'
  };
}

/**
 * Manual sync trigger (for API use only)
 */
export async function triggerSync(): Promise<{ success: boolean; message: string }> {
  try {
    await performSync();
    return { success: true, message: 'Sync completed successfully' };
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Sync failed' 
    };
  }
} 