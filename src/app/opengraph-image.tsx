import { ImageResponse } from 'next/og';

// Static OG share card for `/`. No fabricated social proof, ratings, or counts —
// just the product name and one-line value prop on the app's brand surface.

export const runtime = 'nodejs';
export const alt = 'Library Reader — save, read, highlight, and listen';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        background: '#0d0d0c',
        color: '#f5f5f4',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            color: '#c79b6a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          L
        </div>
        <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5 }}>Library Reader</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            maxWidth: 980,
          }}
        >
          Save it, read it, highlight it, listen to it.
        </div>
        <div
          style={{
            fontSize: 28,
            color: 'rgba(245,245,244,0.6)',
            maxWidth: 900,
            lineHeight: 1.35,
          }}
        >
          A personal research library for articles and PDFs.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          fontSize: 20,
          color: 'rgba(245,245,244,0.5)',
        }}
      >
        <span>Articles + PDFs</span>
        <span>·</span>
        <span>Highlights</span>
        <span>·</span>
        <span>Listen</span>
        <span>·</span>
        <span>AI chat (BYOK)</span>
      </div>
    </div>,
    { ...size }
  );
}
