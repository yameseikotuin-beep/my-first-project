import { describe, expect, it } from 'vitest';
import { buildCsp } from '@/lib/csp';

describe('buildCsp', () => {
  it('nonce と Supabase の接続先を含む', () => {
    const csp = buildCsp('abc', 'https://proj.supabase.co', false);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic' 'wasm-unsafe-eval'");
    expect(csp).toContain('connect-src \'self\' https://proj.supabase.co wss://proj.supabase.co');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('開発時だけ unsafe-eval を許可する', () => {
    expect(buildCsp('abc', '', true)).toContain("'unsafe-eval'");
  });

  it('URL が不正でも壊れない', () => {
    expect(buildCsp('abc', 'not a url', false)).toContain("connect-src 'self'");
  });
});
