import { describe, expect, it } from 'vitest';
import { homePathForRole, requiredRolesForPath, safeNextPath } from '@/lib/auth/roles';

describe('requiredRolesForPath', () => {
  it('役割ごとの画面', () => {
    expect(requiredRolesForPath('/me')).toEqual(['user']);
    expect(requiredRolesForPath('/me/photos')).toEqual(['user']);
    expect(requiredRolesForPath('/staff/customers/x')).toEqual(['staff', 'admin']);
    expect(requiredRolesForPath('/admin/staff')).toEqual(['admin']);
    expect(requiredRolesForPath('/consent')).toBe('any');
  });

  it('似た名前の URL を取り違えない', () => {
    expect(requiredRolesForPath('/meeting')).toBeNull();
    expect(requiredRolesForPath('/staffroom')).toBeNull();
    expect(requiredRolesForPath('/administrator')).toBeNull();
  });

  it('公開画面はログイン不要', () => {
    expect(requiredRolesForPath('/')).toBeNull();
    expect(requiredRolesForPath('/login')).toBeNull();
    expect(requiredRolesForPath('/legal/privacy')).toBeNull();
  });
});

describe('safeNextPath', () => {
  it('アプリ内の画面だけを許可する', () => {
    expect(safeNextPath('/me/photos')).toBe('/me/photos');
    expect(safeNextPath('/staff/customers?q=a')).toBe('/staff/customers?q=a');
  });

  it('外部サイトへの転送を防ぐ', () => {
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath('/login')).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});

describe('homePathForRole', () => {
  it('役割ごとのホーム', () => {
    expect(homePathForRole('user')).toBe('/me');
    expect(homePathForRole('staff')).toBe('/staff');
    expect(homePathForRole('admin')).toBe('/admin');
  });
});
