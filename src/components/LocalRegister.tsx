'use client';

import React, { useCallback, useMemo, useState, startTransition } from 'react';
import { ExportButton } from '@/components/ExportButton';
import { FilterControls } from '@/components/FilterControls';
import { PrefixTable } from '@/components/PrefixTable';
import { usePagination } from '@/components/ui/pagination';
import { filterPrefixes, sortPrefixes } from '@/lib/api';
import { debounce } from '@/lib/utils';
import {
  CombinedPrefix,
  FilterOptions,
  SortDirection,
  SortField,
} from '@/types';

interface LocalRegisterProps {
  /** Every prefix for this page (already scoped to the region and service). */
  prefixes: CombinedPrefix[];
  region: string;
  service?: string;
  loading?: boolean;
  heading: string;
}

/**
 * The register for a region or region/service page. The rows are already in
 * the page (server-rendered), so filtering, sorting and paging run locally;
 * the export goes through the API so the CSV matches the home page's export.
 */
export function LocalRegister({
  prefixes,
  region,
  service,
  loading = false,
  heading,
}: LocalRegisterProps) {
  const lockedFilters = useMemo<FilterOptions>(
    () => ({
      regions: [region],
      services: service ? [service] : [],
      searchTerm: '',
      includeIPv4: true,
      includeIPv6: true,
    }),
    [region, service]
  );

  const [filters, setFilters] = useState<FilterOptions>(lockedFilters);
  const [searchInput, setSearchInput] = useState('');
  const [sortField, setSortField] = useState<SortField>('prefix');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const availableServices = useMemo(
    () => Array.from(new Set(prefixes.map((p) => p.service))).sort(),
    [prefixes]
  );

  const debouncedSetSearchTerm = useMemo(
    () =>
      debounce((searchTerm: string) => {
        startTransition(() => setFilters((prev) => ({ ...prev, searchTerm })));
      }, 150),
    []
  );

  const rows = useMemo(
    () =>
      sortPrefixes(filterPrefixes(prefixes, filters), sortField, sortDirection),
    [prefixes, filters, sortField, sortDirection]
  );

  const { currentPage, setCurrentPage, itemsPerPage } = usePagination(
    rows.length,
    50
  );
  const pagedRows = useMemo(
    () =>
      rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [rows, currentPage, itemsPerPage]
  );

  const handleFilterChange = useCallback(
    (next: FilterOptions) => {
      // The page's own region (and service) stay locked.
      setFilters({
        ...next,
        regions: [region],
        services: service ? [service] : next.services,
      });
      setCurrentPage(1);
    },
    [region, service, setCurrentPage]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      debouncedSetSearchTerm(value);
    },
    [debouncedSetSearchTerm]
  );

  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    setFilters(lockedFilters);
    setCurrentPage(1);
  }, [lockedFilters, setCurrentPage]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField]
  );

  return (
    <section
      id="register"
      aria-labelledby="register-heading"
      className="mt-12 border-t border-ink pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-baseline gap-3">
          <h2
            id="register-heading"
            className="text-lg font-bold tracking-[-0.01em] text-ink"
          >
            {heading}
          </h2>
          <p className="text-sm text-ink-2" aria-live="polite">
            <span className="font-mono font-semibold text-ink">
              {rows.length.toLocaleString('en-US')}
            </span>{' '}
            {rows.length === 1 ? 'prefix' : 'prefixes'}
            {rows.length !== prefixes.length && (
              <> of {prefixes.length.toLocaleString('en-US')}</>
            )}
          </p>
        </div>
        <ExportButton
          filters={filters}
          sortField={sortField}
          sortDirection={sortDirection}
          totalCount={rows.length}
          filename={`aws-ip-ranges-${region}${service ? `-${service}` : ''}.csv`}
        />
      </div>

      <FilterControls
        className="mt-4"
        regions={[region]}
        services={availableServices}
        filters={filters}
        searchInput={searchInput}
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
        onClearFilters={handleClearFilters}
        showRegions={false}
        showServices={!service}
        searchPlaceholder={
          service
            ? 'Search prefix or border group'
            : 'Search prefix or service'
        }
      />

      <PrefixTable
        className="mt-5"
        caption={
          service
            ? `${service} prefixes in ${region}`
            : `AWS prefixes in ${region}`
        }
        prefixes={pagedRows}
        totalCount={rows.length}
        loading={loading}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onClearFilters={handleClearFilters}
        linkRegions={false}
      />
    </section>
  );
}
