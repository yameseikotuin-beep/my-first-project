import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { buildCsp } from '@/lib/csp';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('セキュリティの確認', () => {
  it('CSP はスクリプトを nonce で制限し、外部への接続は Supabase だけ', () => {
    const csp = buildCsp('abc', 'https://xyz.supabase.co', false);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain('connect-src \'self\' https://xyz.supabase.co');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-eval');
  });
  it('ソースコードに秘密鍵（service_role）や NEXT_PUBLIC_ の秘密情報を使っていない', () => {
    for (const f of files(path.resolve(import.meta.dirname, '../../src'))) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(/SERVICE_ROLE/);
      expect(text, f).not.toMatch(/NEXT_PUBLIC_(?!SUPABASE_(URL|ANON_KEY|PUBLISHABLE_KEY))[A-Z]/);
    }
  });
  it('管理用のサーバー処理はすべて最初に管理者を確認する', () => {
    const dir = path.resolve(import.meta.dirname, '../../src/features/admin');
    for (const f of ['booking-actions.ts', 'settings-actions.ts']) {
      const text = readFileSync(path.join(dir, f), 'utf8');
      const fns = text.split(/export async function /).slice(1);
      expect(fns.length).toBeGreaterThan(0);
      for (const fn of fns) {
        const name = fn.slice(0, fn.indexOf('('));
        expect(fn.split('\n').slice(0, 3).join('\n'), `${f}: ${name}`).toContain('await requireAdmin()');
      }
    }
  });
  it('管理画面のページはすべて requireAdmin() を呼ぶ', () => {
    const dir = path.resolve(import.meta.dirname, '../../src/app/admin/(panel)');
    const pages = files(dir).filter((f) => f.endsWith('page.tsx') || f.endsWith('layout.tsx'));
    expect(pages.length).toBeGreaterThan(10);
    for (const p of pages) expect(readFileSync(p, 'utf8'), p).toContain('requireAdmin()');
  });
});
