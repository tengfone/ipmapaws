import React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';
import { Pagination } from '@/components/ui/pagination';
import { CombinedPrefix, SortField, SortDirection } from '@/types';
import { cn } from '@/lib/utils';

interface PrefixTableProps {
  prefixes: CombinedPrefix[];
  totalCount: number;
  loading: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  /** Prefix to mark as the matched lot (from the lookup). */
  highlightPrefix?: string | null;
  /** Offered in the empty state when filters can be cleared. */
  onClearFilters?: () => void;
  /** Link region labels to their region page (off on a region's own page). */
  linkRegions?: boolean;
  caption: string;
  className?: string;
}

const COLUMNS: Array<{ field: SortField; label: string }> = [
  { field: 'prefix', label: 'Prefix' },
  { field: 'region', label: 'Region' },
  { field: 'service', label: 'Service' },
  { field: 'network_border_group', label: 'Network border group' },
];

function SortHeader({
  field,
  label,
  sortField,
  sortDirection,
  onSort,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const active = sortField === field;
  const Icon = !active
    ? ArrowUpDown
    : sortDirection === 'asc'
      ? ArrowUp
      : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className="h-9 px-3 text-left align-middle"
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-[12px] font-semibold hover:text-ink',
          active ? 'text-ink' : 'text-ink-2'
        )}
      >
        {label}
        <Icon
          className={cn('size-3.5', active ? 'text-ink' : 'text-ink-2/70')}
          strokeWidth={active ? 2.25 : 1.75}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

/** A region name in the sage label style. Never shrinks or wraps. */
export function RegionLabel({
  region,
  href,
}: {
  region: string;
  href?: string;
}) {
  const className =
    'inline-flex min-w-[8.5rem] shrink-0 justify-center whitespace-nowrap rounded-sm border border-sage px-2 py-0.5 font-mono text-[12px] text-ink';
  return href ? (
    <Link href={href} className={cn(className, 'hover:bg-sage-tint')}>
      {region}
    </Link>
  ) : (
    <span className={className}>{region}</span>
  );
}

/** The lot register: every prefix the filters match, one page at a time. */
export function PrefixTable({
  prefixes,
  totalCount,
  loading,
  sortField,
  sortDirection,
  onSort,
  currentPage,
  itemsPerPage,
  onPageChange,
  highlightPrefix,
  onClearFilters,
  linkRegions = true,
  caption,
  className,
}: PrefixTableProps) {
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const sortProps = { sortField, sortDirection, onSort };
  const offset = (currentPage - 1) * itemsPerPage;
  const showSkeleton = loading && prefixes.length === 0;
  const isEmpty = !loading && totalCount === 0;

  return (
    <div className={cn('min-w-0', className)}>
      {!isEmpty && (
        <div
          className={cn(
            'relative overflow-x-auto border-y border-ink transition-opacity',
            loading && prefixes.length > 0 && 'opacity-55'
          )}
          aria-busy={loading}
        >
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-ink">
                <th
                  scope="col"
                  className="h-9 w-20 whitespace-nowrap px-3 text-left text-[12px] font-semibold text-ink-2"
                >
                  Lot no.
                </th>
                {COLUMNS.map((col) => (
                  <SortHeader
                    key={col.field}
                    field={col.field}
                    label={col.label}
                    {...sortProps}
                  />
                ))}
                <th
                  scope="col"
                  className="h-9 px-3 text-left text-[12px] font-semibold text-ink-2"
                >
                  Version
                </th>
                <th
                  scope="col"
                  className="h-9 w-24 px-3 text-right text-[12px] font-semibold text-ink-2"
                >
                  <span className="sr-only">Copy</span>
                </th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px]">
              {showSkeleton &&
                Array.from({ length: 8 }, (_, i) => (
                  <tr
                    key={i}
                    className="h-[42px] border-b border-rule-2"
                    aria-hidden="true"
                  >
                    <td colSpan={7} className="px-3">
                      <span
                        className="block h-2 rounded-sm bg-rule-2"
                        style={{ width: `${40 + ((i * 17) % 45)}%` }}
                      />
                    </td>
                  </tr>
                ))}
              {prefixes.map((prefix, index) => {
                const selected = highlightPrefix === prefix.prefix;
                return (
                  <tr
                    key={`${prefix.prefix}-${prefix.service}-${prefix.region}-${index}`}
                    className={cn(
                      'h-[42px] border-b border-rule-2 transition-colors',
                      selected ? 'bg-sage-tint' : 'hover:bg-paper'
                    )}
                    aria-current={selected ? 'true' : undefined}
                  >
                    <td className="px-3 font-semibold text-sage-ink">
                      {offset + index + 1}
                    </td>
                    <td
                      className={cn(
                        'px-3 font-medium',
                        selected ? 'text-mark-ink' : 'text-ink'
                      )}
                    >
                      {prefix.prefix}
                    </td>
                    <td className="px-3">
                      <RegionLabel
                        region={prefix.region}
                        href={
                          linkRegions
                            ? `/regions/${encodeURIComponent(prefix.region)}`
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-3 text-ink">{prefix.service}</td>
                    <td className="px-3 text-ink-2">
                      {prefix.network_border_group}
                    </td>
                    <td className="px-3 text-ink-2">
                      {prefix.type === 'ipv4' ? 'IPv4' : 'IPv6'}
                    </td>
                    <td className="px-3 text-right">
                      <CopyButton
                        value={prefix.prefix}
                        subject={prefix.prefix}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showSkeleton && (
        <p className="mt-3 text-[13px] text-ink-2">Loading prefixes…</p>
      )}

      {isEmpty && (
        <div className="border-y border-ink py-10 text-center">
          <p className="font-semibold text-ink">
            No prefixes match these filters
          </p>
          <p className="mt-1 text-sm text-ink-2">
            Widen the search, or include both IPv4 and IPv6.
          </p>
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-4 inline-flex h-8 items-center rounded-md border border-ink px-3 text-[13px] font-semibold text-ink hover:bg-sage-tint"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {totalCount > 0 && totalPages > 1 && (
        <Pagination
          className="mt-4"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          totalItems={totalCount}
          itemsPerPage={itemsPerPage}
        />
      )}
    </div>
  );
}
