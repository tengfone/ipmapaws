import type { MetadataRoute } from 'next';
import { getAWSIPRangesServer } from '@/lib/server-data';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ipmapaws.vercel.app';

// Regenerate with fresh AWS data at most once an hour.
export const revalidate = 3600;

function awsDateToISO(createDate: string): string | undefined {
  const parts = createDate.split('-');
  if (parts.length !== 6) return undefined;
  const [y, mo, d, h, mi, s] = parts;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/docs`, changeFrequency: 'monthly', priority: 0.6 },
  ];

  try {
    const data = await getAWSIPRangesServer();
    const lastModified = awsDateToISO(data.createDate);
    const services = new Map<string, Set<string>>();
    for (const p of [...data.prefixes, ...data.ipv6_prefixes]) {
      if (!services.has(p.region)) services.set(p.region, new Set());
      services.get(p.region)!.add(p.service);
    }
    for (const region of Array.from(services.keys()).sort()) {
      const regionPath = `/regions/${encodeURIComponent(region)}`;
      entries.push({ url: `${BASE_URL}${regionPath}`, lastModified, changeFrequency: 'daily', priority: 0.8 });
      for (const service of Array.from(services.get(region)!).sort()) {
        entries.push({
          url: `${BASE_URL}${regionPath}/services/${encodeURIComponent(service)}`,
          lastModified,
          changeFrequency: 'daily',
          priority: 0.6,
        });
      }
    }
  } catch {
    // Serve the static entries rather than failing the whole sitemap.
  }

  return entries;
}
