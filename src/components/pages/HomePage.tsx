'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  apiExportSource,
  ExportControls,
  ExportSource,
} from '@/components/ExportControls';
import { FilterControls } from '@/components/FilterControls';
import { PrefixLookup } from '@/components/PrefixLookup';
import { PrefixTable } from '@/components/PrefixTable';
import { useAWSIPRanges, useAWSIPRangesSearch } from '@/hooks/useAWSIPRanges';
import { useViewParams } from '@/hooks/useUrlState';
import { filterPrefixes, sortPrefixes } from '@/lib/api';
import { DEFAULT_VIEW } from '@/lib/url-state';
import { debounce } from '@/lib/utils';
import { FilterOptions, SortField } from '@/types';

const ITEMS_PER_PAGE = 50;

/** Register filters as the export API's query parameters. */
function exportParams(
  filters: FilterOptions,
  sortField: SortField,
  sortDirection: string
) {
  const params = new URLSearchParams();
  if (filters.regions.length > 0)
    params.set('regions', filters.regions.join(','));
  if (filters.services.length > 0)
    params.set('services', filters.services.join(','));
  if (filters.searchTerm) params.set('searchTerm', filters.searchTerm);
  params.set('includeIPv4', String(filters.includeIPv4));
  params.set('includeIPv6', String(filters.includeIPv6));
  params.set('sortField', sortField);
  params.set('sortDirection', sortDirection);
  return params;
}

export default function HomePage() {
  // Lookup and register state live in the URL (see useViewParams), so any
  // view can be shared and reloaded.
  const [view, updateView] = useViewParams();
  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const [bestPrefix, setBestPrefix] = useState<string | null>(null);

  const filters: FilterOptions = useMemo(
    () => ({
      regions: view.regions,
      services: view.services,
      searchTerm: view.q,
      includeIPv4: view.v4,
      includeIPv6: view.v6,
    }),
    [view]
  );
  const { sortField, sortDirection, page } = view;
  const searchInput = searchDraft ?? view.q;

  const {
    data,
    regions,
    services,
    combinedPrefixes,
    error: metadataError,
  } = useAWSIPRanges();
  const {
    data: searchResults,
    pagination,
    isLoading: searchLoading,
    error: searchError,
  } = useAWSIPRangesSearch(
    page,
    ITEMS_PER_PAGE,
    filters,
    sortField,
    sortDirection
  );

  const debouncedSetSearchTerm = useMemo(
    () =>
      debounce((q: string) => {
        updateView({ q, page: 1 });
        setSearchDraft((draft) => (draft === q ? null : draft));
      }, 300),
    [updateView]
  );

  const handleFilterChange = useCallback(
    (next: FilterOptions) => {
      updateView({
        regions: next.regions,
        services: next.services,
        v4: next.includeIPv4,
        v6: next.includeIPv6,
        page: 1,
      });
    },
    [updateView]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchDraft(value);
      debouncedSetSearchTerm(value);
    },
    [debouncedSetSearchTerm]
  );

  const handleClearFilters = useCallback(() => {
    setSearchDraft(null);
    updateView({ ...DEFAULT_VIEW, ip: view.ip });
  }, [updateView, view.ip]);

  const handleSort = useCallback(
    (field: SortField) => {
      updateView({
        sortField: field,
        sortDirection:
          sortField === field && sortDirection === 'asc' ? 'desc' : 'asc',
        page: 1,
      });
    },
    [updateView, sortField, sortDirection]
  );

  const handleShowInRegister = useCallback(
    (prefix: string) => {
      setSearchDraft(null);
      updateView({ ...DEFAULT_VIEW, ip: view.ip, q: prefix });
      document.getElementById('register')?.scrollIntoView({ block: 'start' });
    },
    [updateView, view.ip]
  );

  const total = pagination.total;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // A shared link may point past the last page of today's data.
  useEffect(() => {
    if (!searchLoading && total > 0 && page > totalPages)
      updateView({ page: 1 });
  }, [searchLoading, total, page, totalPages, updateView]);

  // The full dataset is usually already in the browser for the lookup, so
  // exports format it locally; until then they go through the export API.
  const exportSource: ExportSource = useMemo(() => {
    if (combinedPrefixes.length > 0) {
      return {
        records: async () =>
          sortPrefixes(
            filterPrefixes(combinedPrefixes, filters),
            sortField,
            sortDirection
          ),
      };
    }
    return apiExportSource(exportParams(filters, sortField, sortDirection));
  }, [combinedPrefixes, filters, sortField, sortDirection]);

  const error = metadataError || searchError;

  return (
    <div className="page pt-8 sm:pt-10">
      <PrefixLookup
        headingAs="h1"
        query={view.ip}
        onQuery={(ip) => updateView({ ip })}
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
          <ExportControls
            source={exportSource}
            filenameBase="aws-ip-ranges"
            totalCount={searchLoading ? undefined : total}
            createDate={data?.createDate}
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
            onPageChange={(next) => updateView({ page: next })}
            highlightPrefix={bestPrefix}
            onClearFilters={handleClearFilters}
          />
        )}
      </section>
    </div>
  );
}
