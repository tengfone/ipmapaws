import { AWSIPRanges } from '@/types';

/** Small, hand-written slice in the shape of ip-ranges.json. */
export const ipRangesFixture: AWSIPRanges = {
  syncToken: '1700000000',
  createDate: '2023-11-14-22-13-20',
  prefixes: [
    {
      ip_prefix: '3.0.0.0/9',
      region: 'GLOBAL',
      service: 'AMAZON',
      network_border_group: 'GLOBAL',
    },
    {
      ip_prefix: '3.5.16.0/21',
      region: 'eu-west-1',
      service: 'AMAZON',
      network_border_group: 'eu-west-1',
    },
    {
      ip_prefix: '3.5.16.0/21',
      region: 'eu-west-1',
      service: 'S3',
      network_border_group: 'eu-west-1',
    },
    {
      ip_prefix: '3.5.0.0/16',
      region: 'eu-west-1',
      service: 'AMAZON',
      network_border_group: 'eu-west-1',
    },
    {
      ip_prefix: '52.94.76.0/22',
      region: 'us-west-2',
      service: 'AMAZON',
      network_border_group: 'us-west-2',
    },
  ],
  ipv6_prefixes: [
    {
      ipv6_prefix: '2600:1ff8:2c00::/40',
      region: 'us-west-2',
      service: 'AMAZON',
      network_border_group: 'us-west-2',
    },
    {
      ipv6_prefix: '2600:1ff8:2c00::/40',
      region: 'us-west-2',
      service: 'S3',
      network_border_group: 'us-west-2',
    },
  ],
};
