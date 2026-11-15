'use client';

import React, { useMemo } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { ExportControls, ExportSource } from '@/components/ExportControls';
import { RegionLabel } from '@/components/PrefixTable';
import {
  BULK_LIMIT,
  BulkRow,
  bulkRecords,
  bulkToCsv,
  parseBulkInput,
  summarizeBulk,
} from '@/lib/bulk';
import { cn } from '@/lib/utils';

function n(value: number) {
  return value.toLocaleString('en-US');
}

interface BulkFormProps {
  text: string;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  disabled?: boolean;
}

/** The multi-line box that replaces the single input in bulk mode. */
export function BulkForm({
  text,
  onTextChange,
  onSubmit,
  onClear,
  disabled,
}: BulkFormProps) {
  const parsed = useMemo(() => parseBulkInput(text), [text]);
  return (
    <form
      className="mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="bulk-lookup" className="sr-only">
        IP addresses or CIDRs, one per line
      </label>
      <textarea
        id="bulk-lookup"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        rows={7}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-describedby="bulk-lookup-hint bulk-lookup-count"
        placeholder={'3.5.140.2\n52.94.76.10:443, 8.8.8.8\n[2600:1f14::1]:8443'}
        className="block min-h-[9.5rem] w-full resize-y rounded-md border border-ink bg-paper px-3.5 py-2.5 font-mono text-[14px] leading-6 text-ink"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p
          id="bulk-lookup-count"
          className="text-[13px] text-ink-2"
          aria-live="polite"
        >
          {parsed.total === 0 ? (
            'No addresses yet'
          ) : (
            <>
              <span className="font-mono text-ink">{n(parsed.total)}</span>{' '}
              {parsed.total === 1 ? 'entry' : 'entries'}
              {parsed.truncated && (
                <>
                  , the first{' '}
                  <span className="font-mono text-ink">{n(BULK_LIMIT)}</span>{' '}
                  will be looked up
                </>
              )}
            </>
          )}
        </p>
        <div className="flex items-center gap-4">
          {text && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-sm text-[13px] font-semibold text-ink underline decoration-sage underline-offset-4 hover:decoration-ink"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            disabled={disabled}
            className="h-10 rounded-md bg-ink px-4 text-sm font-semibold text-on-ink transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Look up all
          </button>
        </div>
      </div>
      <p id="bulk-lookup-hint" className="mt-2 text-[13px] text-ink-2">
        Paste up to {n(BULK_LIMIT)} addresses or CIDRs, one per line or
        separated by commas or spaces. Ports, brackets and the rest of a log
        line are ignored.
      </p>
    </form>
  );
}

interface BulkResultsProps {
  rows: BulkRow[];
  /** Entries found before the cap. */
  total: number;
  skippedLines: number;
  selected: number | null;
  onSelect: (index: number) => void;
  createDate?: string;
}

/** One row per pasted entry, with a summary and allow-list export. */
export function BulkResults({
  rows,
  total,
  skippedLines,
  selected,
  onSelect,
  createDate,
}: BulkResultsProps) {
  const summary = summarizeBulk(rows);
  const source: ExportSource = useMemo(
    () => ({
      records: async () => bulkRecords(rows),
      csv: async () => ({ text: bulkToCsv(rows), rows: rows.length }),
    }),
    [rows]
  );

  return (
    <section
      aria-labelledby="bulk-heading"
      className="min-w-0 border-t border-ink pt-6 lg:col-span-12"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2
            id="bulk-heading"
            className="text-lg font-bold tracking-[-0.01em] text-ink"
          >
            Bulk lookup
          </h2>
          <p className="mt-0.5 text-sm text-ink-2" aria-live="polite">
            <span className="font-mono font-semibold text-ink">
              {n(summary.aws)}
            </span>{' '}
            of <span className="font-mono text-ink">{n(summary.total)}</span>{' '}
            {summary.aws === 1 ? 'is' : 'are'} AWS ·{' '}
            <span className="font-mono text-ink">{n(summary.notAws)}</span> not
            AWS ·{' '}
            <span className="font-mono text-ink">{n(summary.invalid)}</span>{' '}
            invalid
          </p>
        </div>
        <ExportControls
          source={source}
          filenameBase="aws-bulk-lookup"
          totalCount={rows.length}
          createDate={createDate}
          scope="a bulk lookup"
        />
      </div>
      {(total > rows.length || skippedLines > 0) && (
        <p className="mt-2 text-[13px] text-ink-2">
          {total > rows.length && (
            <>
              Looked up the first{' '}
              <span className="font-mono text-ink">{n(rows.length)}</span> of{' '}
              <span className="font-mono text-ink">{n(total)}</span> entries;
              paste the rest as another batch.{' '}
            </>
          )}
          {skippedLines > 0 && (
            <>
              <span className="font-mono text-ink">{n(skippedLines)}</span>{' '}
              {skippedLines === 1 ? 'line' : 'lines'} without an address
              skipped.
            </>
          )}
        </p>
      )}
      <p className="mt-2 text-[13px] text-ink-2">
        Select a row to draw its plat above.
      </p>

      <div className="relative mt-4 max-h-[30rem] overflow-auto border-y border-ink">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <caption className="sr-only">
            Bulk lookup results, one row per entry
          </caption>
          <thead className="sticky top-0 z-10 bg-ground">
            <tr className="border-b border-ink text-left text-[12px] font-semibold text-ink-2">
              <th scope="col" className="h-9 w-14 px-3">
                No.
              </th>
              <th scope="col" className="h-9 px-3">
                Input
              </th>
              <th scope="col" className="h-9 px-3">
                Matched lot
              </th>
              <th scope="col" className="h-9 px-3">
                Services
              </th>
              <th scope="col" className="h-9 px-3">
                Region
              </th>
              <th scope="col" className="h-9 px-3">
                Border group
              </th>
              <th scope="col" className="h-9 w-20 px-3">
                <span className="sr-only">Copy</span>
              </th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px]">
            {rows.map((row, i) => {
              const isSelected = selected === i;
              const selectable = row.status !== 'invalid';
              return (
                <tr
                  key={`${i}-${row.input}`}
                  onClick={selectable ? () => onSelect(i) : undefined}
                  className={cn(
                    'h-[38px] border-b border-rule-2',
                    selectable && 'cursor-pointer',
                    isSelected ? 'bg-sage-tint' : selectable && 'hover:bg-paper'
                  )}
                >
                  <td className="px-3 text-sage-ink">{i + 1}</td>
                  <td className="max-w-[16rem] px-3">
                    {selectable ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(i);
                        }}
                        aria-pressed={isSelected}
                        aria-label={`Draw the plat for ${row.input}`}
                        className="max-w-full truncate rounded-sm text-left text-ink underline decoration-transparent underline-offset-4 hover:decoration-sage"
                      >
                        {row.input}
                      </button>
                    ) : (
                      <span className="block truncate text-ink-2">
                        {row.input}
                      </span>
                    )}
                  </td>
                  <td className="px-3">
                    {row.status === 'aws' && row.lot ? (
                      <span
                        className={cn(
                          'font-medium',
                          isSelected ? 'text-mark-ink' : 'text-ink'
                        )}
                      >
                        {row.lot.prefix}
                      </span>
                    ) : row.status === 'not-aws' ? (
                      <span className="font-sans text-ink-2">
                        Not AWS
                        {row.inside ? (
                          <>
                            {' · '}holds{' '}
                            <span className="font-mono">{n(row.inside)}</span>
                          </>
                        ) : null}
                      </span>
                    ) : (
                      <span className="font-sans">
                        <span className="font-semibold text-danger">
                          Invalid
                        </span>
                        {row.error && (
                          <span className="text-[12px] text-ink-2">
                            {' '}
                            · {row.error}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 font-sans text-ink">
                    {row.lot?.services.join(' · ')}
                  </td>
                  <td className="px-3">
                    {row.lot && (
                      <span className="flex gap-1.5">
                        {row.lot.regions.map((region) => (
                          <RegionLabel key={region} region={region} />
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 text-ink-2">
                    {row.lot?.groups.join(', ')}
                  </td>
                  <td
                    className="px-3 text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {row.lot && (
                      <CopyButton
                        value={row.lot.prefix}
                        subject={row.lot.prefix}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
