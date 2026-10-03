import 'server-only';

/**
 * 認証メールのリンク先に使うアプリの URL（末尾の / なし）。
 * 1. SITE_URL（独自ドメインを使う場合などに設定）
 * 2. NEXT_PUBLIC_SITE_URL（以前の設定名。互換のため）
 * 3. Vercel が自動で設定する本番の URL（VERCEL_PROJECT_PRODUCTION_URL）
 * 4. 開発用の http://localhost:3000
 */
export function getSiteUrl(): string {
  const configured = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;
  return 'http://localhost:3000';
}
