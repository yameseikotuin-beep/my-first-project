import { describe, expect, it } from 'vitest';
import { customerSchema, sanitizeSearch, signupSchema } from '@/lib/validation/schemas';

describe('signupSchema', () => {
  const base = {
    displayName: 'はなこ',
    email: 'hanako@example.com',
    password: 'correct-horse-battery',
    passwordConfirm: 'correct-horse-battery',
    adult: 'on',
    agreeTerms: 'on',
  };

  it('正しい入力は通る', () => {
    expect(signupSchema.safeParse(base).success).toBe(true);
  });

  it('18歳以上の確認と規約への同意が必要', () => {
    const r = signupSchema.safeParse({ ...base, adult: undefined, agreeTerms: undefined });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['adult', 'agreeTerms']));
  });

  it('短いパスワード・一致しない確認用パスワードを拒否する', () => {
    expect(signupSchema.safeParse({ ...base, password: 'short', passwordConfirm: 'short' }).success).toBe(false);
    const r = signupSchema.safeParse({ ...base, passwordConfirm: 'different-password' });
    expect(r.error!.issues[0].path).toEqual(['passwordConfirm']);
  });

  it('メールアドレスの形式を確認する', () => {
    expect(signupSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });
});

describe('customerSchema', () => {
  it('氏名だけで登録できる', () => {
    const r = customerSchema.parse({ fullName: ' 山田 花子 ' });
    expect(r).toMatchObject({ fullName: '山田 花子', fullNameKana: '', birthYear: null });
  });

  it('ふりがな・電話番号・生まれ年を検証する', () => {
    expect(customerSchema.safeParse({ fullName: 'a', fullNameKana: 'やまだ はなこ' }).success).toBe(true);
    expect(customerSchema.safeParse({ fullName: 'a', fullNameKana: 'ヤマダ' }).success).toBe(true);
    expect(customerSchema.safeParse({ fullName: 'a', fullNameKana: 'yamada' }).success).toBe(false);
    expect(customerSchema.safeParse({ fullName: 'a', phone: '090-1234-5678' }).success).toBe(true);
    expect(customerSchema.safeParse({ fullName: 'a', phone: 'abc' }).success).toBe(false);
    expect(customerSchema.parse({ fullName: 'a', birthYear: '1990' }).birthYear).toBe(1990);
    expect(customerSchema.safeParse({ fullName: 'a', birthYear: '1800' }).success).toBe(false);
    expect(customerSchema.safeParse({ fullName: 'a', birthYear: '90' }).success).toBe(false);
  });

  it('氏名は必須で100文字まで', () => {
    expect(customerSchema.safeParse({ fullName: '  ' }).success).toBe(false);
    expect(customerSchema.safeParse({ fullName: 'あ'.repeat(101) }).success).toBe(false);
  });
});

describe('sanitizeSearch', () => {
  it('検索の構文に使われる文字を取り除く', () => {
    expect(sanitizeSearch('山田%_,()\\')).toBe('山田');
    expect(sanitizeSearch('a,full_name.eq.x')).toBe('a full name.eq.x');
    expect(sanitizeSearch(null)).toBe('');
    expect(sanitizeSearch('あ'.repeat(80))).toHaveLength(50);
  });
});
