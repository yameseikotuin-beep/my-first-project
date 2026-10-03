import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { getSiteUrl } = await import('@/lib/site-url');

describe('getSiteUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  function env(values: Record<string, string>) {
    for (const key of ['SITE_URL', 'NEXT_PUBLIC_SITE_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
      vi.stubEnv(key, values[key] ?? '');
    }
  }

  it('SITE_URL を最優先する（末尾の / は除く）', () => {
    env({ SITE_URL: 'https://salon.example.jp/', VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' });
    expect(getSiteUrl()).toBe('https://salon.example.jp');
  });

  it('以前の NEXT_PUBLIC_SITE_URL も読める', () => {
    env({ NEXT_PUBLIC_SITE_URL: 'https://old.example.jp' });
    expect(getSiteUrl()).toBe('https://old.example.jp');
  });

  it('未設定なら Vercel の本番 URL を使う', () => {
    env({ VERCEL_PROJECT_PRODUCTION_URL: 'my-first-project-one-mu.vercel.app' });
    expect(getSiteUrl()).toBe('https://my-first-project-one-mu.vercel.app');
  });

  it('どれもなければ開発用の URL', () => {
    env({});
    expect(getSiteUrl()).toBe('http://localhost:3000');
  });
});
