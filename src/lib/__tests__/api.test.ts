import { 
  transformAWSIPRanges, 
  extractRegions, 
  extractServices, 
  filterPrefixes, 
  sortPrefixes 
} from '../api';
import { AWSIPRanges, CombinedPrefix } from '@/types';

// Mock data for testing
const mockAWSData: AWSIPRanges = {
  syncToken: 'test-token',
  createDate: '2024-01-01T00:00:00Z',
  prefixes: [
    {
      ip_prefix: '192.0.2.0/24',
      region: 'us-east-1',
      service: 'EC2',
      network_border_group: 'us-east-1'
    },
    {
      ip_prefix: '203.0.113.0/24',
      region: 'us-west-2',
      service: 'S3',
      network_border_group: 'us-west-2'
    },
    {
      ip_prefix: '198.51.100.0/24',
      region: 'us-east-1',
      service: 'S3',
      network_border_group: 'us-east-1'
    }
  ],
  ipv6_prefixes: [
    {
      ipv6_prefix: '2001:db8::/32',
      region: 'us-east-1',
      service: 'EC2',
      network_border_group: 'us-east-1'
    },
    {
      ipv6_prefix: '2001:db8:1::/48',
      region: 'eu-west-1',
      service: 'CloudFront',
      network_border_group: 'eu-west-1'
    }
  ]
};

