import { describe, expect, it } from 'vitest'
import { TEMPLATES } from './templates'
import { dishPhotoFor } from './dishPhotos'

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
  })

  it('肉の焼き物・煮物には魚の写真を使わない', () => {
    expect(dishPhotoFor({ templateId: 'jp-teriyaki', recipeName: '鶏むね肉の照り焼き', method: '焼く' }, false)).toBe('grill-meat')
    expect(dishPhotoFor({ templateId: 'jp-ankake', recipeName: '鶏むね肉と白菜の和風あんかけ', method: '煮る' }, false)).toBe('steam')
    expect(dishPhotoFor({ templateId: 'jp-mizore', recipeName: 'たらのみぞれ煮', method: '煮る' }, true)).toBe('simmer')
    expect(dishPhotoFor({ templateId: 'west-tomato', recipeName: '豚ヒレ肉とトマトのトマト煮', method: '煮る' }, false)).toBe('tomato-soup')
    expect(dishPhotoFor({ templateId: null, recipeName: '豆腐の彩りプレート', method: '加熱なし' })).toBe('salad')
  })
})
