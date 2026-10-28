'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ActionForm, FormSubmit } from '@/components/ui/action-form';
import { SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { saveBooking } from './booking-actions';
import { formatPrice, jstTime } from '@/lib/time';
import type { BookingStatus, PractitionerRow, RoomRow, ServiceRow, SlotRow } from '@/lib/supabase/database.types';

export type BookingEditorValues = {
  bookingId?: string;
  serviceId: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
  roomId: string;
  practitionerId: string;
  status: BookingStatus;
};

/**
 * 予約の登録・変更フォーム。メニューと日付を選ぶと、その日の空き時間を表示する
 * （画面の URL を変えてサーバーで空き時間を計算し直す。入力中の内容は残る）。
 */
export function BookingEditor({
  initial,
  services,
  rooms,
  practitioners,
  usePractitioners,
  slots,
}: {
  initial: BookingEditorValues;
  services: ServiceRow[];
  rooms: RoomRow[];
  practitioners: PractitionerRow[];
  usePractitioners: boolean;
  slots: SlotRow[] | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [v, setV] = useState(initial);
  const set = (key: keyof BookingEditorValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((prev) => ({ ...prev, [key]: e.target.value }));

  const showSlotsFor = (serviceId: string, date: string) => {
    if (serviceId && date) router.replace(`${pathname}?service=${serviceId}&date=${date}`, { scroll: false });
  };

  return (
    <ActionForm action={saveBooking} className="space-y-5">
      {v.bookingId ? <input type="hidden" name="bookingId" value={v.bookingId} /> : null}
      <fieldset className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <legend className="px-1 font-bold">日時・メニュー</legend>
        <SelectField
          label="メニュー"
          name="serviceId"
          required
          value={v.serviceId}
          onChange={(e) => {
            set('serviceId')(e);
            showSlotsFor(e.target.value, v.date);
          }}
        >
          <option value="">選択してください</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}（{s.duration_minutes}分・{formatPrice(s.price)}）{s.is_active ? '' : '［WEB受付停止中］'}
            </option>
          ))}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="日付"
            name="date"
            type="date"
            required
            value={v.date}
            onChange={(e) => {
              set('date')(e);
              showSlotsFor(v.serviceId, e.target.value);
            }}
          />
          <TextField label="開始時刻" name="time" type="time" step={300} required value={v.time} onChange={set('time')} />
        </div>
        {slots ? (
          <div>
            <p className="mb-2 text-sm font-medium">この日の空き時間（押すと開始時刻に入ります）</p>
            {slots.length === 0 ? (
              <p className="text-sm text-ink-muted">空き時間はありません（休業日・満席など）。</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {slots.map((s) => {
                  const t = jstTime(s.start_at);
                  return (
                    <li key={s.start_at}>
                      <button
                        type="button"
                        onClick={() => setV((prev) => ({ ...prev, time: t }))}
                        aria-pressed={v.time === t}
                        className={`min-h-9 rounded-md border px-2.5 text-sm tabular-nums ${
                          v.time === t ? 'border-primary bg-primary text-white' : 'border-line bg-surface hover:border-primary'
                        }`}
                      >
                        {t}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-muted">
              一覧にない時刻も入力できます。保存時に営業時間・休憩時間・ほかの予約との重なりを確認します。
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">メニューと日付を選ぶと空き時間を表示します。</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="施術スペース" name="roomId" value={v.roomId} onChange={set('roomId')}>
            <option value="">自動で割り当てる</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.is_active ? '' : '（利用停止中）'}
              </option>
            ))}
          </SelectField>
          {usePractitioners ? (
            <SelectField label="担当施術者" name="practitionerId" value={v.practitionerId} onChange={set('practitionerId')}>
              <option value="">自動で割り当てる</option>
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.is_active ? '' : '（利用停止中）'}
                </option>
              ))}
            </SelectField>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <legend className="px-1 font-bold">お客様情報</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="お名前" name="customerName" required maxLength={50} value={v.customerName} onChange={set('customerName')} />
          <TextField
            label="電話番号"
            name="customerPhone"
            type="tel"
            inputMode="tel"
            required
            maxLength={20}
            value={v.customerPhone}
            onChange={set('customerPhone')}
          />
        </div>
        <TextField
          label="メールアドレス"
          name="customerEmail"
          type="email"
          inputMode="email"
          maxLength={254}
          value={v.customerEmail}
          onChange={set('customerEmail')}
        />
        <TextAreaField label="備考" name="notes" maxLength={500} value={v.notes} onChange={set('notes')} />
        {v.bookingId ? (
          <SelectField label="予約ステータス" name="status" required value={v.status} onChange={set('status')}>
            <option value="confirmed">予約確定</option>
            <option value="cancelled">キャンセル</option>
          </SelectField>
        ) : (
          <input type="hidden" name="status" value="confirmed" />
        )}
      </fieldset>

      <FormSubmit className="w-full sm:w-auto">{v.bookingId ? '変更を保存する' : 'この内容で予約を登録する'}</FormSubmit>
    </ActionForm>
  );
}
