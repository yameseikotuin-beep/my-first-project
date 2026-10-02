import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase クライアント。環境変数が未設定ならクラウド機能は無効（端末内だけで動作）。
 * VITE_SUPABASE_ANON_KEY は公開前提の鍵で、データはサーバー側の RLS で保護される。
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudConfigured = !!(url && anonKey)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!cloudConfigured) return null
  client ??= createClient(url!, anonKey!, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'diet-recipe-maker:auth' },
  })
  return client
}

/** Edge Function のエラーを利用者向けのメッセージに変換する */
export async function functionErrorMessage(error: unknown): Promise<string> {
  const e = error as { name?: string; message?: string; context?: Response }
  if (e?.name === 'FunctionsHttpError' && e.context) {
    try {
      const body = (await e.context.json()) as { error?: string }
      if (body?.error) return body.error
    } catch {
      // 本文がJSONでない場合は下の汎用メッセージ
    }
    return `サーバーでエラーが発生しました（${e.context.status}）。`
  }
  if (e?.name === 'FunctionsFetchError') return 'サーバーに接続できませんでした。通信環境を確認して再試行してください。'
  if (e?.name === 'FunctionsRelayError') return 'サーバーが一時的に応答しませんでした。少し待ってから再試行してください。'
  return e?.message || '不明なエラーが発生しました。'
}
