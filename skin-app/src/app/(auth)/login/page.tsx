import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'ログイン' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const next = typeof params.next === 'string' ? params.next : undefined;
  const error = typeof params.error === 'string' ? params.error : undefined;
  return (
    <>
      <PageTitle>ログイン</PageTitle>
      <Card className="space-y-5">
        {error === 'link' ? (
          <Notice tone="warning" title="リンクを確認できませんでした">
            リンクの有効期限が切れているか、すでに使われています。もう一度お試しください。
          </Notice>
        ) : null}
        <LoginForm next={next} />
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/reset-password" className="text-sage-strong underline-offset-4 hover:underline">
            パスワードを忘れた方
          </Link>
          <Link href="/signup" className="text-sage-strong underline-offset-4 hover:underline">
            はじめての方（新規登録）
          </Link>
        </div>
      </Card>
    </>
  );
}
