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

interface RegionPageProps {
  region: string;
}

export default function RegionPage({ region }: RegionPageProps) {
  const { prefixes, count, isLoading, error } = useFilteredIPRanges(region);
  
  // State for additional filtering within the region
  const [filters, setFilters] = useState<FilterOptions>({
    regions: [region], // Pre-filtered to this region
    services: [],
    searchTerm: '',
    includeIPv4: true,
    includeIPv6: true,
  });
  
  const [sortField, setSortField] = useState<SortField>('prefix');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [copiedPrefix, setCopiedPrefix] = useState<string | undefined>();

  // Get unique services for this region
  const availableServices = useMemo(() => {
    const services = new Set(prefixes.map(p => p.service));
    return Array.from(services).sort();
  }, [prefixes]);

  // Optimized filter handler with startTransition
  const debouncedSetFilters = useMemo(
    () => debounce((newFilters: FilterOptions) => {
      startTransition(() => {
        setFilters(newFilters);
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
    // Ensure region filter stays locked
    debouncedSetFilters({
      ...newFilters,
      regions: [region],
    });
  }, [region, debouncedSetFilters]);

  const handleClearFilters = useCallback(() => {
    setFilters({
      regions: [region],
      services: [],
      searchTerm: '',
      includeIPv4: true,
      includeIPv6: true,
    });
  }, [region]);

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
            Failed to load IP ranges for region {region}.
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
        <div className="flex items-center justify-center space-x-2">
          <a 
            href="/" 
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            IPMapAWS
          </a>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">regions</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{region}</span>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight">
          {region} AWS IP Ranges
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          AWS IP address ranges for the {region} region. 
          Browse {count.toLocaleString()} IP prefixes across {availableServices.length} services.
        </p>
        
        <div className="flex items-center justify-center space-x-8 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">{count.toLocaleString()}</span> total prefixes
          </div>
          <div>
            <span className="font-medium text-foreground">{availableServices.length}</span> services
          </div>
          <div>
            <span className="font-medium text-blue-600">{ipv4Count.toLocaleString()}</span> IPv4
          </div>
          <div>
            <span className="font-medium text-green-600">{ipv6Count.toLocaleString()}</span> IPv6
          </div>
        </div>
      </div>

      {/* Data Status */}
      <DataStatus />

      {/* Filter Controls - Services only since region is locked */}
      <FilterControls
        regions={[region]} // Only show current region
        services={availableServices}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

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

      {/* Navigation Links */}
      <div className="bg-muted/50 rounded-lg p-6">
        <h3 className="font-medium text-foreground mb-4">Explore Services in {region}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {availableServices.map((service) => (
            <a
              key={service}
              href={`/regions/${region}/services/${service}`}
              className="px-3 py-2 text-sm bg-card border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {service}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
} 