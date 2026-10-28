import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { getSettings } from '@/lib/admin-data';
import { saveSettings } from '@/features/admin/settings-actions';
import { ActionForm, FormSubmit } from '@/components/ui/action-form';
import { SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { isMailConfigured } from '@/lib/mail';
import { PageTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: '予約受付の設定' };

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <>
      <PageTitle>予約受付の設定</PageTitle>
      <ActionForm action={saveSettings} className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="店舗名" name="shopName" required maxLength={60} defaultValue={s.shop_name} hint="予約画面の上部に表示されます。" />
          <TextField label="店舗の電話番号" name="shopPhone" type="tel" maxLength={20} defaultValue={s.shop_phone} hint="予約画面に「変更・キャンセルの連絡先」として表示されます。" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="予約枠の開始間隔" name="slotIntervalMinutes" required defaultValue={String(s.slot_interval_minutes)} hint="予約画面に表示する開始時刻の間隔です（施術時間とは別）。">
            {[5, 10, 15, 20, 30, 60].map((m) => (
              <option key={m} value={m}>{m}分ごと</option>
            ))}
          </SelectField>
          <TextField label="受付可能な期間（日）" name="bookingWindowDays" type="number" inputMode="numeric" min={0} max={365} required defaultValue={s.booking_window_days} hint="今日から何日先まで予約を受け付けるか。" />
          <TextField label="受付締切（開始の何分前まで）" name="minLeadMinutes" type="number" inputMode="numeric" min={0} max={10080} required defaultValue={s.min_lead_minutes} hint="例：60 なら、開始1時間前までWEB予約できます。" />
          <TextField label="1つの電話番号で持てる今後の予約数" name="maxActiveBookingsPerPhone" type="number" inputMode="numeric" min={1} max={20} required defaultValue={s.max_active_bookings_per_phone} hint="WEB予約のいたずら対策。管理画面からの登録には適用されません。" />
        </div>
        <fieldset className="space-y-3 border-t border-line pt-4">
          <legend className="font-bold">予約のお知らせメール</legend>
          {isMailConfigured() ? (
            <Notice tone="success">
              メールの送信は設定済みです。WEB予約が入ると、お客様に予約完了メールを、下の送り先に新しい予約の通知を送ります。
            </Notice>
          ) : (
            <Notice tone="warning" title="メールの送信が設定されていません">
              Vercel の環境変数 GMAIL_ADDRESS と GMAIL_APP_PASSWORD を設定すると、メールを送れるようになります（手順は docs/setup.md）。それまでは予約だけを受け付けます。
            </Notice>
          )}
          <TextAreaField
            label="新しい予約の通知メールの送り先"
            name="notifyEmails"
            maxLength={1300}
            defaultValue={s.notify_emails.join('\n')}
            hint="1行に1件、最大5件。空欄の場合、院あての通知は送りません。"
            placeholder="例：yameseikotuin@gmail.com"
          />
        </fieldset>
        <p className="text-sm text-ink-muted">最終受付時刻は「営業時間・休業日」で曜日ごとに設定します。管理画面からの登録には、受付期間・締切・開始間隔の制限はかかりません。</p>
        <FormSubmit>保存する</FormSubmit>
      </ActionForm>
    </>
  );
}
