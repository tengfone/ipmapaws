import React, { useId } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SearchableMultiSelect } from '@/components/ui/searchable-multi-select';
import { FilterOptions } from '@/types';
import { cn } from '@/lib/utils';

interface FilterControlsProps {
  regions: string[];
  services: string[];
  filters: FilterOptions;
  searchInput?: string;
  onFilterChange: (filters: FilterOptions) => void;
  onSearchChange?: (value: string) => void;
  onClearFilters: () => void;
  /** Hide the region picker (on a region's own page). */
  showRegions?: boolean;
  /** Hide the service picker (on a region/service page). */
  showServices?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

/** The filter row over the register: search, regions, services, IP version. */
export function FilterControls({
  regions,
  services,
  filters,
  searchInput,
  onFilterChange,
  onSearchChange,
  onClearFilters,
  showRegions = true,
  showServices = true,
  searchPlaceholder = 'Search prefix, region, service',
  className,
}: FilterControlsProps) {
  const id = useId();
  const currentSearchTerm =
    searchInput !== undefined ? searchInput : filters.searchTerm;

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      onFilterChange({ ...filters, searchTerm: value });
    }
  };

  const hasActiveFilters =
    (showRegions && filters.regions.length > 0) ||
    (showServices && filters.services.length > 0) ||
    currentSearchTerm.trim() !== '' ||
    !filters.includeIPv4 ||
    !filters.includeIPv6;

  return (
    <div
      role="search"
      aria-label="Filter prefixes"
      className={cn(
        'flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start',
        className
      )}
    >
      <div className="relative min-w-0 lg:w-[22rem]">
        <label htmlFor={`${id}-search`} className="sr-only">
          Search prefixes
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-3 size-4 text-ink-2"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <Input
          id={`${id}-search`}
          type="search"
          placeholder={searchPlaceholder}
          value={currentSearchTerm}
          onChange={handleSearchChange}
          autoComplete="off"
          spellCheck={false}
          className="pl-9"
        />
      </div>

      <div
        className={cn(
          'grid min-w-0 gap-3 lg:contents',
          showRegions && showServices ? 'sm:grid-cols-2' : 'sm:grid-cols-1'
        )}
      >
        {showRegions && (
          <SearchableMultiSelect
            className="lg:w-52"
            label="Regions"
            options={regions}
            selected={filters.regions}
            onChange={(selected) =>
              onFilterChange({ ...filters, regions: selected })
            }
            placeholder={
              regions.length ? `All regions (${regions.length})` : 'All regions'
            }
            searchPlaceholder="Find a region"
            chipStyle="region"
          />
        )}
        {showServices && (
          <SearchableMultiSelect
            className="lg:w-52"
            label="Services"
            options={services}
            selected={filters.services}
            onChange={(selected) =>
              onFilterChange({ ...filters, services: selected })
            }
            placeholder={
              services.length
                ? `All services (${services.length})`
                : 'All services'
            }
            searchPlaceholder="Find a service"
          />
        )}
      </div>

      <fieldset className="flex h-10 items-center gap-4">
        <legend className="sr-only">IP version</legend>
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={filters.includeIPv4}
            onChange={(e) =>
              onFilterChange({ ...filters, includeIPv4: e.target.checked })
            }
            className="size-4"
          />
          IPv4
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={filters.includeIPv6}
            onChange={(e) =>
              onFilterChange({ ...filters, includeIPv6: e.target.checked })
            }
            className="size-4"
          />
          IPv6
        </label>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-ink-2 hover:text-ink"
          >
            <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
            Clear filters
          </button>
        )}
      </fieldset>
    </div>
  );
}
