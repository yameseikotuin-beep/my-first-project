import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from '@/lib/csp';
import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/env';

// すべての画面の前に動く処理：
// 1. CSP の nonce を作ってヘッダーに付ける
// 2. 管理画面では Supabase のログイン状態（Cookie）を更新し、未ログインならログイン画面へ移動する
//    （管理者かどうかの確認は各画面・各処理のサーバー側と RLS で行う。ここは振り分けのため）
function isProtected(pathname: string): boolean {
  return (pathname === '/admin' || pathname.startsWith('/admin/')) && pathname !== '/admin/login';
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const supabaseConfig = getSupabaseConfig();
  const csp = buildCsp(nonce, supabaseConfig.url, process.env.NODE_ENV === 'development');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const pathname = request.nextUrl.pathname;
  const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');

  if (isAdminArea && isSupabaseConfigured(supabaseConfig)) {
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
    // getClaims() はトークンを確認し、必要ならセッションを更新する
    const { data } = await supabase.auth.getClaims();
    if (isProtected(pathname) && !data?.claims?.sub) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = '';
      response = NextResponse.redirect(url);
    }
  } else if (isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    response = NextResponse.redirect(url);
  }

  response.headers.set('Content-Security-Policy', csp);
  // 予約の入力・確認・完了、管理画面は個人情報を含むためキャッシュさせない
  if (isAdminArea || pathname.startsWith('/book')) {
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
