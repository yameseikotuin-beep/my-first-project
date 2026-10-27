'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { submitBooking, type BookingFormState } from './actions';
import { customerSchema, fieldErrorsOf } from '@/lib/validation/schemas';
import { TextAreaField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Button, LinkButton } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { formatDate, formatPrice, formatTimeRange, jstDate } from '@/lib/time';
import type { PublicServiceRow, SlotRow } from '@/lib/supabase/database.types';
import { StepBar } from './steps';

type Values = { customerName: string; customerPhone: string; notes: string };

// 手順4（お客様情報の入力）と手順5（予約内容の確認）。確定（手順6）はサーバーで行う。
export function BookingForm({ service, slot }: { service: PublicServiceRow; slot: SlotRow }) {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [values, setValues] = useState<Values>({ customerName: '', customerPhone: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [state, action] = useActionState<BookingFormState, FormData>(submitBooking, {});
  const fieldErrors = { ...errors, ...state.fieldErrors };

  const toReview = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = customerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    setStep('review');
    window.scrollTo({ top: 0 });
  };

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  if (step === 'input') {
    return (
      <>
        <StepBar current={3} />
        <Summary service={service} slot={slot} />
        <h1 className="mb-3 text-xl font-bold">お客様情報を入力してください</h1>
        {state.message ? (
          <div className="mb-4">
            <Notice tone="danger" live>
              {state.message}
            </Notice>
          </div>
        ) : null}
        <form onSubmit={toReview} className="space-y-4" noValidate>
          <TextField
            label="お名前"
            name="customerName"
            autoComplete="name"
            required
            maxLength={50}
            value={values.customerName}
            onChange={set('customerName')}
            error={fieldErrors.customerName}
          />
          <TextField
            label="電話番号"
            name="customerPhone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            maxLength={20}
            placeholder="例：09012345678"
            hint="ご予約の確認でご連絡する場合があります。"
            value={values.customerPhone}
            onChange={set('customerPhone')}
            error={fieldErrors.customerPhone}
          />
          <TextAreaField
            label="備考"
            name="notes"
            maxLength={500}
            hint="気になる症状やご要望があればご記入ください。"
            value={values.notes}
            onChange={set('notes')}
            error={fieldErrors.notes}
          />
          <Button type="submit" className="w-full">
            入力内容を確認する
          </Button>
        </form>
        <div className="mt-3">
          <LinkButton href={`/book/${service.id}?date=${jstDate(slot.start_at)}#slots`} variant="secondary" className="w-full">
            時間を選び直す
          </LinkButton>
        </div>
      </>
    );
  }

  return (
    <>
      <StepBar current={4} />
      <h1 className="mb-3 text-xl font-bold">予約内容の確認</h1>
      {state.message ? (
        <div className="mb-4 space-y-2">
          <Notice tone="danger" live>
            {state.message}
          </Notice>
          {state.kind === 'slot' ? (
            <Link href={`/book/${service.id}?date=${jstDate(slot.start_at)}#slots`} className="block text-primary underline">
              空き時間を選び直す
            </Link>
          ) : null}
        </div>
      ) : null}
      <dl className="divide-y divide-line rounded-xl border border-line bg-surface">
        <Row label="メニュー" value={service.name} />
        <Row label="予約日" value={formatDate(jstDate(slot.start_at), true)} />
        <Row label="時間" value={formatTimeRange(slot.start_at, slot.end_at)} note={`施術時間 ${service.duration_minutes}分`} />
        <Row label="料金" value={formatPrice(service.price)} note="お支払いは当日店頭でお願いします" />
        <Row label="お名前" value={values.customerName} />
        <Row label="電話番号" value={values.customerPhone} />
        <Row label="備考" value={values.notes || 'なし'} />
      </dl>
      <form action={action} className="mt-5 space-y-3">
        <input type="hidden" name="serviceId" value={service.id} />
        <input type="hidden" name="startAt" value={slot.start_at} />
        <input type="hidden" name="customerName" value={values.customerName} />
        <input type="hidden" name="customerPhone" value={values.customerPhone} />
        <input type="hidden" name="notes" value={values.notes} />
        {/* いたずら対策：人には見えない入力欄 */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            ウェブサイト
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>
        <SubmitButton className="w-full" pendingLabel="予約を確定しています…">
          この内容で予約を確定する
        </SubmitButton>
        <Button variant="secondary" className="w-full" onClick={() => setStep('input')}>
          入力内容を修正する
        </Button>
      </form>
    </>
  );
}

function Summary({ service, slot }: { service: PublicServiceRow; slot: SlotRow }) {
  return (
    <dl className="mb-4 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
      <dt className="text-ink-muted">メニュー</dt>
      <dd className="font-medium">
        {service.name}（{service.duration_minutes}分・{formatPrice(service.price)}）
      </dd>
      <dt className="text-ink-muted">日時</dt>
      <dd className="font-medium">
        {formatDate(jstDate(slot.start_at), true)} {formatTimeRange(slot.start_at, slot.end_at)}
      </dd>
    </dl>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-3 px-4 py-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="break-words font-medium">
        <span className="whitespace-pre-wrap">{value}</span>
        {note ? <span className="block text-sm font-normal text-ink-muted">{note}</span> : null}
      </dd>
    </div>
  );
}
