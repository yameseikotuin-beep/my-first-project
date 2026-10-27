import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth/session';
import { ActionForm, FormSubmit } from '@/components/ui/action-form';
import { TextField } from '@/components/ui/field';
import { login } from '@/features/admin/auth-actions';

export const metadata: Metadata = { title: '管理者ログイン' };

export default async function LoginPage() {
  if (await getAdmin()) redirect('/admin');
  return (
    <main id="main" className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="mb-6 text-xl font-bold">管理者ログイン</h1>
      <div className="rounded-xl border border-line bg-surface p-5">
        <ActionForm action={login}>
          <TextField label="メールアドレス" name="email" type="email" autoComplete="email" inputMode="email" required />
          <TextField label="パスワード" name="password" type="password" autoComplete="current-password" required />
          <FormSubmit className="w-full">ログイン</FormSubmit>
        </ActionForm>
      </div>
      <p className="mt-4 text-sm text-ink-muted">管理者アカウントの作成方法は docs/setup.md を参照してください。</p>
    </main>
  );
}
