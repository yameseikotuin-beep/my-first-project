import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // 外部（予約ページ・広告）へ URL のパスを渡さない
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // /pelvis/ のように末尾スラッシュ付きの URL にそろえる
  trailingSlash: true,
  // E2E テストで設定の異なるビルドを並べるため（通常は .next）
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    qualities: [75],
    localPatterns: [{ pathname: '/images/**' }],
  },
  async redirects() {
    return [{ source: '/', destination: '/pelvis/', permanent: false }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
