// サービス紹介・施術の流れ・よくある質問。
// 実際の施術内容・流れは店舗に確認できた内容だけを書くこと（推測で書かない）。
// 空の項目は本番ページでは表示せず、開発環境（npm run dev）では「未設定」と表示する。

import { lpConfig } from '@/config/lp.config';
import { formatYen } from '@/lib/format';

export type FlowStep = { title: string; body: string };
export type FaqItem = { question: string; answer: string };

export const serviceContent = {
  /** サービスの説明（段落ごと） */
  description: [
    `${lpConfig.service.name}は、骨盤と姿勢に着目した整体メニューです。`,
    'アンケートで整理したお悩みをもとに、気になっていることをご相談いただけます。',
  ],
  /**
   * 実際の施術内容（箇条書き）。店舗に確認した内容を入れる。
   * 例：{ title: 'カウンセリング', body: '…' }
   */
  treatmentItems: [] as FlowStep[],
  /**
   * 来店から施術までの流れ。確認できている手順だけを入れる。
   * 来店後の手順（カウンセリング・施術・お会計など）は店舗に確認してから追加する。
   */
  flow: [
    {
      title: '予約ページからご予約',
      body: 'このページの予約ボタンから予約ページへ進み、ご希望の日時をお選びください。',
    },
    {
      title: 'ご来店',
      body: 'ご予約の日時にご来店ください。',
    },
  ] as FlowStep[],
  /** 来店後の流れが未設定であることを開発環境で知らせるか（流れを追加したら false にする） */
  flowIncomplete: true,
};

export const faqItems: FaqItem[] = [
  {
    question: '初回の料金はいくらですか？',
    answer: `${lpConfig.service.name}の初回料金は${formatYen(lpConfig.service.firstPriceYen)}（税込）です。`,
  },
  {
    question: '予約はどうすればよいですか？',
    answer: 'ページ内の予約ボタンから予約ページへ進み、ご希望の日時をお選びください。',
  },
  {
    question: 'アンケートの結果は診断ですか？',
    answer:
      'いいえ。アンケートの結果は、選んでいただいたお悩みを整理して表示するもので、医学的な診断ではありません。',
  },
  {
    question: 'アンケートの回答は保存されますか？',
    answer:
      'アンケートの回答はお使いのブラウザ内でのみ一時的に使用し、サーバーへの送信・保存は行いません。ブラウザのタブを閉じると消去されます。',
  },
];
