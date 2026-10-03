import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';

/**
 * 監査ログを記録する。操作した人はデータベース側で auth.uid() から自動設定される。
 * metadata に氏名・連絡先・写真などの個人情報を入れないこと。
 */
export async function writeAudit(
  supabase: SupabaseClient<Database>,
  action: string,
  target?: { type: string; id: string },
  metadata: Record<string, Json> = {},
): Promise<void> {
  const { error } = await supabase.rpc('write_audit_log', {
    p_action: action,
    p_target_type: target?.type,
    p_target_id: target?.id,
    p_metadata: metadata,
  });
  if (error) {
    // 監査ログの失敗で利用者の操作は止めないが、サーバーのログには残す（個人情報は出さない）
    console.error('[audit] failed to write audit log', { action, code: error.code });
  }
}
