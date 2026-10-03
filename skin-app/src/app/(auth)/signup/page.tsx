import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, PageTitle } from '@/components/ui/card';
import { SignupForm } from './signup-form';

export const metadata: Metadata = { title: '新規登録' };

export default function SignupPage() {
  return (
    <>
      <PageTitle lead="写真の撮影・保存についての同意は、登録後に個別にお伺いします。">新規登録</PageTitle>
      <Card className="space-y-5">
        <SignupForm />
        <p className="text-sm">
          <Link href="/login" className="text-sage-strong underline-offset-4 hover:underline">
            登録済みの方はこちら（ログイン）
          </Link>
        </p>
      </Card>
    </>
  );
}
