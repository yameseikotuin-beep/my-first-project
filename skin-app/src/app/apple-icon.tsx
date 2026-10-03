import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#faf7f0',
          borderRadius: 0,
        }}
      >
        <div
          style={{
            width: 106,
            height: 106,
            borderRadius: '50%',
            border: '7px solid #c9b07a',
            background: '#5f806b',
          }}
        />
      </div>
    ),
    size,
  );
}
