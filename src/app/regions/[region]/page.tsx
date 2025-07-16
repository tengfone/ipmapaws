import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RegionPage from '@/components/pages/RegionPage';
import { fetchAWSIPRanges, extractRegions } from '@/lib/api';

interface Props {
  params: Promise<{
    region: string;
  }>;
}

// Generate static params for all AWS regions
export async function generateStaticParams() {
  try {
    const data = await fetchAWSIPRanges();
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
    const data = await fetchAWSIPRanges();
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

export default async function Page({ params }: Props) {
  const { region: encodedRegion } = await params;
  const region = decodeURIComponent(encodedRegion);
  
  try {
    const data = await fetchAWSIPRanges();
    const regions = extractRegions(data);
    
    if (!regions.includes(region)) {
      notFound();
    }

    return <RegionPage region={region} />;
  } catch (error) {
    console.error('Error loading region page:', error);
    throw error;
  }
} 