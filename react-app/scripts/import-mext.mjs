#!/usr/bin/env node
/**
 * 日本食品標準成分表（文部科学省）の公式ファイルから、src/data/foods.ts の栄養値を更新する。
 *
 * 使い方:
 *   1. 文部科学省のサイトから「本表」のExcelをダウンロードし、CSV（UTF-8）で保存する。
 *   2. node scripts/import-mext.mjs <CSVファイル> [--dry-run]
 *
 * 食品番号で照合し、エネルギー(kcal)・たんぱく質・脂質・炭水化物・食物繊維総量・食塩相当量を
 * 上書きして verification を 'verified' にする。列は成分識別子（ENERC_KCAL, PROT-, FAT-,
 * CHOCDF-, FIB-, NACL_EQ）または見出しの文字で探す。
 * 成分表上の食品名がアプリの登録名と大きく異なる場合は、取り違えの可能性があるため更新せず報告する。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [csvPath, ...flags] = process.argv.slice(2)
const dryRun = flags.includes('--dry-run')
if (!csvPath) {
  console.error('使い方: node scripts/import-mext.mjs <本表のCSV> [--dry-run]')
  process.exit(1)
}

function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

/** 成分表の表記（Tr, (0), (1.2), -, *）を数値に */
function num(v) {
  const s = String(v ?? '').trim().replace(/[()（）*†]/g, '')
  if (s === '' || s === '-') return null
  if (/^tr$/i.test(s)) return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const norm = (s) => String(s).normalize('NFKC').replace(/\s/g, '')
const rows = parseCsv(fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, ''))

const COLS = {
  kcal: { tags: ['ENERC_KCAL'], text: (h) => h.includes('エネルギー') && h.includes('kcal') },
  protein: { tags: ['PROT-'], text: (h) => h === 'たんぱく質' },
  fat: { tags: ['FAT-'], text: (h) => h === '脂質' },
  carbs: { tags: ['CHOCDF-'], text: (h) => h === '炭水化物' },
  fiber: { tags: ['FIB-'], text: (h) => h.startsWith('食物繊維総量') },
  salt: { tags: ['NACL_EQ'], text: (h) => h.startsWith('食塩相当量') },
}
const idx = { id: -1, name: -1 }
for (const r of rows.slice(0, 15)) {
  r.forEach((c, i) => {
    const h = norm(c)
    if (h === '食品番号') idx.id = i
    if (h === '食品名') idx.name = i
    for (const [k, def] of Object.entries(COLS)) {
      if (idx[k] === undefined && (def.tags.includes(h) || def.text(h))) idx[k] = i
    }
  })
}
const missingCols = ['id', 'name', ...Object.keys(COLS)].filter((k) => idx[k] === undefined || idx[k] < 0)
if (missingCols.length) {
  console.error(`列が見つかりません: ${missingCols.join(', ')}（本表のCSVか確認してください）`)
  process.exit(1)
}

const official = new Map()
for (const r of rows) {
  const id = String(r[idx.id] ?? '').trim()
  if (!/^\d{5}$/.test(id)) continue
  official.set(id, {
    name: r[idx.name],
    values: [num(r[idx.kcal]), num(r[idx.protein]), num(r[idx.fat]), num(r[idx.carbs]), num(r[idx.fiber]), num(r[idx.salt])],
  })
}

const foodsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/data/foods.ts')
let src = fs.readFileSync(foodsPath, 'utf8')
const line = /f\('(\d{5})', '([^']*)', '([^']*)',([^\n]*?)\[([^\]]*)\]((?:, \{[^\n]*\})?)\),/g
let updated = 0, changed = 0
const problems = []
src = src.replace(line, (all, id, name, display, mid, arr, opts) => {
  const o = official.get(id)
  if (!o) { problems.push(`${id} ${display}: 公式ファイルに食品番号がありません`); return all }
  const a = norm(name).replace(/[＜＞<>［］[\]（）()]/g, '')
  const b = norm(o.name).replace(/[＜＞<>［］[\]（）()]/g, '')
  const common = [...new Set(b)].filter((ch) => a.includes(ch)).length / Math.max(new Set(b).size, 1)
  if (common < 0.6) { problems.push(`${id} ${display}: 食品名が一致しません（公式: ${o.name}）→ 更新しません`); return all }
  if (o.values.slice(0, 4).some((v) => v === null)) { problems.push(`${id} ${display}: 主要成分の値が空です → 更新しません`); return all }
  const old = arr.split(',').map((x) => Number(x.trim()))
  const next = o.values.map((v) => v ?? 0)
  if (next.some((v, i) => v !== old[i])) {
    changed++
    console.log(`更新 ${id} ${display}: [${old.join(', ')}] → [${next.join(', ')}]`)
  }
  updated++
  const newOpts = opts
    ? opts.includes("verification:") ? opts.replace(/verification: '[a-z]+'/, "verification: 'verified'") : opts.replace(/ \}$/, ", verification: 'verified' }")
    : ", { verification: 'verified' }"
  return `f('${id}', '${o.name.replace(/'/g, '’')}', '${display}',${mid}[${next.join(', ')}]${newOpts}),`
})

console.log(`\n照合: ${updated}件（うち値の変更 ${changed}件）`)
if (problems.length) console.log(`要確認: ${problems.length}件\n${problems.map((p) => `  - ${p}`).join('\n')}`)
if (dryRun) console.log('\n--dry-run のためファイルは変更していません。')
else {
  fs.writeFileSync(foodsPath, src)
  console.log(`\n${path.relative(process.cwd(), foodsPath)} を更新しました。npm test で検算テストを実行してください。`)
}
