import type { NextConfig } from 'next';

// CSP（Content-Security-Policy）はリクエストごとの nonce が必要なため src/proxy.ts で設定する。
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/icon.png' }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // 顔検出のモデル・WASM は長期キャッシュしてよい（個人情報を含まない）
        source: '/mediapipe/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
    ];
  },
};

export default nextConfig;
