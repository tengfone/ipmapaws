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

interface RegionPageProps {
  region: string;
  initialData?: InitialFilteredData;
}

export default function RegionPage({ region, initialData }: RegionPageProps) {
  const { prefixes, count, lastUpdated, isLoading, error } =
    useFilteredIPRanges(region, undefined, initialData);

  const services = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of prefixes)
      counts.set(p.service, (counts.get(p.service) ?? 0) + 1);
    return Array.from(counts, ([service, n]) => ({ service, n })).sort((a, b) =>
      a.service.localeCompare(b.service)
    );
  }, [prefixes]);
  const versions = useMemo(() => countVersions(prefixes), [prefixes]);
  const footprint = useMemo(() => buildFootprint(prefixes), [prefixes]);

  if (error) {
    return (
      <PageError message={`Failed to load IP ranges for region ${region}.`} />
    );
  }

  return (
    <div className="page pt-6 sm:pt-8">
      <Breadcrumbs
        trail={[
          { label: 'IPMapAWS', href: '/' },
          { label: 'Regions', href: '/#regions' },
          { label: region },
        ]}
      />

      <div className="mt-5 grid gap-x-12 gap-y-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <h1 className="text-[26px] font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-[28px]">
            <span className="font-mono">{region}</span> AWS IP ranges
          </h1>
          <p className="mt-3 max-w-[62ch] text-ink-2">
            AWS publishes{' '}
            <span className="font-mono font-semibold text-ink">
              {count.toLocaleString('en-US')}
            </span>{' '}
            prefixes for the{' '}
            <span className="font-mono text-ink">{region}</span> region:{' '}
            <span className="font-mono text-ink">
              {versions.ipv4.toLocaleString('en-US')}
            </span>{' '}
            IPv4 and{' '}
            <span className="font-mono text-ink">
              {versions.ipv6.toLocaleString('en-US')}
            </span>{' '}
            IPv6, across {services.length}{' '}
            {services.length === 1 ? 'service' : 'services'}. Filter them below,
            copy a prefix, or export the list as CSV for a firewall or security
            group.
          </p>
          <p className="mt-3 text-[13px] text-ink-2">
            Checking a single address?{' '}
            <Link
              href="/"
              className="font-medium text-ink underline decoration-sage underline-offset-4"
            >
              Look it up on the home page
            </Link>
            .
          </p>
        </div>
        <div className="min-w-0 lg:col-span-7">
          {footprint ? (
            <ParcelStrip
              model={footprint}
              title={
                <>
                  Where <span className="font-mono">{region}</span> sits in IPv4
                  space
                </>
              }
              note={`${versions.ipv4.toLocaleString('en-US')} IPv4 prefixes, drawn to scale`}
            />
          ) : (
            <p className="rounded-lg border border-rule bg-paper px-4 py-3 text-[13px] text-ink-2">
              {isLoading
                ? 'Reading the AWS ranges…'
                : `${region} has no IPv4 prefixes to draw.`}
            </p>
          )}
        </div>
        <DataStatus className="lg:col-span-12" lastUpdated={lastUpdated} />
      </div>

      <LocalRegister
        prefixes={prefixes}
        region={region}
        loading={isLoading}
        heading="Prefix register"
      />

      {services.length > 0 && (
        <section
          aria-labelledby="services-heading"
          className="mt-14 border-t border-ink pt-6"
        >
          <h2
            id="services-heading"
            className="text-lg font-bold tracking-[-0.01em] text-ink"
          >
            Services in <span className="font-mono">{region}</span>
          </h2>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] border-l border-t border-rule">
            {services.map(({ service, n }) => (
              <li key={service} className="border-b border-r border-rule">
                <Link
                  href={`/regions/${encodeURIComponent(region)}/services/${encodeURIComponent(service)}`}
                  className="group flex min-h-12 h-full items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-sage-tint"
                >
                  <span className="min-w-0 [overflow-wrap:anywhere] text-[14px] font-semibold text-ink underline decoration-transparent underline-offset-4 group-hover:decoration-sage">
                    {service}
                  </span>
                  <span
                    className="font-mono text-[12px] text-ink-2"
                    aria-label={`${n} prefixes`}
                  >
                    {n.toLocaleString('en-US')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
