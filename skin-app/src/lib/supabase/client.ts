'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { publicEnv } from '@/lib/env';

// 端末側の Supabase クライアント。ログイン中の本人の権限で動き、RLS が適用される。
export function createClient() {
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
