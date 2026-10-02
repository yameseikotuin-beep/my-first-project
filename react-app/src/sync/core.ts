import type { AppData } from '../store/store'

/**
 * 端末間同期の中核ロジック（Supabase に依存しない純粋な関数）。
 *
 * 各レコードを (collection, id) で識別し、更新時刻の新しい方を採用する（Last Write Wins）。
 * 削除は「削除済み」の印（tombstone）として同期する。
 */

export const COLLECTIONS = [
  'profiles', 'settings', 'recipes', 'history', 'favorites', 'mealPlans', 'shoppingLists', 'inventory', 'customFoods', 'targetHistory',
] as const
export type Collection = (typeof COLLECTIONS)[number]

/** settings だけは id を持たないため、利用者ID（ゲストは 'guest'）を id とする */
export function recordId(collection: Collection, record: unknown): string {
  const r = record as { id?: string; userId?: string | null }
  if (collection === 'settings') return r.userId ?? 'guest'
  return String(r.id)
}

export const keyOf = (collection: Collection, id: string) => `${collection}:${id}`

export interface PendingChange {
  collection: Collection
  id: string
  updatedAt: string
  deleted: boolean
}

export interface RemoteRecord {
  collection: Collection
  record_id: string
  data: unknown
  deleted: boolean
  updated_at: string
  server_updated_at?: string
}

export interface SyncMeta {
  /** 同期しているアカウント（Supabase のユーザーID） */
  accountId: string | null
  /** 最後に取得したサーバー側の更新時刻 */
  lastPulledAt: string | null
  pending: Record<string, PendingChange>
}

export const emptyMeta = (): SyncMeta => ({ accountId: null, lastPulledAt: null, pending: {} })

function list(d: AppData, c: Collection): unknown[] {
  return d[c] as unknown[]
}

/** 変更前後の状態を比べ、追加・変更・削除されたレコードを返す */
export function diffState(prev: AppData, next: AppData, now: string): PendingChange[] {
  const out: PendingChange[] = []
  for (const c of COLLECTIONS) {
    const a = list(prev, c)
    const b = list(next, c)
    if (a === b) continue
    const before = new Map(a.map((r) => [recordId(c, r), r]))
    const after = new Map(b.map((r) => [recordId(c, r), r]))
    for (const [id, r] of after) {
      const old = before.get(id)
      if (old === r) continue
      if (old && JSON.stringify(old) === JSON.stringify(r)) continue
      out.push({ collection: c, id, updatedAt: now, deleted: false })
    }
    for (const id of before.keys()) if (!after.has(id)) out.push({ collection: c, id, updatedAt: now, deleted: true })
  }
  return out
}

/** 変更を未送信キューに積む（同じレコードは最新の変更だけ残す） */
export function enqueue(meta: SyncMeta, changes: PendingChange[]): SyncMeta {
  if (!changes.length) return meta
  const pending = { ...meta.pending }
  for (const ch of changes) pending[keyOf(ch.collection, ch.id)] = ch
  return { ...meta, pending }
}

/** 初回同期用に、端末内のすべてのレコードを未送信として積む */
export function enqueueAll(meta: SyncMeta, d: AppData): SyncMeta {
  const changes: PendingChange[] = []
  for (const c of COLLECTIONS) {
    for (const r of list(d, c)) {
      const t = (r as { updatedAt?: string; createdAt?: string }).updatedAt || (r as { createdAt?: string }).createdAt || '1970-01-01T00:00:00.000Z'
      changes.push({ collection: c, id: recordId(c, r), updatedAt: t, deleted: false })
    }
  }
  return enqueue(meta, changes)
}

/** 送信する行を作る */
export function buildPushRows(meta: SyncMeta, d: AppData): RemoteRecord[] {
  return Object.values(meta.pending).map((p) => {
    const rec = p.deleted ? undefined : list(d, p.collection).find((r) => recordId(p.collection, r) === p.id)
    return { collection: p.collection, record_id: p.id, data: rec ?? null, deleted: p.deleted || !rec, updated_at: p.updatedAt }
  })
}

/** 送信が完了した変更をキューから外す（送信中にさらに更新されたものは残す） */
export function markPushed(meta: SyncMeta, pushed: RemoteRecord[]): SyncMeta {
  const pending = { ...meta.pending }
  for (const row of pushed) {
    const k = keyOf(row.collection, row.record_id)
    if (pending[k] && pending[k].updatedAt === row.updated_at) delete pending[k]
  }
  return { ...meta, pending }
}

/**
 * サーバーから取得したレコードを端末の状態に反映する。
 * 端末側により新しい未送信の変更がある場合は、端末側を優先する。
 */
export function applyRemote(d: AppData, meta: SyncMeta, rows: RemoteRecord[]): { data: AppData; meta: SyncMeta } {
  let data = d
  const pending = { ...meta.pending }
  let lastPulledAt = meta.lastPulledAt
  for (const row of rows) {
    if (row.server_updated_at && (!lastPulledAt || row.server_updated_at > lastPulledAt)) lastPulledAt = row.server_updated_at
    if (!(COLLECTIONS as readonly string[]).includes(row.collection)) continue
    const k = keyOf(row.collection, row.record_id)
    const local = pending[k]
    if (local && local.updatedAt > row.updated_at) continue
    if (local) delete pending[k]
    const arr = list(data, row.collection)
    const idx = arr.findIndex((r) => recordId(row.collection, r) === row.record_id)
    let nextArr: unknown[]
    if (row.deleted || row.data == null) nextArr = idx >= 0 ? arr.filter((_, i) => i !== idx) : arr
    else if (idx >= 0) nextArr = arr.map((r, i) => (i === idx ? row.data : r))
    else nextArr = [row.data, ...arr]
    if (nextArr !== arr) data = { ...data, [row.collection]: nextArr }
  }
  // 利用者の選択が削除された場合はゲストに戻す
  if (data.activeUserId && !data.profiles.some((p) => p.id === data.activeUserId)) data = { ...data, activeUserId: null }
  return { data, meta: { ...meta, pending, lastPulledAt } }
}
