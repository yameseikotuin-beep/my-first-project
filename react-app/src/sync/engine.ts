import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getState, onDataChange, update } from '../store/store'
import { getSupabase } from '../cloud/supabase'
import { currentSession, onAuthChange } from '../cloud/auth'
import { nowIso } from '../util/time'
import { applyRemote, buildPushRows, diffState, emptyMeta, enqueue, enqueueAll, markPushed, type RemoteRecord, type SyncMeta } from './core'

/**
 * 端末間同期。ログイン中は変更を少し待ってまとめて送信し、
 * ログイン時・画面に戻ったとき・オンライン復帰時・1分ごとにサーバーの変更を取り込む。
 * 通信できない間の変更は端末内に保持し、次の同期で送る。
 */

const META_KEY = 'diet-recipe-maker:sync'
const PAGE = 500
const PUSH_CHUNK = 200

export type SyncState = 'off' | 'idle' | 'syncing' | 'error'
export interface SyncStatus {
  state: SyncState
  lastSyncedAt: string | null
  error: string | null
  pending: number
}

let meta: SyncMeta = loadMeta()
let status: SyncStatus = { state: 'off', lastSyncedAt: null, error: null, pending: Object.keys(meta.pending).length }
const listeners = new Set<() => void>()
let pushTimer: ReturnType<typeof setTimeout> | undefined
let running: Promise<void> | null = null
let again = false
let started = false

function loadMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY)
    return raw ? { ...emptyMeta(), ...(JSON.parse(raw) as SyncMeta) } : emptyMeta()
  } catch {
    return emptyMeta()
  }
}

function saveMeta() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // 保存できなくても次回の起動時に全件を再送するだけで、データは失われない
  }
}

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch, pending: Object.keys(meta.pending).length }
  listeners.forEach((l) => l())
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )
}

function errorText(e: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'オフラインです。接続が戻ったら自動で同期します。'
  const m = (e as { message?: string })?.message
  return m ? `同期に失敗しました（${m}）。自動で再試行します。` : '同期に失敗しました。自動で再試行します。'
}

async function pull(session: Session) {
  const sb = getSupabase()!
  for (;;) {
    let q = sb
      .from('sync_records')
      .select('collection, record_id, data, deleted, updated_at, server_updated_at')
      .eq('user_id', session.user.id)
      .order('server_updated_at', { ascending: true })
      .limit(PAGE)
    if (meta.lastPulledAt) q = q.gt('server_updated_at', meta.lastPulledAt)
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as RemoteRecord[]
    if (!rows.length) return
    const r = applyRemote(getState(), meta, rows)
    meta = r.meta
    update(() => r.data, 'remote')
    saveMeta()
    if (rows.length < PAGE) return
  }
}

async function push() {
  const sb = getSupabase()!
  const rows = buildPushRows(meta, getState())
  for (let i = 0; i < rows.length; i += PUSH_CHUNK) {
    const chunk = rows.slice(i, i + PUSH_CHUNK)
    const { error } = await sb.rpc('push_sync_records', { records: chunk })
    if (error) throw error
    meta = markPushed(meta, chunk)
    saveMeta()
  }
}

/** 今すぐ同期する（実行中なら終わったあとにもう一度） */
export function syncNow(): Promise<void> {
  const session = currentSession()
  if (!getSupabase() || !session) {
    setStatus({ state: 'off' })
    return Promise.resolve()
  }
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    setStatus({ state: 'syncing', error: null })
    try {
      await pull(session)
      await push()
      setStatus({ state: 'idle', lastSyncedAt: nowIso(), error: null })
    } catch (e) {
      setStatus({ state: 'error', error: errorText(e) })
    } finally {
      running = null
      if (again) {
        again = false
        void syncNow()
      }
    }
  })()
  return running
}

function schedulePush() {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void syncNow(), 1500)
}

function onSession(session: Session | null) {
  if (!session) {
    setStatus({ state: 'off' })
    return
  }
  if (meta.accountId !== session.user.id) {
    // このアカウントでの初回同期: 端末内の既存データをすべて送信し、サーバーの全データを取り込む
    meta = { ...enqueueAll(emptyMeta(), getState()), accountId: session.user.id }
    saveMeta()
  }
  void syncNow()
}

/** アプリ起動時に一度だけ呼ぶ */
export function startSync() {
  if (started || !getSupabase()) return
  started = true
  onDataChange((prev, next, origin) => {
    if (origin !== 'local') return
    meta = enqueue(meta, diffState(prev, next, nowIso()))
    saveMeta()
    setStatus({})
    if (currentSession()) schedulePush()
  })
  let lastUser: string | null | undefined
  onAuthChange((s) => {
    const id = s?.user.id ?? null
    if (id === lastUser) return
    lastUser = id
    onSession(s)
  })
  window.addEventListener('focus', () => void syncNow())
  window.addEventListener('online', () => void syncNow())
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 60_000)
}
