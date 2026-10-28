import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { StepBar } from '@/features/booking/steps';
import { COMPLETE_COOKIE, decodeCompleted } from '@/features/booking/completed';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/button';
import { formatDate, formatPrice, formatTimeRange, jstDate } from '@/lib/time';

export const metadata: Metadata = { title: '予約完了' };

// 手順7：予約完了。予約確定処理が成功したときだけ、その内容が届く
export default async function CompletePage() {
  const booking = decodeCompleted((await cookies()).get(COMPLETE_COOKIE)?.value);
  if (!booking) {
    return (
      <div className="space-y-4">
        <Notice title="予約内容を表示できません">
          時間が経ったため表示できなくなりました。予約が確定しているかご不明な場合は、お手数ですが店舗へお問い合わせください。
        </Notice>
        <LinkButton href="/" variant="secondary" className="w-full">
          予約画面のはじめに戻る
        </LinkButton>
      </div>
    );
  }
  return (
    <>
      <StepBar current={5} />
      <div className="space-y-4">
        <Notice tone="success" title="ご予約が確定しました" live>
          ご来院をお待ちしております。
          {booking.mailSent ? (
            <span className="mt-1 block">
              ご入力のメールアドレスに確認メールをお送りしました。届かない場合は、迷惑メールのフォルダもご確認ください。
            </span>
          ) : null}
        </Notice>
        <div className="rounded-xl border-2 border-primary bg-surface p-4 text-center">
          <p className="text-sm text-ink-muted">予約番号</p>
          <p className="text-3xl font-bold tracking-wider" data-testid="booking-number">
            {booking.bookingNumber}
          </p>
          <p className="mt-1 text-sm text-ink-muted">お問い合わせの際にお伝えください。画面を保存しておくと便利です。</p>
        </div>
        <dl className="divide-y divide-line rounded-xl border border-line bg-surface">
          <div className="grid grid-cols-[6rem_1fr] gap-3 px-4 py-3">
            <dt className="text-sm text-ink-muted">メニュー</dt>
            <dd className="font-medium">{booking.serviceName}</dd>
          </div>
          <div className="grid grid-cols-[6rem_1fr] gap-3 px-4 py-3">
            <dt className="text-sm text-ink-muted">日時</dt>
            <dd className="font-medium">
              {formatDate(jstDate(booking.startAt), true)}
              <br />
              {formatTimeRange(booking.startAt, booking.endAt)}
            </dd>
          </div>
          <div className="grid grid-cols-[6rem_1fr] gap-3 px-4 py-3">
            <dt className="text-sm text-ink-muted">料金</dt>
            <dd className="font-medium">{formatPrice(booking.price)}</dd>
          </div>
        </dl>
        <LinkButton href="/" variant="secondary" className="w-full">
          予約画面のはじめに戻る
        </LinkButton>
      </div>
    </>
  );
}
