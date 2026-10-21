// LP の設定ファイル。店舗情報・料金・予約先・広告ID・画像はここで変更する。
//
// - 空文字（''）や null は「未設定」として扱う。未設定の項目は本番ページに表示しない
//   （開発環境 npm run dev では「未設定」と分かる表示を出す）。
// - 予約URL・GA4・Meta Pixel は環境変数（.env.example 参照）でも設定でき、環境変数が優先される。
// - 確認できていない情報（通常価格、所要時間、所在地、営業時間、資格、実績など）は推測で入れないこと。

export type LpImage = {
  /** public/ からのパス（例：'/images/hero.jpg'）。public/images/ に画像を置く */
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type LpConfig = {
  /** 既存の予約ページの URL（https:// のみ有効） */
  reservationUrl: string;
  /**
   * 予約完了ページ（/pelvis/reserve/complete/）で「予約完了」イベントを送るか。
   * 予約システム側で「予約完了後にこのページへ戻す」設定ができ、実際に予約完了を確認できる場合のみ true にする。
   */
  reservationCompleteTracking: boolean;
  store: {
    /** 店舗名（未設定ならサービス名を表示） */
    name: string;
    address: string;
    /** 営業時間（例：'10:00〜20:00（水曜定休）'） */
    hours: string;
    /** 地図・アクセスページなどの URL（任意） */
    mapUrl: string;
  };
  logo: LpImage | null;
  service: {
    name: string;
    /** 初回価格（税込・円） */
    firstPriceYen: number;
    /** 施術時間（例：'約30分'）。未確認なら空のまま */
    duration: string;
  };
  images: {
    /** ファーストビュー */
    hero: LpImage | null;
    /** 記事内（施術の様子など） */
    article: LpImage | null;
    /** サービス紹介（店内・施術環境など） */
    service: LpImage | null;
  };
  analytics: {
    /** GA4 測定ID（G-XXXXXXXXXX） */
    ga4Id: string;
    /** Meta Pixel ID（数字のみ） */
    metaPixelId: string;
  };
  /** 個人情報保護方針のページ URL（任意。設定するとフッターにリンクを表示） */
  privacyPolicyUrl: string;
};

export const lpConfig: LpConfig = {
  reservationUrl: process.env.NEXT_PUBLIC_RESERVATION_URL || '',
  reservationCompleteTracking: false,
  store: {
    name: '',
    address: '',
    hours: '',
    mapUrl: '',
  },
  logo: null,
  service: {
    name: '骨盤起こし整体',
    firstPriceYen: 1980,
    duration: '',
  },
  images: {
    hero: null,
    article: null,
    service: null,
  },
  analytics: {
    ga4Id: process.env.NEXT_PUBLIC_GA4_ID || '',
    metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID || '',
  },
  privacyPolicyUrl: '',
};
