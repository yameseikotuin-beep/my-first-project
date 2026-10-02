// Edge Function 共通: CORS・JSON応答・認証・利用回数の制限
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.117.2'

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })
}

export function errorJson(status: number, message: string): Response {
  return json({ error: message }, status)
}

/** ログイン中の利用者を確認する。service role のクライアントも返す（利用回数の記録・画像の保存用） */
export async function requireUser(req: Request): Promise<{ user: User; admin: SupabaseClient }> {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) throw new HttpError(401, 'ログインが必要です。')
  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data, error } = await userClient.auth.getUser(auth.slice('Bearer '.length))
  if (error || !data.user) throw new HttpError(401, 'ログインの有効期限が切れています。もう一度ログインしてください。')
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  return { user: data.user, admin }
}

/** 直近24時間の利用回数が上限を超えていないか確認する */
export async function checkRateLimit(admin: SupabaseClient, userId: string, kind: 'recipe' | 'image', limit: number) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', kind)
    .gte('created_at', since)
  if (error) throw new HttpError(500, '利用回数を確認できませんでした。')
  if ((count ?? 0) >= limit) {
    throw new HttpError(429, `1日の利用上限（${kind === 'recipe' ? 'AIレシピ' : '画像生成'} ${limit}回）に達しました。明日また利用してください。`)
  }
}

export async function recordUsage(admin: SupabaseClient, userId: string, kind: 'recipe' | 'image') {
  await admin.from('ai_usage').insert({ user_id: userId, kind })
}

export function envInt(name: string, fallback: number): number {
  const v = Number(Deno.env.get(name))
  return Number.isFinite(v) && v > 0 ? v : fallback
}
