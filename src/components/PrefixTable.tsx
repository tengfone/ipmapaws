import React from 'react';
import { ChevronUp, ChevronDown, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { CombinedPrefix, SortField, SortDirection } from '@/types';
import { cn, formatNumber } from '@/lib/utils';

interface PrefixTableProps {
  prefixes: CombinedPrefix[];
  totalCount: number;
  loading: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onCopyPrefix: (prefix: string) => void;
  copiedPrefix?: string;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PrefixTable({
  prefixes,
  totalCount,
  loading,
  sortField,
  sortDirection,
  onSort,
  onCopyPrefix,
  copiedPrefix,
  currentPage,
  itemsPerPage,
  onPageChange,
  className,
}: PrefixTableProps) {
  // Calculate pagination info - data is already paginated from server
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  
  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      className="flex items-center space-x-1 hover:text-primary font-medium"
      onClick={() => onSort(field)}
    >
      <span>{children}</span>
      {sortField === field ? (
        sortDirection === 'asc' ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )
      ) : (
        <div className="h-4 w-4" />
      )}
    </button>
  );

  if (loading) {
    return (
      <div className={cn('bg-card rounded-lg border p-6', className)}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-card rounded-lg border overflow-hidden', className)}>
      <div className="p-4 border-b bg-muted/50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            AWS IP Prefixes ({formatNumber(totalCount)})
          </h3>
          {totalCount === 0 && (
            <p className="text-sm text-muted-foreground">
              No results found. Try adjusting your filters.
            </p>
          )}
        </div>
      </div>

      {totalCount > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left p-4 text-sm font-medium">
                  <SortButton field="prefix">IP Prefix</SortButton>
                </th>
                <th className="text-left p-4 text-sm font-medium">
                  <SortButton field="region">Region</SortButton>
                </th>
                <th className="text-left p-4 text-sm font-medium">
                  <SortButton field="service">Service</SortButton>
                </th>
                <th className="text-left p-4 text-sm font-medium">
                  <SortButton field="network_border_group">Network Border Group</SortButton>
                </th>
                <th className="text-left p-4 text-sm font-medium">Type</th>
                <th className="text-left p-4 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {prefixes.map((prefix, index) => (
                <tr
                  key={`${prefix.prefix}-${index}`}
                  className="border-b hover:bg-muted/50 transition-colors"
                >
                  <td className="p-4">
                    <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                      {prefix.prefix}
                    </code>
                  </td>
                  <td className="p-4 text-sm">{prefix.region}</td>
                  <td className="p-4 text-sm">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {prefix.service}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {prefix.network_border_group}
                  </td>
                  <td className="p-4 text-sm">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                        prefix.type === 'ipv4'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      )}
                    >
                      {prefix.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCopyPrefix(prefix.prefix)}
                      className="h-8 w-8 p-0"
                      title={`Copy ${prefix.prefix}`}
                    >
                      {copiedPrefix === prefix.prefix ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalCount === 0 && !loading && (
        <div className="p-12 text-center">
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
          <p className="text-muted-foreground">
            Try adjusting your search criteria or clearing the filters.
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && totalPages > 1 && (
        <div className="p-4 border-t">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            totalItems={totalCount}
            itemsPerPage={itemsPerPage}
          />
        </div>
      )}
    </div>
  );
} 