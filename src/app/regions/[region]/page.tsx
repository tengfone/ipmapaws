import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RegionPage from '@/components/pages/RegionPage';
import { extractRegions, transformAWSIPRanges } from '@/lib/api';
import { getAWSIPRangesServer } from '@/lib/server-data';

interface Props {
  params: Promise<{
    region: string;
  }>;
}

// Generate static params for all AWS regions
export async function generateStaticParams() {
  try {
    const data = await getAWSIPRangesServer();
    const regions = extractRegions(data);
    
    return regions.map((region) => ({
      region: region,
    }));
  } catch (error) {
    console.error('Error generating static params for regions:', error);
    return [];
  }
}

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: encodedRegion } = await params;
  const region = decodeURIComponent(encodedRegion);
  
  try {
    const data = await getAWSIPRangesServer();
    const regions = extractRegions(data);
    
    if (!regions.includes(region)) {
      return {
        title: 'Region Not Found',
      };
    }

    const regionPrefixes = data.prefixes.filter(p => p.region === region);
    const regionIPv6Prefixes = data.ipv6_prefixes.filter(p => p.region === region);
    const totalPrefixes = regionPrefixes.length + regionIPv6Prefixes.length;
    const services = new Set([
      ...regionPrefixes.map(p => p.service),
      ...regionIPv6Prefixes.map(p => p.service)
    ]);

    return {
      title: `${region} AWS IP Ranges - ${totalPrefixes} Prefixes`,
      description: `AWS IP address ranges for ${region} region. View ${totalPrefixes} IP prefixes across ${services.size} AWS services including ${Array.from(services).slice(0, 3).join(', ')}.`,
      openGraph: {
        title: `${region} AWS IP Ranges`,
        description: `AWS IP address ranges for ${region} region`,
        url: `/regions/${region}`,
      },
      alternates: {
        canonical: `/regions/${region}`,
      },
    };
  } catch (error) {
    return {
      title: `${region} AWS IP Ranges`,
      description: `AWS IP address ranges for ${region} region`,
    };
  }
}

// Re-render with fresh AWS data at most once an hour.
export const revalidate = 3600;

export default async function Page({ params }: Props) {
  const { region: encodedRegion } = await params;
  const region = decodeURIComponent(encodedRegion);

  const data = await getAWSIPRangesServer();
  if (!extractRegions(data).includes(region)) {
    notFound();
  }

  const prefixes = transformAWSIPRanges(data).filter((p) => p.region === region);

  return <RegionPage region={region} initialData={{ prefixes, lastUpdated: data.createDate }} />;
}
