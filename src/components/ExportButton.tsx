import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButtonProps, ExportResponse } from '@/types';
import { exportToCSV } from '@/lib/utils';

type ExportState =
  | { status: 'idle' }
  | { status: 'exporting' }
  | { status: 'done'; rows: number }
  | { status: 'error'; message: string };

const STAMP_MS = 4000;

interface Props extends ExportButtonProps {
  /** Rows the current filters match; 0 disables the button. */
  totalCount?: number;
}

/**
 * Exports every row the current filters match (not just the visible page)
 * through the export endpoint, then stamps the result on the button itself.
 */
export function ExportButton({
  filters,
  sortField,
  sortDirection,
  filename,
  disabled = false,
  totalCount,
  className,
}: Props) {
  const [state, setState] = useState<ExportState>({ status: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const settle = (next: ExportState) => {
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState({ status: 'idle' }), STAMP_MS);
  };

  const handleExport = async () => {
    setState({ status: 'exporting' });
    try {
      const params = new URLSearchParams();
      if (filters.regions.length > 0)
        params.set('regions', filters.regions.join(','));
      if (filters.services.length > 0)
        params.set('services', filters.services.join(','));
      if (filters.searchTerm) params.set('searchTerm', filters.searchTerm);
      params.set('includeIPv4', filters.includeIPv4.toString());
      params.set('includeIPv6', filters.includeIPv6.toString());
      params.set('sortField', sortField);
      params.set('sortDirection', sortDirection);

      const response = await fetch(`/api/aws-ip-ranges/export?${params}`);
      if (response.status === 429) {
        settle({
          status: 'error',
          message: 'Export limit reached, try again in a few minutes',
        });
        return;
      }
      if (!response.ok) {
        settle({ status: 'error', message: 'Export failed, try again' });
        return;
      }

      const exportData: ExportResponse = await response.json();
      if (exportData.data.length === 0) {
        settle({ status: 'error', message: 'Nothing to export' });
        return;
      }

      const date = new Date().toISOString().split('T')[0];
      exportToCSV(exportData.data, filename ?? `aws-ip-ranges-${date}.csv`);
      settle({ status: 'done', rows: exportData.data.length });
    } catch (error) {
      console.error('Export failed:', error);
      settle({ status: 'error', message: 'Export failed, try again' });
    }
  };

  const empty = totalCount === 0;
  const label =
    state.status === 'exporting'
      ? 'Exporting…'
      : state.status === 'done'
        ? `Exported ${state.rows.toLocaleString('en-US')} rows`
        : state.status === 'error'
          ? state.message
          : 'Export CSV';

  return (
    <div className={className}>
      <Button
        onClick={handleExport}
        disabled={disabled || empty || state.status === 'exporting'}
        variant={
          state.status === 'idle' || state.status === 'exporting'
            ? 'default'
            : 'outline'
        }
        className={
          state.status === 'error'
            ? 'border-danger text-danger hover:bg-transparent'
            : state.status === 'done'
              ? 'border-sage-ink text-sage-ink'
              : undefined
        }
        title={
          totalCount !== undefined && totalCount > 0
            ? `Download all ${totalCount.toLocaleString('en-US')} matching rows as CSV`
            : undefined
        }
      >
        {state.status === 'exporting' ? (
          <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} />
        ) : state.status === 'done' ? (
          <Check className="size-4" strokeWidth={2} />
        ) : (
          <Download className="size-4" strokeWidth={1.75} />
        )}
        <span aria-live="polite">{label}</span>
      </Button>
    </div>
  );
}