describe('API Functions', () => {
  describe('transformAWSIPRanges', () => {
    it('should transform AWS IP ranges into combined format', () => {
      const result = transformAWSIPRanges(mockAWSData);
      
      expect(result).toHaveLength(5); // 3 IPv4 + 2 IPv6
      
      // Check IPv4 transformation
      expect(result[0]).toEqual({
        prefix: '192.0.2.0/24',
        region: 'us-east-1',
        service: 'EC2',
        network_border_group: 'us-east-1',
        type: 'ipv4'
      });
      
      // Check IPv6 transformation
      expect(result[3]).toEqual({
        prefix: '2001:db8::/32',
        region: 'us-east-1',
        service: 'EC2',
        network_border_group: 'us-east-1',
        type: 'ipv6'
      });
    });

    it('should handle empty data', () => {
      const emptyData: AWSIPRanges = {
        syncToken: 'test',
        createDate: '2024-01-01T00:00:00Z',
        prefixes: [],
        ipv6_prefixes: []
      };
      
      const result = transformAWSIPRanges(emptyData);
      expect(result).toHaveLength(0);
    });
  });

  describe('extractRegions', () => {
    it('should extract unique regions from AWS data', () => {
      const regions = extractRegions(mockAWSData);
      
      expect(regions).toHaveLength(3);
      expect(regions).toContain('us-east-1');
      expect(regions).toContain('us-west-2');
      expect(regions).toContain('eu-west-1');
      expect(regions).toEqual(regions.sort()); // Should be sorted
    });

    it('should handle duplicate regions', () => {
      const dataWithDuplicates: AWSIPRanges = {
        ...mockAWSData,
        prefixes: [
          ...mockAWSData.prefixes,
          {
            ip_prefix: '10.0.0.0/8',
            region: 'us-east-1', // Duplicate region
            service: 'Lambda',
            network_border_group: 'us-east-1'
          }
        ]
      };
      
      const regions = extractRegions(dataWithDuplicates);
      expect(regions).toHaveLength(3); // Should still be unique
    });
  });

  describe('extractServices', () => {
    it('should extract unique services from AWS data', () => {
      const services = extractServices(mockAWSData);
      
      expect(services).toHaveLength(3);
      expect(services).toContain('EC2');
      expect(services).toContain('S3');
      expect(services).toContain('CloudFront');
      expect(services).toEqual(services.sort()); // Should be sorted
    });
  });

  describe('filterPrefixes', () => {
    const testPrefixes: CombinedPrefix[] = [
      {
        prefix: '192.0.2.0/24',
        region: 'us-east-1',
        service: 'EC2',
        network_border_group: 'us-east-1',
        type: 'ipv4'
      },
      {
        prefix: '2001:db8::/32',
        region: 'us-east-1',
        service: 'EC2',
        network_border_group: 'us-east-1',
        type: 'ipv6'
      },
      {
        prefix: '203.0.113.0/24',
        region: 'us-west-2',
        service: 'S3',
        network_border_group: 'us-west-2',
        type: 'ipv4'
      }
    ];

    it('should filter by regions', () => {
      const result = filterPrefixes(testPrefixes, {
        regions: ['us-east-1']
      });
      
      expect(result).toHaveLength(2);
      expect(result.every(p => p.region === 'us-east-1')).toBe(true);
    });

    it('should filter by services', () => {
      const result = filterPrefixes(testPrefixes, {
        services: ['EC2']
      });
      
      expect(result).toHaveLength(2);
      expect(result.every(p => p.service === 'EC2')).toBe(true);
    });

    it('should filter by IP type', () => {
      const result = filterPrefixes(testPrefixes, {
        includeIPv4: true,
        includeIPv6: false
      });
      
      expect(result).toHaveLength(2);
      expect(result.every(p => p.type === 'ipv4')).toBe(true);
    });

    it('should filter by search term', () => {
      const result = filterPrefixes(testPrefixes, {
        searchTerm: 'S3'
      });
      
      expect(result).toHaveLength(1);
      expect(result[0].service).toBe('S3');
    });

    it('should combine multiple filters', () => {
      const result = filterPrefixes(testPrefixes, {
        regions: ['us-east-1'],
        includeIPv6: false
      });
      
      expect(result).toHaveLength(1);
      expect(result[0].region).toBe('us-east-1');
      expect(result[0].type).toBe('ipv4');
    });

    it('should return all items when no filters applied', () => {
      const result = filterPrefixes(testPrefixes, {});
      expect(result).toHaveLength(3);
    });

    it('should handle case-insensitive search', () => {
      const result = filterPrefixes(testPrefixes, {
        searchTerm: 'ec2'
      });
      
      expect(result).toHaveLength(2);
    });
  });

  describe('sortPrefixes', () => {
    const testPrefixes: CombinedPrefix[] = [
      {
        prefix: '203.0.113.0/24',
        region: 'us-west-2',
        service: 'S3',
        network_border_group: 'us-west-2',
        type: 'ipv4'
      },
      {
        prefix: '192.0.2.0/24',
        region: 'us-east-1',
        service: 'EC2',
        network_border_group: 'us-east-1',
        type: 'ipv4'
      },
      {
        prefix: '198.51.100.0/24',
        region: 'us-east-1',
        service: 'S3',
        network_border_group: 'us-east-1',
        type: 'ipv4'
      }
    ];

    it('should sort by prefix ascending', () => {
      const result = sortPrefixes(testPrefixes, 'prefix', 'asc');
      
      expect(result[0].prefix).toBe('192.0.2.0/24');
      expect(result[1].prefix).toBe('198.51.100.0/24');
      expect(result[2].prefix).toBe('203.0.113.0/24');
    });

    it('should sort by prefix descending', () => {
      const result = sortPrefixes(testPrefixes, 'prefix', 'desc');
      
      expect(result[0].prefix).toBe('203.0.113.0/24');
      expect(result[1].prefix).toBe('198.51.100.0/24');
      expect(result[2].prefix).toBe('192.0.2.0/24');
    });

    it('should sort by region', () => {
      const result = sortPrefixes(testPrefixes, 'region', 'asc');
      
      expect(result[0].region).toBe('us-east-1');
      expect(result[1].region).toBe('us-east-1');
      expect(result[2].region).toBe('us-west-2');
    });

    it('should sort by service', () => {
      const result = sortPrefixes(testPrefixes, 'service', 'asc');
      
      expect(result[0].service).toBe('EC2');
      expect(result[1].service).toBe('S3');
      expect(result[2].service).toBe('S3');
    });

    it('should not mutate original array', () => {
      const original = [...testPrefixes];
      sortPrefixes(testPrefixes, 'prefix', 'asc');
      
      expect(testPrefixes).toEqual(original);
    });
  });
}); 