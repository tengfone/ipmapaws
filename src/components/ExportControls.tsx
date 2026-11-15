'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Download, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ALLOW_LIST_FORMATS,
  AllowListFormat,
  collectCidrs,
  formatCidrs,
  FormatInfo,
  recordsToCsv,
} from '@/lib/allowlist';
import { cn, copyToClipboard, downloadText } from '@/lib/utils';
import { CombinedPrefix } from '@/types';

/** Where the rows come from: data already in the browser, or the export API. */
export interface ExportSource {
  /** Every record to export (all matching rows, not one page). */
  records: () => Promise<CombinedPrefix[]>;
  /** CSV text and its row count; defaults to the records as register CSV. */
  csv?: () => Promise<{ text: string; rows: number }>;
}

export class ExportError extends Error {}

type Stamp =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'done'; text: string }
  | { status: 'error'; text: string };

const STAMP_MS = 4000;

function useStamp() {
  const [stamp, setStamp] = useState<Stamp>({ status: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const settle = (next: Stamp) => {
    setStamp(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStamp({ status: 'idle' }), STAMP_MS);
  };
  return [stamp, setStamp, settle] as const;
}

function count(n: number, one: string, many: string) {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

interface ExportControlsProps {
  source: ExportSource;
  /** Base of downloaded file names, e.g. "aws-ip-ranges-us-east-1"; the date is appended. */
  filenameBase: string;
  /** Rows the current view matches; 0 disables both controls. */
  totalCount?: number;
  /** AWS createDate, written into format headers. */
  createDate?: string;
  /** What the set is, for format headers, e.g. "S3 in us-east-1". */
  scope?: string;
  className?: string;
}

/**
 * Export CSV plus a "Copy as" menu of allow-list formats. Every format
 * deduplicates and sorts the CIDRs. Results stamp in place on the control
 * that was used, never as a toast.
 */
export function ExportControls({
  source,
  filenameBase,
  totalCount,
  createDate,
  scope,
  className,
}: ExportControlsProps) {
  const [csvStamp, setCsvStamp, settleCsv] = useStamp();
  const [menuStamp, setMenuStamp, settleMenu] = useStamp();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    rootRef.current
      ?.querySelector<HTMLButtonElement>('[data-format-action]')
      ?.focus();
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const empty = totalCount === 0;
  const fileName = (extension: string) =>
    `${filenameBase}-${new Date().toISOString().slice(0, 10)}.${extension}`;
  const errorText = (error: unknown) =>
    error instanceof ExportError ? error.message : 'Export failed, try again';

  const csvOf = async () => {
    if (source.csv) return source.csv();
    const records = await source.records();
    return { text: recordsToCsv(records), rows: records.length };
  };

  const handleCsv = async () => {
    setCsvStamp({ status: 'busy' });
    try {
      const { text, rows } = await csvOf();
      if (rows === 0) {
        settleCsv({ status: 'error', text: 'Nothing to export' });
        return;
      }
      downloadText(text, fileName('csv'), 'text/csv');
      settleCsv({
        status: 'done',
        text: `Exported ${count(rows, 'row', 'rows')}`,
      });
    } catch (error) {
      settleCsv({ status: 'error', text: errorText(error) });
    }
  };

  const render = async (format: FormatInfo) => {
    if (format.id === 'csv') {
      const { text, rows } = await csvOf();
      return { text, amount: count(rows, 'row', 'rows') };
    }
    const entries = collectCidrs(await source.records());
    return {
      text: formatCidrs(format.id as Exclude<AllowListFormat, 'csv'>, entries, {
        createDate,
        scope,
      }),
      amount: count(entries.length, 'CIDR', 'CIDRs'),
      empty: entries.length === 0,
    };
  };

  const handleFormat = async (
    format: FormatInfo,
    action: 'copy' | 'download'
  ) => {
    setOpen(false);
    triggerRef.current?.focus();
    setMenuStamp({ status: 'busy' });
    try {
      const out = await render(format);
      if (('empty' in out && out.empty) || !out.text.trim()) {
        settleMenu({ status: 'error', text: 'Nothing to copy' });
        return;
      }
      if (action === 'copy') {
        if (!(await copyToClipboard(out.text))) {
          settleMenu({
            status: 'error',
            text: 'Clipboard blocked, use Download',
          });
          return;
        }
        settleMenu({
          status: 'done',
          text: `Copied ${out.amount} as ${format.name}`,
        });
      } else {
        downloadText(out.text, fileName(format.extension), format.mime);
        settleMenu({
          status: 'done',
          text: `Downloaded ${out.amount} as ${format.name}`,
        });
      }
    } catch (error) {
      settleMenu({ status: 'error', text: errorText(error) });
    }
  };

  const stampClass = (stamp: Stamp) =>
    stamp.status === 'error'
      ? 'h-auto min-h-10 whitespace-normal border-danger py-1.5 text-danger hover:bg-transparent'
      : stamp.status === 'done'
        ? 'h-auto min-h-10 whitespace-normal border-sage-ink py-1.5 text-sage-ink'
        : undefined;

  return (
    <div
      ref={rootRef}
      className={cn('relative flex flex-wrap items-center gap-2', className)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <Button
        ref={triggerRef}
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        disabled={empty || menuStamp.status === 'busy'}
        aria-expanded={open}
        aria-haspopup="true"
        className={stampClass(menuStamp)}
      >
        {menuStamp.status === 'busy' ? (
          <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} />
        ) : menuStamp.status === 'done' ? (
          <Check className="size-4" strokeWidth={2} />
        ) : null}
        <span aria-live="polite">
          {menuStamp.status === 'busy'
            ? 'Preparing…'
            : menuStamp.status === 'idle'
              ? 'Copy as'
              : menuStamp.text}
        </span>
        {menuStamp.status === 'idle' && (
          <ChevronDown
            className={cn('size-4 transition-transform', open && 'rotate-180')}
            strokeWidth={1.75}
          />
        )}
      </Button>

      <Button
        onClick={handleCsv}
        disabled={empty || csvStamp.status === 'busy'}
        variant={
          csvStamp.status === 'idle' || csvStamp.status === 'busy'
            ? 'default'
            : 'outline'
        }
        className={stampClass(csvStamp)}
        title={
          totalCount !== undefined && totalCount > 0
            ? `Download all ${totalCount.toLocaleString('en-US')} matching rows as CSV`
            : undefined
        }
      >
        {csvStamp.status === 'busy' ? (
          <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} />
        ) : csvStamp.status === 'done' ? (
          <Check className="size-4" strokeWidth={2} />
        ) : (
          <Download className="size-4" strokeWidth={1.75} />
        )}
        <span aria-live="polite">
          {csvStamp.status === 'busy'
            ? 'Exporting…'
            : csvStamp.status === 'idle'
              ? 'Export CSV'
              : csvStamp.text}
        </span>
      </Button>

      {open && (
        <div
          role="group"
          aria-label="Copy or download as"
          className="absolute right-0 top-11 z-40 w-[min(24rem,calc(100vw-2rem))] rounded-md border border-ink bg-paper py-1 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)]"
        >
          <p className="border-b border-rule px-3 pb-2 pt-1.5 text-[12px] text-ink-2">
            Every matching row, deduplicated and sorted
            {totalCount !== undefined ? (
              <>
                {' '}
                from{' '}
                <span className="font-mono text-ink">
                  {totalCount.toLocaleString('en-US')}
                </span>{' '}
                {totalCount === 1 ? 'record' : 'records'}
              </>
            ) : null}
          </p>
          <ul>
            {ALLOW_LIST_FORMATS.map((format) => (
              <li
                key={format.id}
                className="flex items-center justify-between gap-3 border-b border-rule-2 px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">
                    {format.label}
                  </p>
                  <p className="text-[12px] text-ink-2">{format.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    data-format-action
                    onClick={() => handleFormat(format, 'copy')}
                    aria-label={`Copy as ${format.label}`}
                    className="rounded-sm text-[13px] font-semibold text-ink underline decoration-sage underline-offset-4 hover:decoration-ink"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormat(format, 'download')}
                    aria-label={`Download as ${format.label}`}
                    className="rounded-sm text-[13px] font-semibold text-ink underline decoration-sage underline-offset-4 hover:decoration-ink"
                  >
                    .{format.extension}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Source for the home register when the full dataset is not in the browser
 * yet: the export API, which applies the same filters and is rate limited.
 */
export function apiExportSource(params: URLSearchParams): ExportSource {
  let cached: Promise<CombinedPrefix[]> | null = null;
  return {
    records: () => {
      if (!cached) {
        cached = fetch(`/api/aws-ip-ranges/export?${params}`).then(
          async (response) => {
            if (response.status === 429) {
              throw new ExportError(
                'Export limit reached, try again in a few minutes'
              );
            }
            if (!response.ok) throw new ExportError('Export failed, try again');
            const body = (await response.json()) as { data: CombinedPrefix[] };
            return body.data;
          }
        );
        cached.catch(() => {
          cached = null;
        });
      }
      return cached;
    },
  };
}
