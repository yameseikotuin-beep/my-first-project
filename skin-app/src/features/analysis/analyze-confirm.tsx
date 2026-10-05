import Link from 'next/link';
import { Card, PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import type { SessionWithPhotos } from '@/lib/photos';
import { angleLabels } from '@/lib/analysis/labels';
import { AnalyzeForm } from './analyze-form';

export type AiAvailability = {
  consent: boolean;
  configured: boolean;
  remaining: number;
};

/** 分析の前の確認画面（U-05）。AI に送る場合は、送信先・目的・送るものを説明する */
export function AnalyzeConfirm({
  session,
  ai,
  subjectLabel,
  consentHref,
}: {
  session: SessionWithPhotos;
  ai: AiAvailability;
  subjectLabel?: string;
  consentHref: string;
}) {
  const aiAvailable = ai.consent && ai.configured && ai.remaining > 0;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle lead={subjectLabel}>肌の見た目の分析</PageTitle>

      <Notice title="この分析について">
        <ul className="list-disc space-y-1 pl-5">
          <li>写真の「見た目の特徴」の記録で、皮膚の病気の診断ではありません。</li>
          <li>
            項目ごとの評価は、<strong>検証されていない仮の値（モック）</strong>です。画像を解析した結果ではありません。
          </li>
          <li>肌年齢・水分量・油分量などの数値は出しません。</li>
        </ul>
      </Notice>

      <Card>
        <h2 className="font-serif text-lg font-semibold">分析する写真</h2>
        <ul className="mt-3 grid grid-cols-3 gap-3">
          {session.photos.map((p) => (
            <li key={p.id}>
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- 短時間で失効する署名付き URL のため
                <img src={p.url} alt={`${angleLabels[p.angle]}の写真`} className="aspect-[3/4] w-full rounded-xl object-cover" />
              ) : null}
              <p className="mt-1 text-sm">
                {angleLabels[p.angle]}
                <span className={`ml-1 ${p.quality_passed ? 'text-sage-strong' : 'text-warning'}`}>
                  {p.quality_passed ? '○' : '△ 条件外'}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">AI による説明文（任意）</h2>
        <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-[0.95rem]">
          <dt className="text-ink-muted">送信先</dt>
          <dd>Anthropic 社（Claude API）</dd>
          <dt className="text-ink-muted">送るもの</dt>
          <dd>上の顔写真（位置情報なし）と、仮の評価の値。氏名・連絡先は送りません</dd>
          <dt className="text-ink-muted">目的</dt>
          <dd>写真の見た目の特徴を文章で説明するため</dd>
        </dl>
        <p className="text-sm text-ink-muted">
          詳しくは
          <Link href="/legal/ai-and-photos" className="text-sage-strong underline" target="_blank">
            写真とAIの利用について
          </Link>
          をご覧ください。送らない場合は、AI を使わない仮の説明文になります。
        </p>
        {!ai.consent ? (
          <Notice tone="warning" title="AI への送信に同意していません">
            AI の説明文を使う場合は、
            <Link href={consentHref} className="underline">
              同意の画面
            </Link>
            で「AIサービスへの写真の送信」に同意してください。
          </Notice>
        ) : !ai.configured ? (
          <Notice tone="warning" title="AI に接続されていません">
            サーバーに Claude API のキーが設定されていないため、今は AI の説明文を作れません。
          </Notice>
        ) : ai.remaining <= 0 ? (
          <Notice tone="warning" title="本日の AI 利用回数の上限に達しました">
            明日以降にお試しください。
          </Notice>
        ) : (
          <p className="text-sm text-ink-muted">本日あと {ai.remaining} 回、AI の説明文を作れます。</p>
        )}
      </Card>

      <AnalyzeForm sessionId={session.id} aiAvailable={aiAvailable} />
    </div>
  );
}
