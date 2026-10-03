import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { publicEnv } from '@/lib/env';

// RLS を通らない管理用クライアント。用途はスタッフの招待と、それに伴う役割の設定だけに限定する。
// 呼び出す前に、必ず呼び出した人が管理者であることを確認すること。
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY が設定されていません');
  }
  return createClient<Database>(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isAdminClientConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
