import React from 'react';
import { cn } from '@/lib/utils';

interface DataStatusProps {
  /** AWS createDate, e.g. "2026-11-14-17-37-04". */
  lastUpdated?: string;
  /** AWS syncToken, shown when given. */
  syncToken?: string;
  className?: string;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Formats AWS's createDate ("YYYY-MM-DD-hh-mm-ss", UTC) without the runtime's
 * locale or timezone, so server and browser render the same text.
 */
export function formatAWSDate(value: string): { text: string; iso?: string } {
  const parts = value.split('-');
  if (parts.length !== 6 || parts.some((p) => !/^\d+$/.test(p))) {
    return { text: value };
  }
  const [year, month, day, hour, minute] = parts;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return { text: value };
  return {
    text: `${Number(day)} ${monthName} ${year}, ${hour}:${minute} UTC`,
    iso: `${year}-${month}-${day}T${hour}:${minute}:${parts[5]}Z`,
  };
}

/** One line of provenance: when AWS published the data this page shows. */
export function DataStatus({
  lastUpdated,
  syncToken,
  className,
}: DataStatusProps) {
  if (!lastUpdated) {
    return (
      <p className={cn('text-[13px] text-ink-2', className)} aria-live="polite">
        Reading AWS&apos;s ip-ranges.json…
      </p>
    );
  }

  const date = formatAWSDate(lastUpdated);

  return (
    <p className={cn('text-[13px] text-ink-2', className)}>
      AWS data from{' '}
      <time dateTime={date.iso} className="font-mono text-ink">
        {date.text}
      </time>
      {syncToken && (
        <>
          {' '}
          · sync token <span className="font-mono text-ink">{syncToken}</span>
        </>
      )}{' '}
      · refreshed hourly from{' '}
      <a
        href="https://ip-ranges.amazonaws.com/ip-ranges.json"
        target="_blank"
        rel="noreferrer"
        className="font-mono text-ink underline decoration-sage"
      >
        ip-ranges.json
      </a>
    </p>
  );
}
