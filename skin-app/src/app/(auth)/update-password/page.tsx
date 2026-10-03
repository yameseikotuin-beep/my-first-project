import type { Metadata } from 'next';
import { Card, PageTitle } from '@/components/ui/card';
import { UpdatePasswordForm } from './update-form';

export const metadata: Metadata = { title: 'パスワードの設定' };

// パスワード再設定・スタッフ招待のメールのリンクから来る画面
export default function UpdatePasswordPage() {
  return (
    <>
      <PageTitle>パスワードの設定</PageTitle>
      <Card>
        <UpdatePasswordForm />
      </Card>
    </>
  );
}
