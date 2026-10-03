import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 96,
        }}
      >
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: '50%',
            border: '18px solid #c9b07a',
            background: '#5f806b',
          }}
        />
      </div>
    ),
    size,
  );
}
