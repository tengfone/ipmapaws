import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataStatusProps {
  lastUpdated?: string;
  className?: string;
}

export function DataStatus({ lastUpdated, className }: DataStatusProps) {
  const formatAWSDate = (dateString: string) => {
    try {
      // AWS format: "2025-07-15-23-33-17"
      const parts = dateString.split('-');
      if (parts.length === 6) {
        const [year, month, day, hour, minute, second] = parts;
        const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
        return {
          formatted: date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short',
            timeZone: 'UTC'
          }),
          iso: date.toISOString(),
          age: Date.now() - date.getTime()
        };
      }
      return {
        formatted: dateString,
        iso: dateString,
        age: 0
      };
    } catch {
      return {
        formatted: dateString || 'Unknown',
        iso: dateString || '',
        age: 0
      };
    }
  };

  const formatAge = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    const minutes = Math.floor(milliseconds / (1000 * 60));
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  };

  if (!lastUpdated) {
    return (
      <div className={cn('flex items-center justify-center p-4 bg-muted/30 rounded-lg border', className)}>
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm">Loading AWS IP ranges data...</span>
        </div>
      </div>
    );
  }

  const dateInfo = formatAWSDate(lastUpdated);

  return (
    <div className={cn('flex items-center justify-between p-4 bg-muted/30 rounded-lg border', className)}>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">AWS IP Ranges</span>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span>Last updated by AWS:</span>
          <span className="font-mono text-foreground">
            {dateInfo.formatted}
          </span>
          <span className="text-xs">
            ({formatAge(dateInfo.age)})
          </span>
        </div>
      </div>
    </div>
  );
} 