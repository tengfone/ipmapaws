import { NextRequest, NextResponse } from 'next/server';
import { getCachedData } from '@/lib/cache';
import { startBackgroundSync } from '@/lib/background-sync';
import { apiRateLimit } from '@/lib/rate-limit';

// Start background sync when the API is first accessed
let syncStarted = false;

/**
 * @swagger
 * /api/aws-ip-ranges:
 *   get:
 *     summary: Get all AWS IP ranges
 *     description: Returns the complete AWS IP ranges dataset in the original format from Amazon
 *     tags:
 *       - AWS IP Ranges
 *     responses:
 *       200:
 *         description: AWS IP ranges data
 *         headers:
 *           X-Data-Source:
 *             description: Source of the data
 *             schema:
 *               type: string
 *           X-Last-Updated:
 *             description: When AWS last updated the data
 *             schema:
 *               type: string
 *           X-Sync-Token:
 *             description: AWS sync token
 *             schema:
 *               type: string
 *           X-Cache-Status:
 *             description: Cache status
 *             schema:
 *               type: string
 *           X-RateLimit-Limit:
 *             description: Rate limit threshold
 *             schema:
 *               type: integer
 *           X-RateLimit-Remaining:
 *             description: Remaining requests in current window
 *             schema:
 *               type: integer
 *           X-RateLimit-Reset:
 *             description: Unix timestamp when rate limit resets
 *             schema:
 *               type: integer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AWSRawData'
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 *       503:
 *         $ref: '#/components/responses/ServiceUnavailable'
 */
export async function GET(request: NextRequest) {
  return apiRateLimit(request, async () => {
  // Start background sync on first API call (server startup)
  if (!syncStarted) {
    console.log('[API] Starting background sync service...');
    startBackgroundSync();
    syncStarted = true;
  }

  try {
    // Try to get cached data first
    let data = await getCachedData();
    
    // If no cached data and in serverless environment, try to fetch directly
    if (!data && process.env.VERCEL) {
      console.log('[API] No cached data in serverless environment, fetching directly...');
      try {
        const response = await fetch('https://ip-ranges.amazonaws.com/ip-ranges.json', {
          headers: {
            'User-Agent': 'IPMapAWS/1.0 (API Fallback)',
            'Accept': 'application/json',
          },
          cache: 'no-store'
        });
        
        if (response.ok) {
          data = await response.json();
          // Try to cache it for future requests (may fail silently)
          if (data) {
            const { setCachedData } = await import('@/lib/cache');
            setCachedData(data).catch(err => {
              console.log('[API] Failed to cache fallback data:', err.message);
            });
            console.log('[API] Successfully fetched data directly from AWS');
          }
        }
      } catch (fallbackError) {
        console.error('[API] Direct fetch fallback failed:', fallbackError);
      }
    }
    
    if (!data) {
      // No cached data available and fallback failed
      return NextResponse.json(
        { 
          error: 'Data not available yet',
          message: 'Background sync is initializing. Please try again in a few moments.',
          timestamp: new Date().toISOString()
        },
        { 
          status: 503, // Service Unavailable
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Retry-After': '30', // Suggest retry after 30 seconds
          }
        }
      );
    }

    // Return cached data with appropriate headers
    return NextResponse.json(data, {
      status: 200,
      headers: {
        // Cache for 1 hour on CDN, allow stale while revalidating for 24 hours
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        // Add CORS headers for development
        'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : 'https://ipmapaws.vercel.app',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        // Add custom headers for debugging
        'X-Data-Source': 'AWS IP Ranges API (Cached)',
        'X-Last-Updated': data.createDate,
        'X-Sync-Token': data.syncToken,
        'X-Cache-Status': 'HIT',
      },
    });

  } catch (error) {
    console.error('Error in AWS IP ranges API:', error);
    
    // Return error response with proper status
    return NextResponse.json(
      { 
        error: 'Failed to fetch AWS IP ranges',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      }
    );
  }
  });
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : 'https://ipmapaws.vercel.app',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
} 