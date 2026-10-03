import type { Metadata } from 'next';
import { Card, PageTitle } from '@/components/ui/card';
import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: 'パスワードの再設定' };

export default function ResetPasswordPage() {
  return (
    <>
      <PageTitle lead="登録したメールアドレスに、再設定用のリンクをお送りします。">パスワードの再設定</PageTitle>
      <Card>
        <ResetForm />
      </Card>
    </>
  );
}
