import useSWR from 'swr';
import { fetchAWSIPRanges, transformAWSIPRanges, extractRegions, extractServices } from '@/lib/api';
import { AWSIPRanges, CombinedPrefix, IPRangeStats, FilterOptions, SortField, SortDirection } from '@/types';

interface UseAWSIPRangesReturn {
  data: AWSIPRanges | undefined;
  combinedPrefixes: CombinedPrefix[];
  regions: string[];
  services: string[];
  stats: IPRangeStats | null;
  isLoading: boolean;
  error: any;
  mutate: () => void;
}

interface UseAWSIPRangesSearchReturn {
  data: CombinedPrefix[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: FilterOptions;
  sorting: {
    field: SortField;
    direction: SortDirection;
  };
  isLoading: boolean;
  error: any;
  mutate: () => void;
}

/**
 * Custom hook for fetching AWS IP ranges with SWR caching
 * This is used for metadata (regions, services, stats) and basic data
 */
export function useAWSIPRanges(): UseAWSIPRangesReturn {
  const { data, error, isLoading, mutate } = useSWR<AWSIPRanges>(
    'aws-ip-ranges',
    fetchAWSIPRanges,
    {
      // Revalidate every 24 hours
      refreshInterval: 24 * 60 * 60 * 1000,
      // Revalidate on window focus (helpful for development)
      revalidateOnFocus: process.env.NODE_ENV === 'development',
      // Revalidate on reconnect
      revalidateOnReconnect: true,
      // Cache for 1 hour
      dedupingInterval: 60 * 60 * 1000,
      // Retry on error with exponential backoff
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      // Don't suspend on error
      suspense: false,
      // Keep previous data while revalidating
      keepPreviousData: true,
    }
  );

  // Transform and process data
  const combinedPrefixes = data ? transformAWSIPRanges(data) : [];
  const regions = data ? extractRegions(data) : [];
  const services = data ? extractServices(data) : [];

  // Calculate statistics
  const stats: IPRangeStats | null = data ? {
    totalPrefixes: combinedPrefixes.length,
    ipv4Count: data.prefixes.length,
    ipv6Count: data.ipv6_prefixes.length,
    regionCount: regions.length,
    serviceCount: services.length,
    lastUpdated: data.createDate,
  } : null;

  return {
    data,
    combinedPrefixes,
    regions,
    services,
    stats,
    isLoading,
    error,
    mutate,
  };
}

/**
 * New hook for server-side filtered and paginated AWS IP ranges
 */
export function useAWSIPRangesSearch(
  page: number = 1,
  limit: number = 50,
  filters: FilterOptions,
  sortField: SortField = 'prefix',
  sortDirection: SortDirection = 'asc'
): UseAWSIPRangesSearchReturn {
  // Build query parameters
  const queryParams = new URLSearchParams();
  queryParams.set('page', page.toString());
  queryParams.set('limit', limit.toString());
  queryParams.set('sortField', sortField);
  queryParams.set('sortDirection', sortDirection);
  
  if (filters.regions.length > 0) {
    queryParams.set('regions', filters.regions.join(','));
  }
  if (filters.services.length > 0) {
    queryParams.set('services', filters.services.join(','));
  }
  if (filters.searchTerm) {
    queryParams.set('searchTerm', filters.searchTerm);
  }
  queryParams.set('includeIPv4', filters.includeIPv4.toString());
  queryParams.set('includeIPv6', filters.includeIPv6.toString());

  const searchUrl = `/api/aws-ip-ranges/search?${queryParams.toString()}`;

  const { data, error, isLoading, mutate } = useSWR(
    searchUrl,
    async (url: string) => {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-Internal-Request': 'true', // Mark as internal website request to bypass rate limiting
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    {
      // Fast revalidation for search results
      dedupingInterval: 1000,
      // Keep previous data while loading new results
      keepPreviousData: true,
      // Don't revalidate on focus for search results
      revalidateOnFocus: false,
      // Retry less aggressively for search
      errorRetryCount: 2,
      errorRetryInterval: 1000,
    }
  );

  return {
    data: data?.data || [],
    pagination: data?.pagination || {
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
    filters: data?.filters || filters,
    sorting: data?.sorting || { field: sortField, direction: sortDirection },
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook for fetching IP ranges filtered by region and service
 * This still uses the client-side approach for region/service specific pages
 * since the filtering is simpler and already quite fast
 */
export function useFilteredIPRanges(region?: string, service?: string) {
  const { combinedPrefixes, isLoading, error } = useAWSIPRanges();

  const filteredPrefixes = combinedPrefixes.filter((prefix) => {
    if (region && prefix.region !== region) return false;
    if (service && prefix.service !== service) return false;
    return true;
  });

  return {
    prefixes: filteredPrefixes,
    count: filteredPrefixes.length,
    isLoading,
    error,
  };
} 