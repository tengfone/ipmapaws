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
    return Array.from(counts, ([region, count]) => ({ region, count })).sort((a, b) =>
      a.region.localeCompare(b.region),
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
        <section className="container mx-auto px-4 pb-12" aria-labelledby="browse-regions">
          <h2 id="browse-regions" className="mb-4 text-lg font-semibold">
            Browse AWS IP ranges by region
          </h2>
          <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
            {regions.map(({ region, count }) => (
              <li key={region}>
                <Link
                  href={`/regions/${encodeURIComponent(region)}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 transition-colors hover:bg-accent"
                >
                  <span className="font-medium">{region}</span>
                  <span className="text-muted-foreground">{count.toLocaleString('en-US')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
