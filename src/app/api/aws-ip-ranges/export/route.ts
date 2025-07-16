import { NextRequest, NextResponse } from 'next/server';
import { getCachedData } from '@/lib/cache';
import { transformAWSIPRanges, filterPrefixes, sortPrefixes } from '@/lib/api';
import { SortField, SortDirection } from '@/types';
import { exportRateLimit } from '@/lib/rate-limit';

/**
 * @swagger
 * /api/aws-ip-ranges/export:
 *   get:
 *     summary: Export filtered AWS IP ranges
 *     description: Export AWS IP ranges with filtering and sorting applied. Returns all matching records (no pagination). Use this for generating CSV files or bulk data processing.
 *     tags:
 *       - AWS IP Ranges
 *     parameters:
 *       - $ref: '#/components/parameters/Regions'
 *       - $ref: '#/components/parameters/Services'
 *       - $ref: '#/components/parameters/SearchTerm'
 *       - $ref: '#/components/parameters/IncludeIPv4'
 *       - $ref: '#/components/parameters/IncludeIPv6'
 *       - $ref: '#/components/parameters/SortField'
 *       - $ref: '#/components/parameters/SortDirection'
 *     responses:
 *       200:
 *         description: All matching AWS IP ranges for export
 *         headers:
 *           X-RateLimit-Limit:
 *             description: Rate limit threshold (5 requests/10 minutes)
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
 *               $ref: '#/components/schemas/ExportResponse'
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 *       503:
 *         $ref: '#/components/responses/ServiceUnavailable'
 */
export async function GET(request: NextRequest) {
  return exportRateLimit(request, async () => {
  try {
    // Get cached AWS data
    const awsData = await getCachedData();
    
    if (!awsData) {
      return NextResponse.json(
        { 
          error: 'Data not available yet',
          message: 'Background sync is initializing. Please try again in a few moments.',
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }

    // Parse query parameters (same as search endpoint but no pagination)
    const { searchParams } = new URL(request.url);
    
    // Parse filter parameters
    const regions = searchParams.get('regions')?.split(',').filter(Boolean) || [];
    const services = searchParams.get('services')?.split(',').filter(Boolean) || [];
    const searchTerm = searchParams.get('searchTerm') || '';
    const includeIPv4 = searchParams.get('includeIPv4') !== 'false';
    const includeIPv6 = searchParams.get('includeIPv6') !== 'false';
    
    // Parse sorting parameters
    const sortField = (searchParams.get('sortField') as SortField) || 'prefix';
    const sortDirection = (searchParams.get('sortDirection') as SortDirection) || 'asc';

    // Transform AWS data to combined format
    const combinedPrefixes = transformAWSIPRanges(awsData);

    // Apply filtering
    const filteredPrefixes = filterPrefixes(combinedPrefixes, {
      regions,
      services,
      searchTerm,
      includeIPv4,
      includeIPv6,
    });

    // Apply sorting
    const sortedPrefixes = sortPrefixes(filteredPrefixes, sortField, sortDirection);

    // Return ALL results without pagination for export
    return NextResponse.json({
      data: sortedPrefixes,
      total: sortedPrefixes.length,
      filters: {
        regions,
        services,
        searchTerm,
        includeIPv4,
        includeIPv6,
      },
      sorting: {
        field: sortField,
        direction: sortDirection,
      },
      timestamp: new Date().toISOString(),
    }, {
      status: 200,
      headers: {
        // Short cache since this is dynamic content
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : 'https://ipmapaws.vercel.app',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Data-Source': 'AWS IP Ranges API (Export - All Results)',
      },
    });

  } catch (error) {
    console.error('Error in AWS IP ranges export API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to export AWS IP ranges',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
  });
} 