'use client';

import Link from 'next/link';
import React, { useMemo } from 'react';
import { DataStatus } from '@/components/DataStatus';
import { LocalRegister } from '@/components/LocalRegister';
import { ParcelStrip } from '@/components/ParcelStrip';
import { Breadcrumbs, countVersions, PageError } from '@/components/PageParts';
import {
  useFilteredIPRanges,
  InitialFilteredData,
} from '@/hooks/useAWSIPRanges';
import { buildFootprint } from '@/lib/plat';

interface RegionServicePageProps {
  region: string;
  service: string;
  initialData?: InitialFilteredData;
}

export default function RegionServicePage({
  region,
  service,
  initialData,
}: RegionServicePageProps) {
  const { prefixes, count, lastUpdated, isLoading, error } =
    useFilteredIPRanges(region, service, initialData);

  const borderGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of prefixes)
      counts.set(
        p.network_border_group,
        (counts.get(p.network_border_group) ?? 0) + 1
      );
    return Array.from(counts, ([group, n]) => ({ group, n })).sort((a, b) =>
      a.group.localeCompare(b.group)
    );
  }, [prefixes]);
  const versions = useMemo(() => countVersions(prefixes), [prefixes]);
  const footprint = useMemo(() => buildFootprint(prefixes), [prefixes]);

  if (error) {
    return (
      <PageError
        message={`Failed to load IP ranges for ${service} in ${region}.`}
      />
    );
  }

  const trail = [
    { label: 'IPMapAWS', href: '/' },
    { label: region, href: `/regions/${encodeURIComponent(region)}` },
    { label: service },
  ];

  if (count === 0 && !isLoading) {
    return (
      <div className="page pt-6 sm:pt-8">
        <Breadcrumbs trail={trail} />
        <h1 className="mt-5 text-[26px] font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-[28px]">
          {service} in <span className="font-mono">{region}</span>
        </h1>
        <p className="mt-3 max-w-[62ch] text-ink-2">
          AWS publishes no {service} prefixes in the {region} region.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/regions/${encodeURIComponent(region)}`}
            className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-on-ink hover:bg-ink/85"
          >
            All services in {region}
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-md border border-ink px-4 text-sm font-semibold text-ink hover:bg-sage-tint"
          >
            Look up an address
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page pt-6 sm:pt-8">
      <Breadcrumbs trail={trail} />

      <div className="mt-5 grid gap-x-12 gap-y-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <h1 className="text-[26px] font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-[28px]">
            {service} in <span className="font-mono">{region}</span>
          </h1>
          <p className="mt-3 max-w-[62ch] text-ink-2">
            AWS publishes{' '}
            <span className="font-mono font-semibold text-ink">
              {count.toLocaleString('en-US')}
            </span>{' '}
            {service} {count === 1 ? 'prefix' : 'prefixes'} in{' '}
            <span className="font-mono text-ink">{region}</span>:{' '}
            <span className="font-mono text-ink">
              {versions.ipv4.toLocaleString('en-US')}
            </span>{' '}
            IPv4 and{' '}
            <span className="font-mono text-ink">
              {versions.ipv6.toLocaleString('en-US')}
            </span>{' '}
            IPv6, in {borderGroups.length} network border{' '}
            {borderGroups.length === 1 ? 'group' : 'groups'}. Copy them one at a
            time or export the whole list as CSV for an allow-list.
          </p>
          <p className="mt-3 text-[13px] text-ink-2">
            <Link
              href={`/regions/${encodeURIComponent(region)}`}
              className="font-medium text-ink underline decoration-sage underline-offset-4"
            >
              Every service in {region}
            </Link>{' '}
            ·{' '}
            <Link
              href="/"
              className="font-medium text-ink underline decoration-sage underline-offset-4"
            >
              Look up an address
            </Link>
          </p>
        </div>
        <div className="min-w-0 lg:col-span-7">
          {footprint ? (
            <ParcelStrip
              model={footprint}
              title={
                <>
                  Where {service} in <span className="font-mono">{region}</span>{' '}
                  sits in IPv4 space
                </>
              }
              note={`${versions.ipv4.toLocaleString('en-US')} IPv4 prefixes, drawn to scale`}
            />
          ) : (
            <p className="rounded-lg border border-rule bg-paper px-4 py-3 text-[13px] text-ink-2">
              {isLoading
                ? 'Reading the AWS ranges…'
                : `${service} has only IPv6 prefixes in ${region}, so there is no IPv4 footprint to draw.`}
            </p>
          )}
        </div>
        <DataStatus className="lg:col-span-12" lastUpdated={lastUpdated} />
      </div>

      <LocalRegister
        prefixes={prefixes}
        region={region}
        service={service}
        loading={isLoading}
        heading="Prefix register"
      />

      {borderGroups.length > 0 && (
        <section
          aria-labelledby="groups-heading"
          className="mt-14 border-t border-ink pt-6"
        >
          <h2
            id="groups-heading"
            className="text-lg font-bold tracking-[-0.01em] text-ink"
          >
            Network border groups
          </h2>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] border-l border-t border-rule">
            {borderGroups.map(({ group, n }) => (
              <li
                key={group}
                className="flex h-12 items-center justify-between gap-3 border-b border-r border-rule px-3"
              >
                <span className="whitespace-nowrap font-mono text-[13px] font-medium text-ink">
                  {group}
                </span>
                <span className="font-mono text-[12px] text-ink-2">
                  {n.toLocaleString('en-US')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
