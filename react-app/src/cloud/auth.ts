import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

/** ログイン状態（Supabase Auth） */
let session: Session | null = null
let ready = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const sb = getSupabase()
if (sb) {
  sb.auth.getSession().then(({ data }) => {
    session = data.session
    ready = true
    emit()
  })
  sb.auth.onAuthStateChange((_event, s) => {
    session = s
    ready = true
    emit()
  })
} else {
  ready = true
}

export interface AuthState {
  ready: boolean
  session: Session | null
}

let snapshot: AuthState = { ready, session }
export function useAuth(): AuthState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => {
      if (snapshot.ready !== ready || snapshot.session !== session) snapshot = { ready, session }
      return snapshot
    },
  )
}

export function onAuthChange(fn: (s: Session | null) => void): () => void {
  const l = () => fn(session)
  listeners.add(l)
  return () => listeners.delete(l)
}

export function currentSession() {
  return session
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'メールアドレスまたはパスワードが正しくありません。',
  email_not_confirmed: 'メールアドレスの確認が済んでいません。届いたメールのリンクを開いてください。',
  user_already_exists: 'このメールアドレスはすでに登録されています。ログインしてください。',
  weak_password: 'パスワードが弱すぎます。8文字以上で、英字と数字を組み合わせてください。',
  over_email_send_rate_limit: 'メールの送信回数の上限に達しました。しばらく待ってから再試行してください。',
}

function authMessage(error: { code?: string; message: string }): string {
  return (error.code && MESSAGES[error.code]) || `処理できませんでした（${error.message}）。`
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const s = getSupabase()
  if (!s) return 'クラウド機能が設定されていません。'
  const { error } = await s.auth.signInWithPassword({ email, password })
  return error ? authMessage(error) : null
}

export async function signUp(email: string, password: string): Promise<{ error: string | null; needsConfirm: boolean }> {
  const s = getSupabase()
  if (!s) return { error: 'クラウド機能が設定されていません。', needsConfirm: false }
  const { data, error } = await s.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href.split('#')[0] } })
  if (error) return { error: authMessage(error), needsConfirm: false }
  return { error: null, needsConfirm: !data.session }
}

export async function signOut() {
  await getSupabase()?.auth.signOut()
}
