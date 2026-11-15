import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IPMapAWS - AWS IP Ranges Explorer',
    short_name: 'IPMapAWS',
    description: 'Search and filter AWS IP prefixes by region and service.',
    start_url: '/',
    display: 'standalone',
    background_color: '#eef0ec',
    theme_color: '#1d2b36',
    icons: [
      { src: '/icon', sizes: '32x32', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
