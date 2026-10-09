import { describe, expect, it } from 'vitest'
import { TEMPLATES } from './templates'
import { dishPhotoFor } from './dishPhotos'
import { PHOTO_CREDITS } from './photoCredits'

// public/dishes にある写真ファイルの一覧（Vite がテスト時に解決する）
const files = Object.keys(import.meta.glob('../../public/dishes/*.jpg')).map((f) => f.split('/').pop())

describe('料理のイメージ写真', () => {
  it('すべての料理の型に写真があり、ファイルが存在する', () => {
    for (const t of TEMPLATES) {
      for (const fish of [true, false]) {
        const photo = dishPhotoFor({ templateId: t.id, recipeName: t.name, method: t.methods[0] }, fish)
        expect(files, `${t.id} → ${photo}`).toContain(`${photo}.jpg`)
      }
    }
  })

  it('AIが考案したレシピは料理名・調理方法から選ぶ', () => {
    expect(dishPhotoFor({ templateId: null, recipeName: '鶏むね肉の生姜スープ', method: '煮る' })).toBe('soup')
    expect(dishPhotoFor({ templateId: null, recipeName: 'えびとブロッコリーの塩炒め', method: '炒める' })).toBe('stirfry')
    expect(dishPhotoFor({ templateId: null, recipeName: '鮭のハーブ焼き', method: '焼く' }, true)).toBe('grill')
    expect(dishPhotoFor({ templateId: null, recipeName: '鶏むね肉の麻婆豆腐', method: '煮る' }, false)).toBe('cn-mabo')
    expect(dishPhotoFor({ templateId: null, recipeName: '鮭の照り焼き', method: '焼く' }, true)).toBe('jp-teriyaki-fish')
    expect(dishPhotoFor({ templateId: null, recipeName: '豚肉の具だくさん味噌汁', method: '煮る' }, false)).toBe('jp-miso-soup')
  })

  it('料理の型ごとの写真を使い、魚と肉で写真を分ける', () => {
    const p = (templateId: string, fish: boolean) => dishPhotoFor({ templateId, recipeName: '', method: null }, fish)
    expect(p('cn-mabo', false)).toBe('cn-mabo')
    expect(p('kr-bibimbap', false)).toBe('kr-bibimbap')
    expect(p('jp-teriyaki', true)).toBe('jp-teriyaki-fish')
    expect(p('jp-teriyaki', false)).toBe('jp-teriyaki')
    expect(p('jp-steam', true)).toBe('cn-steam-fish')
    expect(p('jp-foil', false)).toBe('jp-steam')
    // 種類の多さ: 26種類の料理の型に20種類以上の写真
    const kinds = new Set(TEMPLATES.flatMap((t) => [p(t.id, true), p(t.id, false)]))
    expect(kinds.size).toBeGreaterThanOrEqual(20)
  })

  it('使っている写真すべてに出典がある', () => {
    for (const f of files) expect(PHOTO_CREDITS.map((c) => `${c.photo}.jpg`), f).toContain(f)
  })

  it('肉の焼き物・煮物には魚の写真を使わない', () => {
    expect(dishPhotoFor({ templateId: 'jp-teriyaki', recipeName: '鶏むね肉の照り焼き', method: '焼く' }, false)).toBe('jp-teriyaki')
    expect(dishPhotoFor({ templateId: null, recipeName: '豚肉のハーブ焼き', method: '焼く' }, false)).toBe('grill-meat')
    expect(dishPhotoFor({ templateId: 'jp-ankake', recipeName: '鶏むね肉と白菜の和風あんかけ', method: '煮る' }, false)).toBe('steam')
    expect(dishPhotoFor({ templateId: 'jp-mizore', recipeName: 'たらのみぞれ煮', method: '煮る' }, true)).toBe('simmer')
    expect(dishPhotoFor({ templateId: 'west-tomato', recipeName: '豚ヒレ肉とトマトのトマト煮', method: '煮る' }, false)).toBe('tomato-soup')
    expect(dishPhotoFor({ templateId: null, recipeName: '豆腐の彩りプレート', method: '加熱なし' })).toBe('salad')
  })
})
