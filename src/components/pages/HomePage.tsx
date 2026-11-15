'use client';

import React, { useState, useCallback, useMemo, startTransition } from 'react';
import { ExportButton } from '@/components/ExportButton';
import { FilterControls } from '@/components/FilterControls';
import { PrefixLookup } from '@/components/PrefixLookup';
import { PrefixTable } from '@/components/PrefixTable';
import { useAWSIPRanges, useAWSIPRangesSearch } from '@/hooks/useAWSIPRanges';
import { FilterOptions, SortField, SortDirection } from '@/types';
import { debounce } from '@/lib/utils';

const defaultFilters: FilterOptions = {
  regions: [],
  services: [],
  searchTerm: '',
  includeIPv4: true,
  includeIPv6: true,
};

const ITEMS_PER_PAGE = 50;

export default function HomePage() {
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);
  const [searchInput, setSearchInput] = useState('');
  const [sortField, setSortField] = useState<SortField>('prefix');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [bestPrefix, setBestPrefix] = useState<string | null>(null);

  const { regions, services, error: metadataError } = useAWSIPRanges();
  const {
    data: searchResults,
    pagination,
    isLoading: searchLoading,
    error: searchError,
  } = useAWSIPRangesSearch(
    currentPage,
    ITEMS_PER_PAGE,
    filters,
    sortField,
    sortDirection
  );

  const debouncedSetSearchTerm = useMemo(
    () =>
      debounce((searchTerm: string) => {
        startTransition(() => {
          setFilters((prev) => ({ ...prev, searchTerm }));
          setCurrentPage(1);
        });
      }, 300),
    []
  );

  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      debouncedSetSearchTerm(value);
    },
    [debouncedSetSearchTerm]
  );

  const handleClearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSearchInput('');
    setCurrentPage(1);
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
      setCurrentPage(1);
    },
    [sortField]
  );

  const handleShowInRegister = useCallback((prefix: string) => {
    setSearchInput(prefix);
    setFilters({ ...defaultFilters, searchTerm: prefix });
    setCurrentPage(1);
    document.getElementById('register')?.scrollIntoView({ block: 'start' });
  }, []);

  const error = metadataError || searchError;
  const total = pagination.total;

  return (
    <div className="page pt-8 sm:pt-10">
      <PrefixLookup
        headingAs="h1"
        onBestMatch={setBestPrefix}
        onShowInRegister={handleShowInRegister}
      />

      <section
        id="register"
        aria-labelledby="register-heading"
        className="mt-14 scroll-mt-6 border-t border-ink pt-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex items-baseline gap-3">
            <h2
              id="register-heading"
              className="text-lg font-bold tracking-[-0.01em] text-ink"
            >
              Prefix register
            </h2>
            <p className="text-sm text-ink-2" aria-live="polite">
              {searchLoading && total === 0 ? (
                'Counting prefixes…'
              ) : (
                <>
                  <span className="font-mono font-semibold text-ink">
                    {total.toLocaleString('en-US')}
                  </span>{' '}
                  {total === 1 ? 'prefix' : 'prefixes'}
                  {searchLoading && (
                    <span className="sr-only"> (updating)</span>
                  )}
                </>
              )}
            </p>
          </div>
          <ExportButton
            filters={filters}
            sortField={sortField}
            sortDirection={sortDirection}
            totalCount={searchLoading ? undefined : total}
          />
        </div>

        <FilterControls
          className="mt-4"
          regions={regions}
          services={services}
          filters={filters}
          searchInput={searchInput}
          onFilterChange={handleFilterChange}
          onSearchChange={handleSearchChange}
          onClearFilters={handleClearFilters}
        />

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-danger px-4 py-3 text-sm"
          >
            <p className="font-semibold text-danger">
              The register could not be loaded
            </p>
            <p className="mt-1 text-ink">
              {error?.message || 'Failed to load AWS IP ranges.'} Reload the
              page to try again; the lookup above still works once the ranges
              load.
            </p>
          </div>
        ) : (
          <PrefixTable
            className="mt-5"
            caption="AWS IP prefixes matching the filters"
            prefixes={searchResults}
            totalCount={total}
            loading={searchLoading}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            currentPage={pagination.page}
            itemsPerPage={pagination.limit}
            onPageChange={setCurrentPage}
            highlightPrefix={bestPrefix}
            onClearFilters={handleClearFilters}
          />
        )}
      </section>
    </div>
  );
}
