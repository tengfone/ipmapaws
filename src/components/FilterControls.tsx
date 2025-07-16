import React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  className?: string;
}

export function FilterControls({
  regions,
  services,
  filters,
  searchInput,
  onFilterChange,
  onSearchChange,
  onClearFilters,
  className,
}: FilterControlsProps) {
  const handleRegionChange = (selectedRegions: string[]) => {
    onFilterChange({
      ...filters,
      regions: selectedRegions,
    });
  };

  const handleServiceChange = (selectedServices: string[]) => {
    onFilterChange({
      ...filters,
      services: selectedServices,
    });
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (onSearchChange) {
      // Use the debounced search handler if provided
      onSearchChange(value);
    } else {
      // Fallback to direct filter change for backward compatibility
      onFilterChange({
        ...filters,
        searchTerm: value,
      });
    }
  };

  const handleIPv4Toggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filters,
      includeIPv4: event.target.checked,
    });
  };

  const handleIPv6Toggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filters,
      includeIPv6: event.target.checked,
    });
  };

  const currentSearchTerm = searchInput !== undefined ? searchInput : filters.searchTerm;
  const hasActiveFilters = 
    filters.regions.length > 0 ||
    filters.services.length > 0 ||
    currentSearchTerm.trim() !== '' ||
    !filters.includeIPv4 ||
    !filters.includeIPv6;

  return (
    <div className={cn('space-y-4 p-6 bg-card rounded-lg border', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Filter AWS IP Ranges</h2>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search Input */}
        <div className="space-y-2">
          <label htmlFor="search" className="text-sm font-medium">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              type="text"
              placeholder="Search prefixes, regions, services..."
              value={searchInput !== undefined ? searchInput : filters.searchTerm}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
        </div>

        {/* Region Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Regions
          </label>
          <SearchableMultiSelect
            options={regions}
            selected={filters.regions}
            onChange={handleRegionChange}
            placeholder="Select regions..."
            searchPlaceholder="Search regions..."
          />
        </div>

        {/* Service Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Services
          </label>
          <SearchableMultiSelect
            options={services}
            selected={filters.services}
            onChange={handleServiceChange}
            placeholder="Select services..."
            searchPlaceholder="Search services..."
          />
        </div>

        {/* IP Type Filters */}
        <div className="space-y-2">
          <label className="text-sm font-medium">IP Type</label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                id="ipv4"
                type="checkbox"
                checked={filters.includeIPv4}
                onChange={handleIPv4Toggle}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="ipv4" className="text-sm">
                IPv4
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="ipv6"
                type="checkbox"
                checked={filters.includeIPv6}
                onChange={handleIPv6Toggle}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="ipv6" className="text-sm">
                IPv6
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 