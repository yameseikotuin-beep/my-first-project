import 'server-only';

/**
 * 認証メールのリンク先に使うアプリの URL（末尾の / なし）。
 * 1. SITE_URL（独自ドメインを使う場合などに設定）
 * 2. Vercel が自動で設定する本番の URL（VERCEL_PROJECT_PRODUCTION_URL）
 * 3. NEXT_PUBLIC_SITE_URL（以前の設定名。互換のため）
 * 4. 開発用の http://localhost:3000
 */
export function getSiteUrl(): string {
  const strip = (v: string) => v.trim().replace(/\/+$/, '');
  if (process.env.SITE_URL?.trim()) return strip(process.env.SITE_URL);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${strip(vercel)}`;
  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) return strip(process.env.NEXT_PUBLIC_SITE_URL);
  return 'http://localhost:3000';
}
