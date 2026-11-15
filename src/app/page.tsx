import type { Metadata } from 'next';
import Link from 'next/link';
import HomePage from '@/components/pages/HomePage';
import { getAWSIPRangesServer } from '@/lib/server-data';

// Re-render with fresh AWS data at most once an hour.
export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

interface RegionSummary {
  region: string;
  count: number;
}

async function loadRegionSummaries(): Promise<RegionSummary[]> {
  try {
    const data = await getAWSIPRangesServer();
    const counts = new Map<string, number>();
    for (const p of [...data.prefixes, ...data.ipv6_prefixes]) {
      counts.set(p.region, (counts.get(p.region) ?? 0) + 1);
    }
    return Array.from(counts, ([region, count]) => ({ region, count })).sort(
      (a, b) => a.region.localeCompare(b.region)
    );
  } catch {
    // The interactive explorer still works; only the static directory is skipped.
    return [];
  }
}

export default async function Page() {
  const regions = await loadRegionSummaries();

  return (
    <>
      <HomePage />
      {regions.length > 0 && (
        <section
          id="regions"
          className="page mt-16 scroll-mt-6"
          aria-labelledby="browse-regions"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-ink pt-6">
            <h2
              id="browse-regions"
              className="text-lg font-bold tracking-[-0.01em] text-ink"
            >
              AWS IP ranges by region
            </h2>
            <p className="text-sm text-ink-2">
              <span className="font-mono font-semibold text-ink">
                {regions.length}
              </span>{' '}
              regions, prefix counts include IPv4 and IPv6
            </p>
          </div>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] border-l border-t border-rule">
            {regions.map(({ region, count }) => (
              <li key={region} className="border-b border-r border-rule">
                <Link
                  href={`/regions/${encodeURIComponent(region)}`}
                  className="group flex h-12 items-center justify-between gap-3 px-3 transition-colors hover:bg-sage-tint"
                >
                  <span className="whitespace-nowrap font-mono text-[13px] font-medium text-ink underline decoration-transparent underline-offset-4 group-hover:decoration-sage">
                    {region}
                  </span>
                  <span className="font-mono text-[12px] text-ink-2">
                    {count.toLocaleString('en-US')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
