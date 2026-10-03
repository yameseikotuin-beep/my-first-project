'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import type { SupabaseConfig } from '@/lib/env';

// 端末側の Supabase クライアント。ログイン中の本人の権限で動き、RLS が適用される。
// 接続先はサーバーの画面から受け取る（getSupabaseConfig() の値）。
export function createClient(config: SupabaseConfig) {
  return createBrowserClient<Database>(config.url, config.anonKey);
}
