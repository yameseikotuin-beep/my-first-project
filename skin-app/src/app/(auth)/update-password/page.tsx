import type { Metadata } from 'next';
import { Card, PageTitle } from '@/components/ui/card';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { UpdatePasswordForm } from './update-form';

export const metadata: Metadata = { title: 'パスワードの設定' };

// パスワード再設定・スタッフ招待のメールのリンクから来る画面
export default async function UpdatePasswordPage() {
  // メールのリンクでログインした状態でだけ使える（proxy に加えて画面でも確かめる）
  if (!(await getCurrentUser())) redirect('/login?error=link');
  return (
    <>
      <PageTitle>パスワードの設定</PageTitle>
      <Card>
        <UpdatePasswordForm />
      </Card>
    </>
  );
}
