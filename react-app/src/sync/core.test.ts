import { describe, expect, it } from 'vitest'
import type { AppData } from '../store/store'
import type { Recipe } from '../types'
import { applyRemote, buildPushRows, diffState, emptyMeta, enqueue, enqueueAll, keyOf, markPushed, type RemoteRecord, type SyncMeta } from './core'

const empty = (): AppData => ({
  version: 1, activeUserId: null, profiles: [], settings: [], recipes: [], history: [], favorites: [],
  mealPlans: [], shoppingLists: [], inventory: [], customFoods: [], targetHistory: [],
})
const recipe = (id: string, name: string) => ({ id, userId: null, recipeName: name, updatedAt: '2026-10-01T00:00:00.000Z' }) as unknown as Recipe

/** サーバーの動き（Last Write Wins の upsert と、サーバー時刻での差分取得）を再現する */
class FakeServer {
  rows = new Map<string, RemoteRecord>()
  clock = 0
  push(rows: RemoteRecord[]) {
    for (const r of rows) {
      const k = keyOf(r.collection, r.record_id)
      const cur = this.rows.get(k)
      if (cur && cur.updated_at > r.updated_at) continue
      this.rows.set(k, { ...r, server_updated_at: `2026-10-02T00:00:${String(++this.clock).padStart(2, '0')}.000Z` })
    }
  }
  pull(since: string | null) {
    return [...this.rows.values()].filter((r) => !since || r.server_updated_at! > since).sort((a, b) => a.server_updated_at!.localeCompare(b.server_updated_at!))
  }
}

class Device {
  data = empty()
  meta: SyncMeta = emptyMeta()
  server: FakeServer
  constructor(server: FakeServer) {
    this.server = server
  }
  change(fn: (d: AppData) => AppData, now: string) {
    const next = fn(this.data)
    this.meta = enqueue(this.meta, diffState(this.data, next, now))
    this.data = next
  }
  sync() {
    const r = applyRemote(this.data, this.meta, this.server.pull(this.meta.lastPulledAt))
    this.data = r.data
    this.meta = r.meta
    const rows = buildPushRows(this.meta, this.data)
    this.server.push(rows)
    this.meta = markPushed(this.meta, rows)
  }
}

describe('同期: 変更の検出', () => {
  it('追加・変更・削除を検出し、変わっていないレコードは無視する', () => {
    const a = { ...empty(), recipes: [recipe('r1', 'A'), recipe('r2', 'B')] }
    const b = { ...a, recipes: [{ ...a.recipes[0], recipeName: 'A2' }, recipe('r3', 'C')] }
    const ch = diffState(a, b, 'T')
    expect(ch).toEqual([
      { collection: 'recipes', id: 'r1', updatedAt: 'T', deleted: false },
      { collection: 'recipes', id: 'r3', updatedAt: 'T', deleted: false },
      { collection: 'recipes', id: 'r2', updatedAt: 'T', deleted: true },
    ])
    expect(diffState(a, { ...a, recipes: a.recipes.map((r) => ({ ...r })) }, 'T')).toEqual([])
  })

  it('settings は利用者IDをIDとして扱う', () => {
    const a = empty()
    const b = { ...a, settings: [{ userId: null } as AppData['settings'][number]] }
    expect(diffState(a, b, 'T')[0]).toMatchObject({ collection: 'settings', id: 'guest' })
  })
})

describe('同期: 2台の端末', () => {
  it('片方の追加・変更・削除がもう片方に反映される', () => {
    const server = new FakeServer()
    const pc = new Device(server)
    const phone = new Device(server)
    pc.change((d) => ({ ...d, recipes: [recipe('r1', 'から揚げ')] }), '2026-10-02T01:00:00.000Z')
    pc.sync()
    phone.sync()
    expect(phone.data.recipes.map((r) => r.recipeName)).toEqual(['から揚げ'])

    phone.change((d) => ({ ...d, recipes: d.recipes.map((r) => ({ ...r, recipeName: '蒸し鶏' })) }), '2026-10-02T02:00:00.000Z')
    phone.sync()
    pc.sync()
    expect(pc.data.recipes[0].recipeName).toBe('蒸し鶏')

    pc.change((d) => ({ ...d, recipes: [] }), '2026-10-02T03:00:00.000Z')
    pc.sync()
    phone.sync()
    expect(phone.data.recipes).toEqual([])
    expect(Object.keys(pc.meta.pending)).toEqual([])
  })

  it('同じレコードを両方で変更した場合は、後から変更した方が残る', () => {
    const server = new FakeServer()
    const a = new Device(server)
    const b = new Device(server)
    a.change((d) => ({ ...d, recipes: [recipe('r1', '初版')] }), '2026-10-02T01:00:00.000Z')
    a.sync()
    b.sync()
    // オフライン中に両方で編集（b の方が後）
    a.change((d) => ({ ...d, recipes: [{ ...d.recipes[0], recipeName: 'Aの編集' }] }), '2026-10-02T02:00:00.000Z')
    b.change((d) => ({ ...d, recipes: [{ ...d.recipes[0], recipeName: 'Bの編集' }] }), '2026-10-02T03:00:00.000Z')
    b.sync()
    a.sync()
    b.sync()
    expect(a.data.recipes[0].recipeName).toBe('Bの編集')
    expect(b.data.recipes[0].recipeName).toBe('Bの編集')
  })

  it('端末に未送信のより新しい変更があれば、古いサーバーの値で上書きしない', () => {
    const d = { ...empty(), recipes: [recipe('r1', '新しい')] }
    const meta = enqueue(emptyMeta(), [{ collection: 'recipes', id: 'r1', updatedAt: '2026-10-02T05:00:00.000Z', deleted: false }])
    const r = applyRemote(d, meta, [{ collection: 'recipes', record_id: 'r1', data: recipe('r1', '古い'), deleted: false, updated_at: '2026-10-02T04:00:00.000Z', server_updated_at: 'S1' }])
    expect(r.data.recipes[0].recipeName).toBe('新しい')
    expect(r.meta.lastPulledAt).toBe('S1')
  })

  it('初回ログイン時は端末内の既存データをすべて送信する', () => {
    const server = new FakeServer()
    const old = new Device(server)
    old.data = { ...empty(), recipes: [recipe('r1', 'A')], inventory: [{ id: 'i1', userId: null, name: '卵', foodId: '12004', amount: 2, unit: '個', expiry: null, createdAt: '2026-09-30T00:00:00.000Z' }] }
    old.meta = enqueueAll(emptyMeta(), old.data)
    old.sync()
    const fresh = new Device(server)
    fresh.sync()
    expect(fresh.data.recipes).toHaveLength(1)
    expect(fresh.data.inventory).toHaveLength(1)
  })

  it('削除された利用者を選択していた場合はゲストに戻す', () => {
    const d = { ...empty(), activeUserId: 'p1', profiles: [{ id: 'p1' } as AppData['profiles'][number]] }
    const r = applyRemote(d, emptyMeta(), [{ collection: 'profiles', record_id: 'p1', data: null, deleted: true, updated_at: 'T', server_updated_at: 'S' }])
    expect(r.data.activeUserId).toBeNull()
    expect(r.data.profiles).toEqual([])
  })
})
