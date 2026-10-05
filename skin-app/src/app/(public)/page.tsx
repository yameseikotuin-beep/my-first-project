import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';

export default async function TopPage({ searchParams }: PageProps<'/'>) {
  const { account } = await searchParams;
  return (
    <div className="space-y-8">
      {account === 'deleted' ? (
        <Notice tone="success" title="退会の手続きが完了しました" live>
          アカウントと、写真・分析結果などのデータを削除しました。ご利用ありがとうございました。
        </Notice>
      ) : null}
      <section className="py-6 text-center sm:py-12">
        <p className="text-sm tracking-[0.3em] text-gold-text">SKIN NOTE</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold leading-snug sm:text-4xl">
          肌の「見た目」を、
          <br className="sm:hidden" />
          やさしく記録する。
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-muted">
          撮影条件を確認しながら顔写真を記録し、変化を振り返るためのアプリです。サロンでのカウンセリングにも使えます。
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LinkButton href="/signup" className="w-full sm:w-auto">
            はじめる（無料登録）
          </LinkButton>
          <LinkButton href="/login" variant="secondary" className="w-full sm:w-auto">
            ログイン
          </LinkButton>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <h2 className="font-serif text-lg font-semibold">撮影ガイド</h2>
          <p className="mt-2 text-ink-muted">正面・左・右の順に、明るさや顔の向きを確認しながら撮影できます。</p>
        </Card>
        <Card>
          <h2 className="font-serif text-lg font-semibold">写真は本人だけに</h2>
          <p className="mt-2 text-ink-muted">写真は非公開の場所に保存され、いつでも削除できます。</p>
        </Card>
        <Card>
          <h2 className="font-serif text-lg font-semibold">サロンでも</h2>
          <p className="mt-2 text-ink-muted">スタッフは担当のお客さまの記録だけを扱えます。</p>
        </Card>
      </div>

      <Notice title="ご利用にあたって">
        本アプリは美容目的で、画像上の見た目の特徴を記録するものです。皮膚の病気の診断や治療の判断は行いません。気になる症状がある場合は医療機関にご相談ください。
      </Notice>
    </div>
  );
}
