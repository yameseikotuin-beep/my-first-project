import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from '@/lib/csp';
import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/env';
import { requiredRolesForPath } from '@/lib/auth/roles';

// すべての画面の前に動く処理：
// 1. CSP の nonce を作ってヘッダーに付ける
// 2. Supabase のログイン状態（Cookie）を更新する
// 3. ログインが必要な画面に未ログインで来たらログイン画面へ移動する
//    （役割の確認は各画面のサーバー処理と RLS で行う。ここは使いやすさのための振り分け）
export async function proxy(request: NextRequest) {
  // 認証メールの戻り先が Supabase の「Site URL」（トップページなど）になった場合も、
  // 受け取った code を認証の受け口に渡してログインを完了させる
  const authCode = request.nextUrl.searchParams.get('code');
  if (authCode && request.nextUrl.pathname !== '/auth/confirm') {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/confirm';
    url.search = '';
    url.searchParams.set('code', authCode);
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const supabaseConfig = getSupabaseConfig();
  const csp = buildCsp(nonce, supabaseConfig.url, process.env.NODE_ENV === 'development');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const required = requiredRolesForPath(request.nextUrl.pathname);

  if (isSupabaseConfigured(supabaseConfig)) {
    const supabase = createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    });

    // getClaims() はトークンの署名を確認し、必要ならセッションを更新する
    const { data } = await supabase.auth.getClaims();
    const loggedIn = Boolean(data?.claims?.sub);

    if (required !== null && !loggedIn) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
      response = NextResponse.redirect(url);
    }
  } else if (required !== null) {
    const url = request.nextUrl.clone();
    url.pathname = '/setup-required';
    url.search = '';
    response = NextResponse.redirect(url);
  }

  response.headers.set('Content-Security-Policy', csp);
  if (required !== null) {
    // ログインが必要な画面（個人情報を含む）はキャッシュさせない
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|mediapipe/|favicon.ico|icon|apple-icon|manifest.webmanifest).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
