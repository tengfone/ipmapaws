'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { ExportControls, ExportSource } from '@/components/ExportControls';
import { FilterControls } from '@/components/FilterControls';
import { PrefixTable } from '@/components/PrefixTable';
import { useViewParams } from '@/hooks/useUrlState';
import { filterPrefixes, sortPrefixes } from '@/lib/api';
import { debounce } from '@/lib/utils';
import { CombinedPrefix, FilterOptions, SortField } from '@/types';

const ITEMS_PER_PAGE = 50;

interface LocalRegisterProps {
  /** Every prefix for this page (already scoped to the region and service). */
  prefixes: CombinedPrefix[];
  region: string;
  service?: string;
  loading?: boolean;
  heading: string;
  /** AWS createDate, written into allow-list headers. */
  createDate?: string;
}

/**
 * The register for a region or region/service page. The rows are already in
 * the page (server-rendered), so filtering, sorting, paging and every export
 * format run locally. Filters live in the URL (?q=, ?services=, ?v=, ?sort=,
 * ?page=) so a filtered view can be shared; the region (and service) come
 * from the path and stay locked.
 */
export function LocalRegister({
  prefixes,
  region,
  service,
  loading = false,
  heading,
  createDate,
}: LocalRegisterProps) {
  const [view, updateView] = useViewParams();
  const [searchDraft, setSearchDraft] = useState<string | null>(null);

  const filters = useMemo<FilterOptions>(
    () => ({
      regions: [region],
      services: service ? [service] : view.services,
      searchTerm: view.q,
      includeIPv4: view.v4,
      includeIPv6: view.v6,
    }),
    [region, service, view]
  );
  const { sortField, sortDirection } = view;
  const searchInput = searchDraft ?? view.q;

  const availableServices = useMemo(
    () => Array.from(new Set(prefixes.map((p) => p.service))).sort(),
    [prefixes]
  );

  const debouncedSetSearchTerm = useMemo(
    () =>
      debounce((q: string) => {
        updateView({ q, page: 1 });
        setSearchDraft((draft) => (draft === q ? null : draft));
      }, 150),
    [updateView]
  );

  const rows = useMemo(
    () =>
      sortPrefixes(filterPrefixes(prefixes, filters), sortField, sortDirection),
    [prefixes, filters, sortField, sortDirection]
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
  const currentPage = view.page <= totalPages ? view.page : 1;
  const pagedRows = useMemo(
    () =>
      rows.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
      ),
    [rows, currentPage]
  );

  const handleFilterChange = useCallback(
    (next: FilterOptions) => {
      updateView({
        services: service ? [] : next.services,
        v4: next.includeIPv4,
        v6: next.includeIPv6,
        page: 1,
      });
    },
    [service, updateView]
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
    updateView({
      q: '',
      services: [],
      v4: true,
      v6: true,
      sortField: 'prefix',
      sortDirection: 'asc',
      page: 1,
    });
  }, [updateView]);

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

  const exportSource: ExportSource = useMemo(
    () => ({ records: async () => rows }),
    [rows]
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
        <ExportControls
          source={exportSource}
          filenameBase={`aws-ip-ranges-${region}${service ? `-${service}` : ''}`}
          totalCount={rows.length}
          createDate={createDate}
          scope={service ? `${service} in ${region}` : region}
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
          service ? 'Search prefix or border group' : 'Search prefix or service'
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
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={(page) => updateView({ page })}
        onClearFilters={handleClearFilters}
        linkRegions={false}
      />
    </section>
  );
}
