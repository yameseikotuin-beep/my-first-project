import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/env';

const keys = [
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];

function env(values: Record<string, string>) {
  for (const key of keys) vi.stubEnv(key, values[key] ?? '');
}

describe('getSupabaseConfig', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('NEXT_PUBLIC_ の付かない名前を読める', () => {
    env({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_ANON_KEY: 'anon' });
    expect(getSupabaseConfig()).toEqual({ url: 'https://p.supabase.co', anonKey: 'anon' });
  });

  it('以前の NEXT_PUBLIC_ 付きの名前や PUBLISHABLE_KEY も読める', () => {
    env({ NEXT_PUBLIC_SUPABASE_URL: 'https://q.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' });
    expect(getSupabaseConfig()).toEqual({ url: 'https://q.supabase.co', anonKey: 'sb_publishable_x' });
  });

  it('前後の空白は取り除く', () => {
    env({ SUPABASE_URL: ' https://p.supabase.co ', SUPABASE_PUBLISHABLE_KEY: ' key ' });
    expect(getSupabaseConfig()).toEqual({ url: 'https://p.supabase.co', anonKey: 'key' });
  });

  it('未設定や URL でない値は「未接続」と判定する', () => {
    env({});
    expect(isSupabaseConfigured()).toBe(false);
    env({ SUPABASE_URL: 'rjbolplmcrnmerlxunty', SUPABASE_ANON_KEY: 'k' });
    expect(isSupabaseConfigured()).toBe(false);
    env({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_ANON_KEY: 'k' });
    expect(isSupabaseConfigured()).toBe(true);
  });
});
