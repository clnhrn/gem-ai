import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';
export const alt = 'GemAI — Gemstone Knowledge Assistant';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 120,
            height: 120,
            borderRadius: 28,
            background: 'linear-gradient(135deg, #14b8a6, #059669)',
            marginBottom: 32,
            fontSize: 64,
          }}
        >
          💎
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: '#f1f5f9',
            letterSpacing: '-0.02em',
            marginBottom: 16,
          }}
        >
          GemAI
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#94a3b8',
            maxWidth: 600,
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          Gemstone knowledge assistant powered by USGS &amp; Smithsonian sources
        </div>
      </div>
    ),
    { ...size }
  );
}
