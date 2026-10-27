/** リクエストごとの nonce を使った Content-Security-Policy を組み立てる */
export function buildCsp(nonce: string, supabaseUrl: string, isDev: boolean): string {
  let supabaseOrigin = '';
  try {
    supabaseOrigin = new URL(supabaseUrl).origin;
  } catch {
    // 未設定の場合は Supabase への接続を許可しない
  }
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // React の style 属性のため 'unsafe-inline' を許可（スクリプトは nonce で制限している）
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseOrigin}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ];
  return directives.join('; ');
}
