import { AWSIPRanges, CombinedPrefix, IPRangeError } from '@/types';

// Use our internal API route to avoid CORS issues
const getAPIURL = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use relative URL
    return '/api/aws-ip-ranges';
  }
  // Server-side: use absolute URL for build-time generation
  return process.env.NEXT_PUBLIC_BASE_URL 
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/aws-ip-ranges`
    : 'http://localhost:3000/api/aws-ip-ranges';
};

/**
 * Fetches AWS IP ranges from our internal API route (avoids CORS issues)
 */
export async function fetchAWSIPRanges(): Promise<AWSIPRanges> {
  try {
    const apiUrl = getAPIURL();
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Internal-Request': 'true', // Mark as internal website request to bypass rate limiting
      },
      // Only add cache options for server-side requests
      ...(typeof window === 'undefined' && {
        next: { revalidate: 3600 }
      })
    });

    if (!response.ok) {
      // Try to get error details from API response
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Fall back to status text if JSON parsing fails
      }
      throw new Error(`Failed to fetch AWS IP ranges: ${errorMessage}`);
    }

    const data: AWSIPRanges = await response.json();
    
    // Validate the response structure
    if (!data.prefixes || !data.ipv6_prefixes || !data.syncToken) {
      throw new Error('Invalid AWS IP ranges response structure');
    }

    return data;
  } catch (error) {
    console.error('Error in fetchAWSIPRanges:', error);
    
    const ipRangeError: IPRangeError = {
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      code: 'FETCH_ERROR',
      timestamp: new Date().toISOString(),
    };
    throw ipRangeError;
  }
}

/**
 * Transforms AWS IP ranges into a combined format for easier processing
 */
export function transformAWSIPRanges(data: AWSIPRanges): CombinedPrefix[] {
  const combined: CombinedPrefix[] = [];

  // Add IPv4 prefixes
  data.prefixes.forEach((prefix) => {
    combined.push({
      prefix: prefix.ip_prefix,
      region: prefix.region,
      service: prefix.service,
      network_border_group: prefix.network_border_group,
      type: 'ipv4',
    });
  });

  // Add IPv6 prefixes
  data.ipv6_prefixes.forEach((prefix) => {
    combined.push({
      prefix: prefix.ipv6_prefix,
      region: prefix.region,
      service: prefix.service,
      network_border_group: prefix.network_border_group,
      type: 'ipv6',
    });
  });

  return combined;
}

/**
 * Extracts unique regions from AWS IP ranges
 */
export function extractRegions(data: AWSIPRanges): string[] {
  const regions = new Set<string>();
  
  data.prefixes.forEach((prefix) => regions.add(prefix.region));
  data.ipv6_prefixes.forEach((prefix) => regions.add(prefix.region));
  
  return Array.from(regions).sort();
}

/**
 * Extracts unique services from AWS IP ranges
 */
export function extractServices(data: AWSIPRanges): string[] {
  const services = new Set<string>();
  
  data.prefixes.forEach((prefix) => services.add(prefix.service));
  data.ipv6_prefixes.forEach((prefix) => services.add(prefix.service));
  
  return Array.from(services).sort();
}

/**
 * Optimized filter function for better search performance
 */
export function filterPrefixes(
  prefixes: CombinedPrefix[],
  filters: {
    regions?: string[];
    services?: string[];
    searchTerm?: string;
    includeIPv4?: boolean;
    includeIPv6?: boolean;
  }
): CombinedPrefix[] {
  // Pre-process filters for better performance
  const includeIPv4 = filters.includeIPv4 !== false;
  const includeIPv6 = filters.includeIPv6 !== false;
  const regionSet = filters.regions && filters.regions.length > 0 ? new Set(filters.regions) : null;
  const serviceSet = filters.services && filters.services.length > 0 ? new Set(filters.services) : null;
  const searchTerm = filters.searchTerm?.trim().toLowerCase();
  
  return prefixes.filter((prefix) => {
    // Fast IP type check
    if (!includeIPv4 && prefix.type === 'ipv4') return false;
    if (!includeIPv6 && prefix.type === 'ipv6') return false;

    // Fast region check using Set
    if (regionSet && !regionSet.has(prefix.region)) return false;

    // Fast service check using Set
    if (serviceSet && !serviceSet.has(prefix.service)) return false;

    // Optimized search term check
    if (searchTerm) {
      // Use a single concatenated string for faster searching
      const searchableText = `${prefix.prefix} ${prefix.region} ${prefix.service} ${prefix.network_border_group}`.toLowerCase();
      if (!searchableText.includes(searchTerm)) return false;
    }

    return true;
  });
}

/**
 * Sorts combined prefixes by a given field and direction
 */
export function sortPrefixes(
  prefixes: CombinedPrefix[],
  field: 'prefix' | 'region' | 'service' | 'network_border_group',
  direction: 'asc' | 'desc' = 'asc'
): CombinedPrefix[] {
  return [...prefixes].sort((a, b) => {
    const aValue = a[field];
    const bValue = b[field];
    
    const comparison = aValue.localeCompare(bValue);
    return direction === 'asc' ? comparison : -comparison;
  });
} 