import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RegionServicePage from '@/components/pages/RegionServicePage';
import { fetchAWSIPRanges, extractRegions, extractServices } from '@/lib/api';

interface Props {
  params: Promise<{
    region: string;
    service: string;
  }>;
}

// Generate static params for all region/service combinations
export async function generateStaticParams() {
  try {
    const data = await fetchAWSIPRanges();
    const params: { region: string; service: string }[] = [];
    
    // Create a map of regions to their services
    const regionServiceMap = new Map<string, Set<string>>();
    
    // Process IPv4 prefixes
    data.prefixes.forEach((prefix) => {
      if (!regionServiceMap.has(prefix.region)) {
        regionServiceMap.set(prefix.region, new Set());
      }
      regionServiceMap.get(prefix.region)!.add(prefix.service);
    });
    
    // Process IPv6 prefixes
    data.ipv6_prefixes.forEach((prefix) => {
      if (!regionServiceMap.has(prefix.region)) {
        regionServiceMap.set(prefix.region, new Set());
      }
      regionServiceMap.get(prefix.region)!.add(prefix.service);
    });
    
    // Generate all region/service combinations
    regionServiceMap.forEach((services, region) => {
      services.forEach((service) => {
        params.push({ region, service });
      });
    });
    
    return params;
  } catch (error) {
    console.error('Error generating static params for region/service combinations:', error);
    return [];
  }
}

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: encodedRegion, service: encodedService } = await params;
  const region = decodeURIComponent(encodedRegion);
  const service = decodeURIComponent(encodedService);
  
  try {
    const data = await fetchAWSIPRanges();
    
    // Filter prefixes for this region/service combination
    const ipv4Prefixes = data.prefixes.filter(p => p.region === region && p.service === service);
    const ipv6Prefixes = data.ipv6_prefixes.filter(p => p.region === region && p.service === service);
    const totalPrefixes = ipv4Prefixes.length + ipv6Prefixes.length;
    
    if (totalPrefixes === 0) {
      return {
        title: 'Not Found',
        description: `No AWS IP ranges found for ${service} service in ${region} region.`,
      };
    }

    // Get network border groups
    const networkBorderGroups = new Set([
      ...ipv4Prefixes.map(p => p.network_border_group),
      ...ipv6Prefixes.map(p => p.network_border_group)
    ]);

    const title = `${service} in ${region} - ${totalPrefixes} AWS IP Ranges`;
    const description = `AWS IP address ranges for ${service} service in ${region} region. View ${totalPrefixes} IP prefixes (${ipv4Prefixes.length} IPv4, ${ipv6Prefixes.length} IPv6) across ${networkBorderGroups.size} network border groups.`;

    return {
      title,
      description,
      keywords: [`AWS ${service}`, `${region} IP ranges`, 'AWS IP addresses', 'CIDR blocks', service, region],
      openGraph: {
        title,
        description,
        url: `/regions/${region}/services/${service}`,
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
      alternates: {
        canonical: `/regions/${region}/services/${service}`,
      },
      other: {
        'service-name': service,
        'region-name': region,
        'prefix-count': totalPrefixes.toString(),
        'ipv4-count': ipv4Prefixes.length.toString(),
        'ipv6-count': ipv6Prefixes.length.toString(),
      },
    };
  } catch (error) {
    return {
      title: `${service} in ${region} - AWS IP Ranges`,
      description: `AWS IP address ranges for ${service} service in ${region} region`,
    };
  }
}

export default async function Page({ params }: Props) {
  const { region: encodedRegion, service: encodedService } = await params;
  const region = decodeURIComponent(encodedRegion);
  const service = decodeURIComponent(encodedService);
  
  try {
    const data = await fetchAWSIPRanges();
    const regions = extractRegions(data);
    const services = extractServices(data);
    
    if (!regions.includes(region) || !services.includes(service)) {
      notFound();
    }

    // Verify this region/service combination exists
    const hasIPv4 = data.prefixes.some(p => p.region === region && p.service === service);
    const hasIPv6 = data.ipv6_prefixes.some(p => p.region === region && p.service === service);
    
    if (!hasIPv4 && !hasIPv6) {
      notFound();
    }

    return <RegionServicePage region={region} service={service} />;
  } catch (error) {
    console.error('Error loading region/service page:', error);
    throw error;
  }
} 