// 計測イベント。GA4・Meta Pixel は設定値があるときだけ読み込まれ（src/components/Analytics.tsx）、
// 読み込まれていなければここでは何も送らない。
//
// - 健康情報（アンケートの回答・結果テーマ）や個人情報はパラメータに含めない。
//   送れるパラメータは予約ボタンの設置場所（placement）だけに型で制限している。
// - 「予約ボタンクリック」と「予約完了」は別のイベント。予約完了は実際に確認できる場合のみ送る。

export type LpEventName =
  | 'lp_view'
  | 'survey_start'
  | 'survey_complete'
  | 'result_view'
  | 'article_view'
  | 'offer_view'
  | 'reserve_click'
  | 'reserve_complete';

export type ReservePlacement = 'article_middle' | 'service' | 'article_end' | 'sticky' | 'reserve_page';

type EventParams = { placement?: ReservePlacement };

/** Meta Pixel 側のイベント名。予約完了だけ標準イベント（Schedule）を使う */
const metaEvents: Record<LpEventName, { method: 'track' | 'trackCustom'; name: string }> = {
  lp_view: { method: 'trackCustom', name: 'LpView' },
  survey_start: { method: 'trackCustom', name: 'SurveyStart' },
  survey_complete: { method: 'trackCustom', name: 'SurveyComplete' },
  result_view: { method: 'trackCustom', name: 'ResultView' },
  article_view: { method: 'trackCustom', name: 'ArticleView' },
  offer_view: { method: 'trackCustom', name: 'OfferView' },
  reserve_click: { method: 'trackCustom', name: 'ReserveClick' },
  reserve_complete: { method: 'track', name: 'Schedule' },
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/** ページを開いている間に 1 回だけ送るイベント（表示系）の送信済み記録 */
const sentOnce = new Set<LpEventName>();
/** 予約ボタンの連打で二重送信しないための最終送信時刻 */
const lastClickAt = new Map<string, number>();
const CLICK_DEDUPE_MS = 1500;
/** 予約完了はページを再読み込みしても二重計上しないよう、タブを閉じるまで記録する */
const COMPLETE_STORAGE_KEY = 'pelvis-lp:reserve-complete-sent';

function send(name: LpEventName, params: EventParams): void {
  if (typeof window === 'undefined') return;
  const payload: EventParams = params.placement ? { placement: params.placement } : {};
  window.gtag?.('event', name, payload);
  const meta = metaEvents[name];
  window.fbq?.(meta.method, meta.name, payload);
  if (process.env.NODE_ENV === 'development') console.debug('[lp-event]', name, payload);
}

/** 表示系イベント。同じページ表示中に何度呼ばれても 1 回だけ送る */
export function trackOnce(name: Exclude<LpEventName, 'reserve_click' | 'reserve_complete'>): void {
  if (sentOnce.has(name)) return;
  sentOnce.add(name);
  send(name, {});
}

export function trackReserveClick(placement: ReservePlacement, now: number = Date.now()): void {
  const last = lastClickAt.get(placement);
  if (last !== undefined && now - last < CLICK_DEDUPE_MS) return;
  lastClickAt.set(placement, now);
  send('reserve_click', { placement });
}

/** 予約完了。予約システムから完了ページへ戻ってきたことを確認できる場合だけ呼ぶ */
export function trackReserveComplete(): void {
  try {
    if (window.sessionStorage.getItem(COMPLETE_STORAGE_KEY)) return;
    window.sessionStorage.setItem(COMPLETE_STORAGE_KEY, '1');
  } catch {
    // ストレージが使えない環境でも、このページ表示中の二重送信は防ぐ
    if (sentOnce.has('reserve_complete')) return;
  }
  sentOnce.add('reserve_complete');
  send('reserve_complete', {});
}

/** テスト用：送信済み記録を消す */
export function resetAnalyticsForTest(): void {
  sentOnce.clear();
  lastClickAt.clear();
}

const GA4_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;
const META_PIXEL_ID_PATTERN = /^\d{5,20}$/;

/** 形式が正しい ID だけを使う（設定ミスや不正な文字列をスクリプトに埋め込まない） */
export function validGa4Id(id: string): string | null {
  const value = id.trim();
  return GA4_ID_PATTERN.test(value) ? value : null;
}

export function validMetaPixelId(id: string): string | null {
  const value = id.trim();
  return META_PIXEL_ID_PATTERN.test(value) ? value : null;
}
