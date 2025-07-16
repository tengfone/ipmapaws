import React, { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButtonProps, ExportResponse, CombinedPrefix } from '@/types';
import { exportToCSV, formatNumber } from '@/lib/utils';

export function ExportButton({
  filters,
  sortField,
  sortDirection,
  filename = 'aws-ip-ranges.csv',
  disabled = false,
  className,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [totalRecords, setTotalRecords] = useState<number | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);

      // Build query parameters for export endpoint
      const params = new URLSearchParams();
      
      if (filters.regions.length > 0) {
        params.set('regions', filters.regions.join(','));
      }
      if (filters.services.length > 0) {
        params.set('services', filters.services.join(','));
      }
      if (filters.searchTerm) {
        params.set('searchTerm', filters.searchTerm);
      }
      params.set('includeIPv4', filters.includeIPv4.toString());
      params.set('includeIPv6', filters.includeIPv6.toString());
      params.set('sortField', sortField);
      params.set('sortDirection', sortDirection);

      // Fetch all matching data from export endpoint
      const response = await fetch(`/api/aws-ip-ranges/export?${params}`);
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      const exportData: ExportResponse = await response.json();
      
      if (exportData.data.length === 0) {
        alert('No data to export with current filters');
        return;
      }

      // Update total records for display
      setTotalRecords(exportData.total);

      // Export to CSV
      exportToCSV(exportData.data, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export CSV file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={className}>
      <Button
        onClick={handleExport}
        disabled={disabled || isExporting}
        variant="outline"
        className="flex items-center space-x-2"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        <span>{isExporting ? 'Exporting...' : 'Export to CSV'}</span>
        {totalRecords !== null && (
          <span className="text-muted-foreground text-sm">
            ({formatNumber(totalRecords)} records)
          </span>
        )}
      </Button>
      
      {isExporting && (
        <p className="text-xs text-muted-foreground mt-2">
          Fetching all matching records for export...
        </p>
      )}
    </div>
  );
}

interface ExportSummaryProps {
  data: CombinedPrefix[];
  totalCount: number;
  filters: ExportButtonProps['filters'];
  sortField: ExportButtonProps['sortField'];
  sortDirection: ExportButtonProps['sortDirection'];
  className?: string;
}

export function ExportSummary({
  data,
  totalCount,
  filters,
  sortField,
  sortDirection,
  className,
}: ExportSummaryProps) {
  const ipv4Count = data.filter(item => item.type === 'ipv4').length;
  const ipv6Count = data.filter(item => item.type === 'ipv6').length;
  const regionCount = new Set(data.map(item => item.region)).size;
  const serviceCount = new Set(data.map(item => item.service)).size;

  return (
    <div className={className}>
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Export Summary</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Displayed Records</div>
            <div className="font-semibold text-lg">{formatNumber(data.length)}</div>
            {totalCount > data.length && (
              <div className="text-xs text-muted-foreground">
                of {formatNumber(totalCount)} total
              </div>
            )}
          </div>
          
          <div>
            <div className="text-muted-foreground">IPv4 Prefixes</div>
            <div className="font-semibold text-lg text-blue-600">{formatNumber(ipv4Count)}</div>
            <div className="text-xs text-muted-foreground">on this page</div>
          </div>
          
          <div>
            <div className="text-muted-foreground">IPv6 Prefixes</div>
            <div className="font-semibold text-lg text-green-600">{formatNumber(ipv6Count)}</div>
            <div className="text-xs text-muted-foreground">on this page</div>
          </div>
          
          <div>
            <div className="text-muted-foreground">Regions</div>
            <div className="font-semibold text-lg">{formatNumber(regionCount)}</div>
            <div className="text-xs text-muted-foreground">on this page</div>
          </div>
          
          <div>
            <div className="text-muted-foreground">Services</div>
            <div className="font-semibold text-lg">{formatNumber(serviceCount)}</div>
            <div className="text-xs text-muted-foreground">on this page</div>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t">
          <div className="mb-2">
            <p className="text-sm text-muted-foreground">
              Export will include <strong>all {formatNumber(totalCount)} matching records</strong>, not just the current page.
            </p>
          </div>
          <ExportButton 
            filters={filters}
            sortField={sortField}
            sortDirection={sortDirection}
            filename={`aws-ip-ranges-${new Date().toISOString().split('T')[0]}.csv`}
          />
        </div>
      </div>
    </div>
  );
} 