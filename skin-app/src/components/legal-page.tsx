import type { ReactNode } from 'react';
import { PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl">
      <PageTitle>{title}</PageTitle>
      <Notice tone="warning" title="雛形です">
        この文面は開発用の雛形です。公開前に、運営者の情報を記入し、専門家（弁護士等）の確認を受けてください。
      </Notice>
      <div className="mt-6 space-y-6 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </article>
  );
}
