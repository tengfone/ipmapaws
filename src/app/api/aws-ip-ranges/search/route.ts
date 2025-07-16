import { NextRequest, NextResponse } from 'next/server';
import { getCachedData } from '@/lib/cache';
import { transformAWSIPRanges, filterPrefixes, sortPrefixes } from '@/lib/api';
import { CombinedPrefix, SortField, SortDirection } from '@/types';
import { searchRateLimit } from '@/lib/rate-limit';

interface SearchParams {
  page?: string;
  limit?: string;
  regions?: string;
  services?: string;
  searchTerm?: string;
  includeIPv4?: string;
  includeIPv6?: string;
  sortField?: SortField;
  sortDirection?: SortDirection;
}

interface SearchResponse {
  data: CombinedPrefix[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: {
    regions: string[];
    services: string[];
    searchTerm: string;
    includeIPv4: boolean;
    includeIPv6: boolean;
  };
  sorting: {
    field: SortField;
    direction: SortDirection;
  };
}

/**
 * @swagger
 * /api/aws-ip-ranges/search:
 *   get:
 *     summary: Search and filter AWS IP ranges
 *     description: Search AWS IP ranges with advanced filtering, sorting, and pagination capabilities
 *     tags:
 *       - AWS IP Ranges
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *       - $ref: '#/components/parameters/Regions'
 *       - $ref: '#/components/parameters/Services'
 *       - $ref: '#/components/parameters/SearchTerm'
 *       - $ref: '#/components/parameters/IncludeIPv4'
 *       - $ref: '#/components/parameters/IncludeIPv6'
 *       - $ref: '#/components/parameters/SortField'
 *       - $ref: '#/components/parameters/SortDirection'
 *     responses:
 *       200:
 *         description: Filtered and paginated AWS IP ranges
 *         headers:
 *           X-RateLimit-Limit:
 *             description: Rate limit threshold (10 requests/minute)
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
 *               $ref: '#/components/schemas/SearchResponse'
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 *       503:
 *         $ref: '#/components/responses/ServiceUnavailable'
 */
export async function GET(request: NextRequest) {
  return searchRateLimit(request, async () => {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    
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

    // Calculate pagination
    const total = sortedPrefixes.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);
    
    // Get page data
    const pageData = sortedPrefixes.slice(startIndex, endIndex);

    // Build response
    const response: SearchResponse = {
      data: pageData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
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
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        // Short cache since this is dynamic content
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : 'https://ipmapaws.vercel.app',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Data-Source': 'AWS IP Ranges API (Server-Side Filtered)',
      },
    });

  } catch (error) {
    console.error('Error in AWS IP ranges search API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to search AWS IP ranges',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
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