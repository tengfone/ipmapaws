/**
 * TypeScript definitions for AWS IP Ranges JSON structure
 * Based on: https://ip-ranges.amazonaws.com/ip-ranges.json
 */

export interface AWSIPPrefix {
  ip_prefix: string;
  region: string;
  service: string;
  network_border_group: string;
}

export interface AWSIPv6Prefix {
  ipv6_prefix: string;
  region: string;
  service: string;
  network_border_group: string;
}

export interface AWSIPRanges {
  syncToken: string;
  createDate: string;
  prefixes: AWSIPPrefix[];
  ipv6_prefixes: AWSIPv6Prefix[];
}

// Combined type for both IPv4 and IPv6 prefixes
export interface CombinedPrefix {
  prefix: string; // Either ip_prefix or ipv6_prefix
  region: string;
  service: string;
  network_border_group: string;
  type: 'ipv4' | 'ipv6';
}

// Filter options
export interface FilterOptions {
  regions: string[];
  services: string[];
  searchTerm: string;
  includeIPv4: boolean;
  includeIPv6: boolean;
}

// Sort options
export type SortField = 'prefix' | 'region' | 'service' | 'network_border_group';
export type SortDirection = 'asc' | 'desc';

export interface SortOptions {
  field: SortField;
  direction: SortDirection;
}

// Search API response types
export interface SearchPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SearchResponse {
  data: CombinedPrefix[];
  pagination: SearchPagination;
  filters: FilterOptions;
  sorting: SortOptions;
}

// API response types
export interface APIResponse<T> {
  data: T;
  error?: string;
  loading: boolean;
}

// Component prop types
export interface FilterControlsProps {
  regions: string[];
  services: string[];
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  onClearFilters: () => void;
}

export interface PrefixTableProps {
  prefixes: CombinedPrefix[];
  totalCount: number;
  loading: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onCopyPrefix: (prefix: string) => void;
  copiedPrefix?: string;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export interface ExportResponse {
  data: CombinedPrefix[];
  total: number;
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
  timestamp: string;
}

export interface ExportButtonProps {
  filters: FilterOptions;
  sortField: SortField;
  sortDirection: SortDirection;
  filename?: string;
  disabled?: boolean;
  className?: string;
}

// SEO and metadata types
export interface PageMetadata {
  title: string;
  description: string;
  canonical: string;
  jsonLd?: object;
}

export interface RegionServiceParams {
  region: string;
  service: string;
}

// Statistics types
export interface IPRangeStats {
  totalPrefixes: number;
  ipv4Count: number;
  ipv6Count: number;
  regionCount: number;
  serviceCount: number;
  lastUpdated: string;
}

// Error types
export interface IPRangeError {
  message: string;
  code?: string;
  timestamp: string;
} 