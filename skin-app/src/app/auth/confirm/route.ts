import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/auth/roles';

const otpTypes: readonly EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

// 認証メールのリンクの受け口。
// - token_hash 方式（メールテンプレートを docs/setup.md のとおり設定した場合）
// - code 方式（Supabase 既定の PKCE フロー）
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const supabase = await createClient();

  let ok = false;
  if (tokenHash && type && otpTypes.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const url = request.nextUrl.clone();
  url.search = '';
  if (!ok) {
    url.pathname = '/login';
    url.searchParams.set('error', 'link');
    return NextResponse.redirect(url);
  }
  const forced = type === 'recovery' || type === 'invite' ? '/update-password' : null;
  // next は「/staff?tab=x」のように検索条件を含むことがあるため、パスと検索条件に分けて設定する
  const target = new URL(forced ?? safeNextPath(searchParams.get('next')) ?? '/home', url.origin);
  url.pathname = target.pathname;
  url.search = target.search;
  return NextResponse.redirect(url);
}
