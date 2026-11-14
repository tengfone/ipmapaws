import { NextRequest, NextResponse } from 'next/server';
import { getAWSIPRangesServer } from '@/lib/server-data';
import { apiRateLimit } from '@/lib/rate-limit';
import { corsPreflight, withCors } from '@/lib/cors';

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
  return withCors(await apiRateLimit(request, async () => {
  try {
    const data = await getAWSIPRangesServer().catch(() => null);

    if (!data) {
      // No cached data available and fallback failed
      return NextResponse.json(
        { 
          error: 'Data not available',
          message: 'Could not load the AWS IP ranges. Please try again in a few moments.',
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        // Add custom headers for debugging
        'X-Data-Source': 'AWS IP Ranges (ip-ranges.amazonaws.com)',
        'X-Last-Updated': data.createDate,
        'X-Sync-Token': data.syncToken,
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
  }));
}

export async function OPTIONS() {
  return corsPreflight();
}
