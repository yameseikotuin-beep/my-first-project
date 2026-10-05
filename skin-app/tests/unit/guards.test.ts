import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requiredRolesForPath } from '@/lib/auth/roles';

// 権限の確認漏れを防ぐ：画面とサーバーの処理が、必ず役割を確かめていること

const root = path.resolve(import.meta.dirname, '../../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(root);
const pages = files.filter((f) => f.endsWith('/page.tsx') && f.includes(`${path.sep}app${path.sep}`));

/** src/app/(group)/a/[id]/page.tsx → /a/[id] */
function routeOf(file: string): string {
  const rel = path.relative(path.join(root, 'app'), path.dirname(file));
  const parts = rel.split(path.sep).filter((s) => s && !s.startsWith('('));
  return `/${parts.join('/')}`;
}

describe('画面の権限', () => {
  it.each(pages.map((f) => [routeOf(f), f]))('%s', (route, file) => {
    const src = readFileSync(file, 'utf8');
    const required = requiredRolesForPath(route);
    if (required === null) {
      // ログイン不要の画面（ログイン・規約など）
      return;
    }
    if (required === 'any') {
      expect(src).toMatch(/getCurrentUser\(|requireRole\(/);
      return;
    }
    // 画面が要求する役割は、URL ごとの決まり（proxy でも使う）と一致していなければならない
    const m = src.match(/requireRole\(\[([^\]]*)\]\)/);
    expect(m, `${route} に requireRole がありません`).not.toBeNull();
    const roles = m![1].split(',').map((s) => s.trim().replace(/'/g, '')).sort();
    expect(roles).toEqual([...required].sort());
  });
});

describe('サーバーの処理（Server Actions）の権限', () => {
  const actionFiles = files.filter((f) => /\.tsx?$/.test(f) && readFileSync(f, 'utf8').startsWith("'use server'"));
  // ログイン前に使う処理だけは確認しない
  const publicActions = new Set(['login', 'signup', 'requestPasswordReset', 'updatePassword', 'logout']);

  it('処理のファイルが見つかる', () => {
    expect(actionFiles.length).toBeGreaterThan(5);
  });

  for (const file of actionFiles) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{/g)) {
      if (publicActions.has(m[1])) continue;
      it(`${path.relative(root, file)}: ${m[1]}`, () => {
        const body = src.slice(m.index! + m[0].length, m.index! + m[0].length + 400);
        expect(body).toMatch(/requireRole\(|getCurrentUser\(/);
      });
    }
  }
});
