#!/usr/bin/env node
/**
 * src/data/foods.ts の食品一覧を、Edge Function 用の JSON（AIに渡す食品リスト）に書き出す。
 * 食品データを更新したら実行する: npm run export-foods
 * 栄養値はAIが分量の目安を立てるためだけに使い、実際の計算は常にアプリ側で行う。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(here, '../src/data/foods.ts'), 'utf8')
const re = /f\('(\d{5})', '[^']*', '([^']*)', '([^']*)', '([a-z]+)', '([^']*)', \[([^\]]*)\]/g
const out = []
for (const m of src.matchAll(re)) {
  const [kcal, p, f, c] = m[6].split(',').map((x) => Number(x.trim()))
  out.push({ id: m[1], name: m[2], category: m[3], role: m[4], state: m[5], kcal, p, f, c })
}
if (out.length < 50) throw new Error(`食品の読み取りに失敗しました（${out.length}件）`)
const dest = path.join(here, '../supabase/functions/_shared/foods.json')
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n')
console.log(`${out.length}件を ${path.relative(process.cwd(), dest)} に書き出しました`)
