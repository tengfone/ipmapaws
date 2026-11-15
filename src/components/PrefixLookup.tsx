'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { DataStatus } from '@/components/DataStatus';
import { ParcelStrip } from '@/components/ParcelStrip';
import { RegionLabel } from '@/components/PrefixTable';
import { useAWSIPRanges } from '@/hooks/useAWSIPRanges';
import {
  getPrefixIndex,
  InvalidLookupQueryError,
  lookupPrefixes,
  PrefixIndex,
  PrefixLookupResult,
} from '@/lib/lookup';
import { buildPlat, describeRange, describeSize, PlatModel } from '@/lib/plat';
import { cn } from '@/lib/utils';
import { CombinedPrefix } from '@/types';

type LookupState =
  | { status: 'idle' }
  | { status: 'waiting' }
  | { status: 'error'; message: string }
  | { status: 'done'; result: PrefixLookupResult };

/** Shown as the example plat before the first lookup, and offered as a try-it. */
const EXAMPLE_QUERY = '3.5.140.2';
const TRY_QUERIES = ['3.5.140.2', '2600:1f14::1', '52.94.76.0/22'];

/** One published prefix and every service record AWS lists for it. */
interface Lot {
  prefix: string;
  type: CombinedPrefix['type'];
  services: string[];
  records: CombinedPrefix[];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

/** Groups records by prefix, keeping the order of first appearance. */
function groupLots(records: readonly CombinedPrefix[]): Lot[] {
  const lots = new Map<string, Lot>();
  for (const record of records) {
    const lot = lots.get(record.prefix);
    if (lot) {
      lot.records.push(record);
      if (!lot.services.includes(record.service)) {
        lot.services.push(record.service);
      }
    } else {
      lots.set(record.prefix, {
        prefix: record.prefix,
        type: record.type,
        services: [record.service],
        records: [record],
      });
    }
  }
  return Array.from(lots.values());
}

/** "1 prefix (3 service records) contains", "2 prefixes contain". */
function countLots(
  lots: number,
  records: number,
  verbOne: string,
  verbMany: string,
  adjective = ''
): string {
  const noun = `${adjective}${lots === 1 ? 'prefix' : 'prefixes'}`;
  const detail =
    records > lots
      ? ` (${records.toLocaleString('en-US')} service records)`
      : '';
  return `${lots.toLocaleString('en-US')} ${noun}${detail} ${lots === 1 ? verbOne : verbMany}`;
}

function summaryLine(query: string, lot: Lot): string {
  const regions = unique(lot.records.map((r) => r.region)).join(', ');
  const groups = unique(lot.records.map((r) => r.network_border_group)).join(
    ', '
  );
  return `${query} is in ${lot.prefix} (${lot.services.join(', ')}; ${regions}; ${groups})`;
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

function prefixLength(prefix: string): number {
  return Number(prefix.split('/')[1] ?? 0);
}

/** A real lookup from the loaded data, used to draw the example plat. */
function examplePlat(index: PrefixIndex): PlatModel | null {
  try {
    let result = lookupPrefixes(index, EXAMPLE_QUERY);
    if (!result.bestMatch) {
      const fallback = index.ipv4.find(
        (c) => c.parsed.prefixLength >= 20 && c.parsed.prefixLength <= 24
      );
      if (!fallback) return null;
      result = lookupPrefixes(index, fallback.entry.prefix.split('/')[0]);
    }
    return buildPlat(index, result);
  } catch {
    return null;
  }
}

interface PrefixLookupProps {
  /** Heading level for the question; the home page makes it the page's h1. */
  headingAs?: 'h1' | 'h2';
  /** Called with the best match's prefix (or null) after each lookup. */
  onBestMatch?: (prefix: string | null) => void;
  /** Offered on the result: filter the register below to this prefix. */
  onShowInRegister?: (prefix: string) => void;
}

/**
 * "Which AWS prefix contains this IP?"
 *
 * Runs entirely in the browser against the dataset the page has already
 * loaded (shared SWR cache), using the same lookup code as the public
 * /api/aws-ip-ranges/lookup endpoint. No request per lookup, no rate limit.
 * The answer is drawn to scale beside the record as a parcel strip.
 */
export function PrefixLookup({
  headingAs = 'h2',
  onBestMatch,
  onShowInRegister,
}: PrefixLookupProps) {
  const { data, isLoading, error: loadError } = useAWSIPRanges();
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  const index = useMemo(() => (data ? getPrefixIndex(data) : null), [data]);

  const state: LookupState = useMemo(() => {
    if (submitted === null) return { status: 'idle' };
    if (!submitted.trim()) {
      return {
        status: 'error',
        message: 'Enter an IPv4 address, IPv6 address, or CIDR prefix.',
      };
    }
    if (!index) {
      if (loadError && !isLoading) {
        return {
          status: 'error',
          message: 'AWS IP ranges could not be loaded. Please try again later.',
        };
      }
      return { status: 'waiting' };
    }
    try {
      return { status: 'done', result: lookupPrefixes(index, submitted) };
    } catch (error) {
      if (error instanceof InvalidLookupQueryError) {
        return { status: 'error', message: error.message };
      }
      return { status: 'error', message: 'Lookup failed. Please try again.' };
    }
  }, [submitted, index, loadError, isLoading]);

  const result = state.status === 'done' ? state.result : null;
  const containingLots = useMemo(
    () => (result ? groupLots(result.containing) : []),
    [result]
  );
  const containedLots = useMemo(
    () => (result ? groupLots(result.contained) : []),
    [result]
  );
  const bestPrefix = result?.bestMatch?.prefix ?? null;

  useEffect(() => {
    onBestMatch?.(bestPrefix);
  }, [bestPrefix, onBestMatch]);

  const plat = useMemo(() => {
    if (!index) return null;
    if (result) {
      try {
        return buildPlat(index, result);
      } catch {
        return null;
      }
    }
    return null;
  }, [index, result]);

  const example = useMemo(
    () => (index && !result ? examplePlat(index) : null),
    [index, result]
  );

  const lookUp = (query: string) => {
    setValue(query);
    setSubmitted(query);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(value);
  };

  const Heading = headingAs;
  const isRange = result ? result.query.includes('/') : false;

  return (
    <section
      aria-labelledby="lookup-heading"
      className="grid gap-x-12 gap-y-6 lg:grid-cols-12"
    >
      <div className="min-w-0 lg:col-span-5">
        <Heading
          id="lookup-heading"
          className="text-[26px] font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-[28px]"
        >
          Which AWS prefix contains this IP?
        </Heading>

        <form onSubmit={handleSubmit} className="mt-4 flex">
          <label htmlFor="prefix-lookup" className="sr-only">
            IP address or CIDR
          </label>
          <input
            id="prefix-lookup"
            type="text"
            inputMode="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="e.g. 3.5.140.2 or 2600:1f14::1"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={256}
            aria-describedby="prefix-lookup-hint"
            aria-invalid={state.status === 'error' ? true : undefined}
            className={cn(
              'h-12 min-w-0 flex-1 rounded-l-md border border-r-0 bg-paper px-3.5 font-mono text-[18px] text-ink sm:text-[20px]',
              state.status === 'error' ? 'border-danger' : 'border-ink'
            )}
          />
          <button
            type="submit"
            className="h-12 shrink-0 rounded-r-md border border-ink bg-ink px-5 text-sm font-semibold text-on-ink transition-colors hover:bg-ink/85"
          >
            Look up
          </button>
        </form>
        <p id="prefix-lookup-hint" className="mt-2 text-[13px] text-ink-2">
          IPv4 or IPv6, address or CIDR. Most specific match first; for a CIDR,
          also the prefixes inside it. Runs in your browser.
        </p>

        <div aria-live="polite" className="mt-5 space-y-4">
          {state.status === 'idle' && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-2">
              <span>Try</span>
              {TRY_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => lookUp(q)}
                  className="rounded-sm font-mono text-ink underline decoration-sage underline-offset-4 hover:decoration-ink"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {state.status === 'waiting' && (
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <span
                className="size-2 animate-pulse rounded-full bg-ink-2"
                aria-hidden="true"
              />
              Loading the published AWS ranges…
            </p>
          )}

          {state.status === 'error' && (
            <div
              role="alert"
              className="rounded-lg border border-danger px-4 py-3 text-sm"
            >
              <p className="font-semibold text-danger">
                {state.message.startsWith('AWS IP ranges could not')
                  ? 'Lookup unavailable'
                  : 'Not an IP address or CIDR'}
              </p>
              <p className="mt-1 text-ink">{state.message}</p>
            </div>
          )}

          {result && result.mappedIPv4 && (
            <p className="text-[13px] text-ink-2">
              <span className="font-mono text-ink">{result.query}</span> is an
              IPv4-mapped IPv6 address, so it was looked up as{' '}
              <span className="font-mono text-ink">{result.mappedIPv4}</span>.
            </p>
          )}

          {result && !result.found && (
            <div className="rounded-lg border border-ink bg-paper px-4 py-3 text-sm">
              <p className="font-semibold text-ink">
                Not in the published AWS ranges
              </p>
              <p className="mt-1 text-ink-2">
                <span className="font-mono text-ink">{result.query}</span> is
                not inside any prefix AWS has published
                {isRange ? ', and no published prefix falls inside it' : ''}.
              </p>
              <p className="mt-1 text-ink-2">
                So it is not an AWS address, as far as ip-ranges.json says. The
                plat shows what AWS does publish nearby.
              </p>
            </div>
          )}

          {containingLots.length > 0 && result && (
            <div className="space-y-2">
              <ol className="space-y-2" aria-label="Containing prefixes">
                {containingLots.map((lot, i) =>
                  i === 0 ? (
                    <MatchedLot
                      key={`lot-${lot.prefix}`}
                      lot={lot}
                      query={result.query}
                      onShowInRegister={onShowInRegister}
                    />
                  ) : (
                    <LotRow key={`containing-${lot.prefix}`} lot={lot} boxed />
                  )
                )}
              </ol>
              <p className="text-[13px] text-ink-2">
                <span className="font-semibold text-ink">
                  {countLots(
                    containingLots.length,
                    result.containing.length,
                    'contains',
                    'contain'
                  )}
                </span>{' '}
                <span className="font-mono text-ink">{result.query}</span>
                {containingLots.length > 1 ? ', most specific first' : ''}
              </p>
            </div>
          )}

          {result && result.containedTotal > 0 && (
            <div className="space-y-2">
              {result.containing.length === 0 ? (
                <div className="rounded-lg border border-ink bg-paper px-4 py-3 text-sm">
                  <p className="font-semibold text-ink">
                    No single published prefix contains this whole range
                  </p>
                  <p className="mt-1 text-ink-2">
                    But{' '}
                    {result.containedTruncated
                      ? plural(
                          result.containedTotal,
                          'AWS record falls',
                          'AWS records fall'
                        )
                      : countLots(
                          containedLots.length,
                          result.containedTotal,
                          'falls',
                          'fall',
                          'AWS '
                        )}{' '}
                    inside{' '}
                    <span className="font-mono text-ink">{result.query}</span>.
                  </p>
                </div>
              ) : (
                <p className="text-[13px] text-ink-2">
                  <span className="font-semibold text-ink">
                    {result.containedTruncated
                      ? plural(
                          result.containedTotal,
                          'more specific record falls',
                          'more specific records fall'
                        )
                      : countLots(
                          containedLots.length,
                          result.containedTotal,
                          'falls',
                          'fall',
                          'more specific '
                        )}
                  </span>{' '}
                  inside{' '}
                  <span className="font-mono text-ink">{result.query}</span>
                </p>
              )}
              {result.containedTruncated && (
                <p className="text-[12px] text-ink-2">
                  Showing the first{' '}
                  {result.contained.length.toLocaleString('en-US')} of{' '}
                  {result.containedTotal.toLocaleString('en-US')} service
                  records, in address order. Use a narrower range or the
                  register below to see the rest.
                </p>
              )}
              <ul
                className="max-h-80 overflow-y-auto rounded-lg border border-rule"
                aria-label="Prefixes inside the range"
              >
                {containedLots.map((lot) => (
                  <LotRow key={`contained-${lot.prefix}`} lot={lot} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 lg:col-span-7">
        <PlatPanel
          state={state}
          plat={plat}
          example={example}
          loading={!index && !loadError}
          onTryExample={() => lookUp(EXAMPLE_QUERY)}
        />
      </div>

      <DataStatus
        className="lg:col-span-12"
        lastUpdated={data?.createDate}
        syncToken={data?.syncToken}
      />
    </section>
  );
}

function MatchedLot({
  lot,
  query,
  onShowInRegister,
}: {
  lot: Lot;
  query: string;
  onShowInRegister?: (prefix: string) => void;
}) {
  const range = describeRange(lot.prefix);
  const regions = unique(lot.records.map((r) => r.region));
  const groups = unique(lot.records.map((r) => r.network_border_group));
  return (
    <li
      data-testid="matched-lot"
      aria-current="true"
      className="rounded-lg border border-ink bg-paper px-4 pb-4 pt-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">
            {lot.prefix}
          </p>
          <p className="mt-1 text-[12px] text-ink-2">
            <span className="font-semibold text-mark-ink">Matched lot</span>
            {range && (
              <>
                {' · '}
                <span className="font-mono">
                  {range[0]} – {range[1]}
                </span>
              </>
            )}
            {' · '}
            <span className="font-mono">
              {describeSize(lot.type, prefixLength(lot.prefix))}
            </span>
          </p>
        </div>
        <CopyButton variant="button" value={lot.prefix} label="Copy prefix" />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-rule pt-3 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-[12px] text-ink-2">
            {regions.length === 1 ? 'Region' : 'Regions'}
          </dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {regions.map((region) => (
              <RegionLabel
                key={region}
                region={region}
                href={`/regions/${encodeURIComponent(region)}`}
              />
            ))}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[12px] text-ink-2">
            {lot.services.length === 1 ? 'Service' : 'Services'}
          </dt>
          <dd className="mt-1 text-[15px] font-semibold text-ink">
            {lot.services.join(' · ')}
          </dd>
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className="text-[12px] text-ink-2">Network border group</dt>
          <dd className="mt-1 break-all font-mono text-[14px] font-medium text-ink">
            {groups.join(', ')}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-3">
        <CopyButton value={summaryLine(query, lot)} label="Copy summary" />
        {onShowInRegister && (
          <button
            type="button"
            onClick={() => onShowInRegister(lot.prefix)}
            className="rounded-sm text-[13px] font-semibold text-ink underline decoration-sage underline-offset-4 hover:decoration-ink"
          >
            Show in register
          </button>
        )}
      </div>
    </li>
  );
}

function LotRow({ lot, boxed = false }: { lot: Lot; boxed?: boolean }) {
  const regions = unique(lot.records.map((r) => r.region));
  const groups = unique(lot.records.map((r) => r.network_border_group));
  return (
    <li
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2',
        boxed
          ? 'rounded-md border border-rule'
          : 'border-b border-rule-2 last:border-b-0'
      )}
    >
      <div className="min-w-0">
        <p className="break-all font-mono text-[14px] font-medium text-ink">
          {lot.prefix}
        </p>
        <p className="mt-0.5 text-[12px] text-ink-2">
          <span className="font-semibold text-ink">
            {lot.services.join(' · ')}
          </span>
          <span aria-hidden="true"> · </span>
          <span className="font-mono">{regions.join(', ')}</span>
          {groups.join() !== regions.join() && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="font-mono">{groups.join(', ')}</span>
            </>
          )}
          <span aria-hidden="true"> · </span>
          {lot.type === 'ipv4' ? 'IPv4' : 'IPv6'}
        </p>
      </div>
      <CopyButton value={lot.prefix} subject={lot.prefix} />
    </li>
  );
}

function PlatPanel({
  state,
  plat,
  example,
  loading,
  onTryExample,
}: {
  state: LookupState;
  plat: PlatModel | null;
  example: PlatModel | null;
  loading: boolean;
  onTryExample: () => void;
}) {
  if (state.status === 'error') {
    return (
      <EmptyPlat
        title="Nothing to draw"
        body="The plat draws the AWS blocks around a valid IPv4 or IPv6 address or CIDR. Fix the input and look up again."
      />
    );
  }

  if (state.status === 'done' && plat) {
    const title =
      plat.mode === 'none'
        ? `${plat.query} is outside every AWS lot`
        : `Plat of ${plat.query}`;
    const note =
      plat.mode === 'none'
        ? 'Blocks around the address, with the AWS prefixes in them'
        : 'Each band enlarges the outlined window above it';
    return (
      <ParcelStrip
        model={plat}
        title={title}
        note={note}
        animationKey={plat.query}
      />
    );
  }

  if (example) {
    return (
      <ParcelStrip
        model={example}
        title={
          <>
            Example plat of <span className="font-mono">{example.query}</span>
          </>
        }
        note="Each band enlarges the outlined window above it"
        footnote={
          <>
            This is an example drawn from today&apos;s data. Look up an address
            to draw its own plat, or{' '}
            <button
              type="button"
              onClick={onTryExample}
              className="rounded-sm font-medium text-ink underline decoration-sage underline-offset-4 hover:decoration-ink"
            >
              look up the example
            </button>
            .
          </>
        }
      />
    );
  }

  return (
    <EmptyPlat
      title={
        loading || state.status === 'waiting'
          ? 'Reading the AWS ranges'
          : 'Plat unavailable'
      }
      body={
        loading || state.status === 'waiting'
          ? 'The plat appears once the published ranges have loaded.'
          : 'AWS IP ranges could not be loaded, so there is nothing to draw.'
      }
    />
  );
}

function EmptyPlat({ title, body }: { title: string; body: string }) {
  return (
    <figure className="rounded-lg border border-rule bg-paper px-4 py-3 sm:px-5">
      <figcaption className="text-[13px] font-semibold text-ink">
        {title}
      </figcaption>
      <svg
        viewBox="0 0 600 64"
        className="mt-3 block h-16 w-full"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <rect
          x="0.5"
          y="0.5"
          width="599"
          height="63"
          fill="none"
          stroke="var(--rule)"
        />
        {[150, 300, 450].map((x) => (
          <line key={x} x1={x} x2={x} y1="0" y2="64" stroke="var(--rule-2)" />
        ))}
      </svg>
      <p className="mt-2 text-[13px] text-ink-2">{body}</p>
    </figure>
  );
}
