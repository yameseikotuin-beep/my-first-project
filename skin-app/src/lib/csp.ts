/** リクエストごとの nonce を使った Content-Security-Policy を組み立てる */
export function buildCsp(nonce: string, supabaseUrl: string, isDev: boolean): string {
  let supabaseOrigin = '';
  let supabaseWs = '';
  try {
    const url = new URL(supabaseUrl);
    supabaseOrigin = url.origin;
    supabaseWs = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`;
  } catch {
    // 未設定の場合は Supabase への接続を許可しない
  }
  const directives = [
    "default-src 'self'",
    // 'wasm-unsafe-eval' は端末内の顔検出（MediaPipe の WASM）に必要
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
    // React の style 属性のため 'unsafe-inline' を許可（スクリプトは nonce で制限している）
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabaseOrigin}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`.trim(),
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ];
  return directives.join('; ');
}
