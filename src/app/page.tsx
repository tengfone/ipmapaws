'use client';

import React, { useState, useCallback, useMemo, startTransition } from 'react';
import { FilterControls } from '@/components/FilterControls';
import { PrefixTable } from '@/components/PrefixTable';
import { ExportSummary } from '@/components/ExportButton';
import { DataStatus } from '@/components/DataStatus';
import { useAWSIPRanges, useAWSIPRangesSearch } from '@/hooks/useAWSIPRanges';
import { FilterOptions, SortField, SortDirection } from '@/types';
import { copyToClipboard, debounce } from '@/lib/utils';

// Default filter state
const defaultFilters: FilterOptions = {
  regions: [],
  services: [],
  searchTerm: '',
  includeIPv4: true,
  includeIPv6: true,
};

export default function HomePage() {
  // State management
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);
  const [searchInput, setSearchInput] = useState(''); // Separate state for search input
  const [sortField, setSortField] = useState<SortField>('prefix');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedPrefix, setCopiedPrefix] = useState<string | undefined>();

  const itemsPerPage = 50;

  // Data fetching - use metadata hook for regions/services/stats and search hook for results
  const { regions, services, stats, isLoading: metadataLoading, error: metadataError } = useAWSIPRanges();
  
  // Server-side search with pagination
  const { 
    data: searchResults, 
    pagination, 
    isLoading: searchLoading, 
    error: searchError 
  } = useAWSIPRangesSearch(currentPage, itemsPerPage, filters, sortField, sortDirection);

  // Debounced search handler to avoid excessive API calls
  const debouncedSetSearchTerm = useMemo(
    () => debounce((searchTerm: string) => {
      startTransition(() => {
        setFilters(prev => ({ ...prev, searchTerm }));
        setCurrentPage(1); // Reset to first page when search changes
      });
    }, 300), // 300ms debounce delay
    []
  );

  // Reset to page 1 when filters change
  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    // Update input immediately for responsive UI
    setSearchInput(value);
    // Then debounce the actual filtering
    debouncedSetSearchTerm(value);
  }, [debouncedSetSearchTerm]);

  const handleClearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSearchInput('');
    setCurrentPage(1);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sort changes
  }, [sortField]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleCopyPrefix = useCallback(async (prefix: string) => {
    const success = await copyToClipboard(prefix);
    if (success) {
      setCopiedPrefix(prefix);
      setTimeout(() => setCopiedPrefix(undefined), 2000);
    }
  }, []);

  // Handle errors
  const error = metadataError || searchError;
  const isLoading = metadataLoading;

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
          <h1 className="text-lg font-semibold text-destructive mb-2">
            Error Loading AWS IP Ranges
          </h1>
          <p className="text-sm text-destructive/80">
            {error?.message || 'Failed to load AWS IP ranges. Please try again later.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          AWS IP Ranges Explorer
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Search and filter AWS IP prefixes by region and service. 
          Perfect for network engineers and infrastructure teams.
        </p>
        {stats && (
          <div className="flex items-center justify-center space-x-8 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">{stats.totalPrefixes.toLocaleString()}</span> total prefixes
            </div>
            <div>
              <span className="font-medium text-foreground">{stats.regionCount}</span> regions
            </div>
            <div>
              <span className="font-medium text-foreground">{stats.serviceCount}</span> services
            </div>
          </div>
        )}
      </div>

      {/* API Announcement */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                🚀 Public API Available
              </h3>
              <p className="text-blue-700 dark:text-blue-300">
                Programmatic access to AWS IP ranges with advanced filtering, search, and export capabilities
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-6 text-sm">
              <div className="text-center">
                <div className="font-semibold text-blue-900 dark:text-blue-100">REST API</div>
                <div className="text-blue-600 dark:text-blue-400">JSON responses</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-900 dark:text-blue-100">Rate Limited</div>
                <div className="text-blue-600 dark:text-blue-400">Fair usage</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-900 dark:text-blue-100">Free</div>
                <div className="text-blue-600 dark:text-blue-400">No auth required</div>
              </div>
            </div>
            <a
              href="/docs"
              className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>View API Docs</span>
            </a>
          </div>
        </div>
        
        {/* API Quick Stats */}
        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-blue-900 dark:text-blue-100">3 Endpoints</div>
              <div className="text-blue-600 dark:text-blue-400">Search, Export, Raw data</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-900 dark:text-blue-100">OpenAPI 3.0</div>
              <div className="text-blue-600 dark:text-blue-400">Full specification</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-900 dark:text-blue-100">Interactive Docs</div>
              <div className="text-blue-600 dark:text-blue-400">Test in browser</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-900 dark:text-blue-100">Real-time Data</div>
              <div className="text-blue-600 dark:text-blue-400">Always up-to-date</div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Status */}
      <DataStatus 
        lastUpdated={stats?.lastUpdated}
      />

      {/* Filter Controls */}
      <FilterControls
        regions={regions}
        services={services}
        filters={filters}
        searchInput={searchInput}
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
        onClearFilters={handleClearFilters}
      />

      {/* Export Summary */}
      <ExportSummary
        data={searchResults}
        totalCount={pagination.total}
        filters={filters}
        sortField={sortField}
        sortDirection={sortDirection}
      />

      {/* Results Table */}
      <PrefixTable
        prefixes={searchResults}
        totalCount={pagination.total}
        loading={searchLoading}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onCopyPrefix={handleCopyPrefix}
        copiedPrefix={copiedPrefix}
        currentPage={pagination.page}
        itemsPerPage={pagination.limit}
        onPageChange={handlePageChange}
      />

      {/* API Example & Additional Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Example */}
        <div className="bg-gray-900 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 002 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="font-medium text-white">Quick API Example</h3>
          </div>
          <div className="text-green-400 font-mono text-sm space-y-2">
            <div className="text-gray-400"># Get EC2 IP ranges in us-east-1</div>
            <div>curl "https://ipmapaws.vercel.app/api/aws-ip-ranges/search?regions=us-east-1&services=EC2"</div>
            <div className="text-gray-400 mt-4"># Export all S3 ranges as JSON</div>
            <div>curl "https://ipmapaws.vercel.app/api/aws-ip-ranges/export?services=S3"</div>
          </div>
          <div className="mt-4">
            <a
              href="/docs"
              className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm"
            >
              <span>Try interactive examples →</span>
            </a>
          </div>
        </div>

        {/* About This Data */}
        <div className="bg-muted/50 rounded-lg p-6 text-sm text-muted-foreground">
          <h3 className="font-medium text-foreground mb-2">About This Data</h3>
          <p className="mb-2">
            This tool displays IP address ranges used by AWS services. The data is fetched directly from 
            Amazon's official IP ranges endpoint and is updated automatically when AWS publishes changes.
          </p>
          <p className="mb-3">
            Use this information for firewall configuration, security group rules, and network monitoring. 
            Each IP range includes the service name, region, and network border group for precise filtering.
          </p>
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <span>Web Interface</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
              <span>REST API</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
              <span>Real-time Data</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 