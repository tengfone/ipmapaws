'use client';

import React, { useState, useMemo, useCallback, startTransition } from 'react';
import { FilterControls } from '@/components/FilterControls';
import { PrefixTable } from '@/components/PrefixTable';
import { ExportSummary } from '@/components/ExportButton';
import { DataStatus } from '@/components/DataStatus';
import { usePagination } from '@/components/ui/pagination';
import { useFilteredIPRanges } from '@/hooks/useAWSIPRanges';
import { FilterOptions, SortField, SortDirection } from '@/types';
import { filterPrefixes, sortPrefixes } from '@/lib/api';
import { copyToClipboard, debounce } from '@/lib/utils';

interface RegionServicePageProps {
  region: string;
  service: string;
}

export default function RegionServicePage({ region, service }: RegionServicePageProps) {
  const { prefixes, count, isLoading, error } = useFilteredIPRanges(region, service);
  
  // Separate state for search input to avoid lag
  const [searchInput, setSearchInput] = useState('');
  
  // State for additional filtering within the region/service
  const [filters, setFilters] = useState<FilterOptions>({
    regions: [region],
    services: [service],
    searchTerm: '',
    includeIPv4: true,
    includeIPv6: true,
  });
  
  const [sortField, setSortField] = useState<SortField>('prefix');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [copiedPrefix, setCopiedPrefix] = useState<string | undefined>();

  // Get unique network border groups for this region/service
  const networkBorderGroups = useMemo(() => {
    const groups = new Set(prefixes.map(p => p.network_border_group));
    return Array.from(groups).sort();
  }, [prefixes]);

  // Optimized filter handler with startTransition
  const debouncedSetFilters = useMemo(
    () => debounce((searchTerm: string) => {
      startTransition(() => {
        setFilters(prev => ({ ...prev, searchTerm }));
      });
    }, 150),
    []
  );

  // Apply additional filtering and sorting
  const filteredAndSortedPrefixes = useMemo(() => {
    const filtered = filterPrefixes(prefixes, filters);
    return sortPrefixes(filtered, sortField, sortDirection);
  }, [prefixes, filters, sortField, sortDirection]);

  // Pagination
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
  } = usePagination(filteredAndSortedPrefixes.length, 50);

  // Event handlers
  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    // Update filters immediately for non-search changes
    setFilters({
      ...newFilters,
      regions: [region],
      services: [service],
    });
  }, [region, service]);

  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    setFilters({
      regions: [region],
      services: [service],
      searchTerm: '',
      includeIPv4: true,
      includeIPv6: true,
    });
  }, [region, service]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const handleCopyPrefix = useCallback(async (prefix: string) => {
    const success = await copyToClipboard(prefix);
    if (success) {
      setCopiedPrefix(prefix);
      setTimeout(() => setCopiedPrefix(undefined), 2000);
    }
  }, []);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
          <h1 className="text-lg font-semibold text-destructive mb-2">
            Error Loading AWS IP Ranges
          </h1>
          <p className="text-sm text-destructive/80">
            Failed to load IP ranges for {service} in {region}.
          </p>
        </div>
      </div>
    );
  }

  const ipv4Count = filteredAndSortedPrefixes.filter(p => p.type === 'ipv4').length;
  const ipv6Count = filteredAndSortedPrefixes.filter(p => p.type === 'ipv6').length;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2 text-sm">
          <a 
            href="/" 
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            IPMapAWS
          </a>
          <span className="text-muted-foreground">/</span>
          <a 
            href={`/regions/${region}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {region}
          </a>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{service}</span>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight">
          {service} in {region}
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          AWS IP address ranges for {service} service in the {region} region. 
          {count > 0 ? `Browse ${count.toLocaleString()} IP prefixes` : 'No IP prefixes found'}.
        </p>
        
        {count > 0 && (
          <div className="flex items-center justify-center space-x-8 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">{count.toLocaleString()}</span> total prefixes
            </div>
            <div>
              <span className="font-medium text-blue-600">{ipv4Count.toLocaleString()}</span> IPv4
            </div>
            <div>
              <span className="font-medium text-green-600">{ipv6Count.toLocaleString()}</span> IPv6
            </div>
            <div>
              <span className="font-medium text-foreground">{networkBorderGroups.length}</span> border groups
            </div>
          </div>
        )}
      </div>

      {count > 0 ? (
        <>
          {/* Data Status */}
          <DataStatus />

          {/* Simplified Filter Controls - Only search and IP type since region/service are locked */}
          <div className="bg-card rounded-lg border p-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1 max-w-md">
                <label htmlFor="search" className="block text-sm font-medium mb-2">
                  Search within results
                </label>
                <input
                  id="search"
                  type="text"
                  placeholder="Search IP prefixes..."
                  value={searchInput}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    // Update input immediately for responsive UI
                    setSearchInput(newValue);
                    // Then debounce the actual filtering
                    debouncedSetFilters(newValue);
                  }}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                />
              </div>
              
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <input
                    id="ipv4"
                    type="checkbox"
                    checked={filters.includeIPv4}
                    onChange={(e) => handleFilterChange({ ...filters, includeIPv4: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="ipv4" className="text-sm">IPv4</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    id="ipv6"
                    type="checkbox"
                    checked={filters.includeIPv6}
                    onChange={(e) => handleFilterChange({ ...filters, includeIPv6: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="ipv6" className="text-sm">IPv6</label>
                </div>
                {(searchInput || !filters.includeIPv4 || !filters.includeIPv6) && (
                  <button
                    onClick={handleClearFilters}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Export Summary */}
          <ExportSummary
            data={filteredAndSortedPrefixes}
            totalCount={count}
            filters={filters}
            sortField={sortField}
            sortDirection={sortDirection}
          />

          {/* Results Table */}
          <PrefixTable
            prefixes={filteredAndSortedPrefixes}
            totalCount={filteredAndSortedPrefixes.length}
            loading={isLoading}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onCopyPrefix={handleCopyPrefix}
            copiedPrefix={copiedPrefix}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />

          {/* Network Border Groups Info */}
          {networkBorderGroups.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="font-medium text-foreground mb-4">
                Network Border Groups ({networkBorderGroups.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {networkBorderGroups.map((group) => (
                  <div
                    key={group}
                    className="px-3 py-2 text-sm bg-card border rounded-md"
                  >
                    {group}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No IP ranges found</h3>
          <p className="text-muted-foreground mb-4">
            {service} service doesn't have any IP ranges in the {region} region.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
            <a
              href={`/regions/${region}`}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
            >
              View all services in {region}
            </a>
            <a
              href="/"
              className="px-4 py-2 border border-input rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Back to search
            </a>
          </div>
        </div>
      )}
    </div>
  );
} 