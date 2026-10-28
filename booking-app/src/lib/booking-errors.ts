// データベースの予約関数が返すエラーを、お客様・管理者向けの文に変換する。
// 想定外のエラー（通信障害・データベース障害など）の内容は画面に出さない。

type DbError = { message?: string; details?: string | null; code?: string } | null | undefined;

const SLOT_REASONS: Record<string, string> = {
  CLOSED: 'その日は休業日です。',
  OUTSIDE_HOURS: '営業時間外です。',
  AFTER_LAST_START: '最終受付時刻を過ぎています。',
  BREAK: '受付停止時間（昼休みなど）にかかっています。',
  TOO_SOON: '受付の締切時刻を過ぎています。',
  TOO_FAR: '受付可能な期間より先の日付です。',
  INVALID_TIME: '選択できない時刻です。',
  NO_RESOURCE: 'ほかのご予約で埋まりました。',
  CONFLICT: 'ほかのご予約で埋まりました。',
};

export type BookingErrorKind = 'slot' | 'input' | 'limit' | 'service' | 'forbidden' | 'not_found' | 'unknown';

export function classifyBookingError(error: DbError): { kind: BookingErrorKind; message: string } {
  const code = error?.message ?? '';
  switch (code) {
    case 'SLOT_UNAVAILABLE': {
      const reason = SLOT_REASONS[error?.details ?? ''] ?? '';
      return { kind: 'slot', message: `この時間は予約できません。${reason}別の時間を選んでください。` };
    }
    case 'INVALID_NAME':
      return { kind: 'input', message: 'お名前を確認してください。' };
    case 'INVALID_PHONE':
      return { kind: 'input', message: '電話番号を確認してください。' };
    case 'EMAIL_REQUIRED':
      return { kind: 'input', message: 'メールアドレスを入力してください。' };
    case 'INVALID_EMAIL':
      return { kind: 'input', message: 'メールアドレスを確認してください。' };
    case 'INVALID_NOTES':
      return { kind: 'input', message: '備考は500文字以内で入力してください。' };
    case 'INVALID_INPUT':
      return { kind: 'input', message: '入力内容を確認してください。' };
    case 'TOO_MANY_BOOKINGS':
      return {
        kind: 'limit',
        message: 'この電話番号では、これ以上WEBから予約できません。お手数ですがお電話でご連絡ください。',
      };
    case 'SERVICE_UNAVAILABLE':
      return { kind: 'service', message: 'このメニューは現在予約を受け付けていません。' };
    case 'FORBIDDEN':
      return { kind: 'forbidden', message: 'この操作を行う権限がありません。' };
    case 'NOT_FOUND':
      return { kind: 'not_found', message: '予約が見つかりません。' };
    default:
      return {
        kind: 'unknown',
        message: '通信または処理でエラーが発生しました。予約は確定していません。時間をおいてもう一度お試しください。',
      };
  }
}

export type CreatedBooking = {
  bookingNumber: string;
  serviceName: string;
  price: number;
  startAt: string;
  endAt: string;
};

/**
 * 予約確定処理の結果を判定する。予約番号を含む正常な応答を受け取った場合だけ「確定」とする。
 * （エラー・空の応答・形式の違う応答はすべて未確定として扱い、完了画面を表示しない）
 */
export function interpretCreateBooking(result: {
  data: unknown;
  error: DbError;
}): { ok: true; booking: CreatedBooking } | { ok: false; kind: BookingErrorKind; message: string } {
  if (result.error) return { ok: false, ...classifyBookingError(result.error) };
  const row = Array.isArray(result.data) ? result.data[0] : null;
  if (
    !row ||
    typeof row.booking_number !== 'string' ||
    !row.booking_number ||
    typeof row.start_at !== 'string' ||
    typeof row.end_at !== 'string'
  ) {
    return { ok: false, ...classifyBookingError(null) };
  }
  return {
    ok: true,
    booking: {
      bookingNumber: row.booking_number,
      serviceName: String(row.service_name ?? ''),
      price: Number(row.price ?? 0),
      startAt: row.start_at,
      endAt: row.end_at,
    },
  };
}
