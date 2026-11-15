import { ImageResponse } from 'next/og';

export const alt = 'IPMapAWS - AWS IP Ranges Explorer';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: '#1d2b36',
          color: '#eef0ec',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 20,
              background: '#eef0ec',
              color: '#1d2b36',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              fontWeight: 700,
            }}
          >
            IP
          </div>
          <div style={{ fontSize: 72, fontWeight: 700 }}>IPMapAWS</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 44, color: '#d9dfd8' }}>
          Search and filter AWS IP prefixes by region and service
        </div>
        <div style={{ marginTop: 24, fontSize: 32, color: '#9ba79f' }}>
          IPv4 and IPv6 · REST API · CSV export · IP lookup
        </div>
      </div>
    ),
    size,
  );
}
