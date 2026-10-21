// アンケートの質問。氏名・電話番号などの個人情報は聞かない。
// theme を付けた選択肢は結果テーマの判定に使う（src/lib/result.ts）。

import type { ThemeId } from './themes';

export type SurveyOption = {
  id: string;
  label: string;
  theme?: ThemeId;
};

export type SurveyQuestion = {
  id: string;
  title: string;
  description?: string;
  multiple: boolean;
  required: boolean;
  options: SurveyOption[];
};

export const surveyQuestions: SurveyQuestion[] = [
  {
    id: 'concern',
    title: 'どのような悩みが気になりますか？',
    description: '当てはまるものをすべて選んでください。',
    multiple: true,
    required: true,
    options: [
      { id: 'sorigoshi', label: '反り腰が気になる', theme: 'pelvicTilt' },
      { id: 'nekoze', label: '猫背が気になる', theme: 'posture' },
      { id: 'asymmetry', label: '姿勢の左右差（肩や腰の高さ）が気になる', theme: 'asymmetry' },
      { id: 'lowerBelly', label: '下腹部の見た目が気になる', theme: 'bodyShape' },
      { id: 'waist', label: '腰まわりの違和感が気になる', theme: 'waist' },
      { id: 'other', label: 'その他・うまく言葉にできない' },
    ],
  },
  {
    id: 'scene',
    title: 'どのような姿勢・場面が気になりますか？',
    description: '当てはまるものをすべて選んでください。',
    multiple: true,
    required: true,
    options: [
      { id: 'standingArch', label: '立っているとき、腰が反っている気がする', theme: 'pelvicTilt' },
      { id: 'deskRound', label: 'デスクワークやスマホで背中が丸くなる', theme: 'posture' },
      { id: 'mirrorTilt', label: '鏡や写真で体の傾きが気になる', theme: 'asymmetry' },
      { id: 'sideView', label: '横から見たときの体型が気になる', theme: 'bodyShape' },
      { id: 'longSitting', label: '長く座った後、腰まわりが気になる', theme: 'waist' },
      { id: 'none', label: '特に思い当たらない' },
    ],
  },
  {
    id: 'since',
    title: 'いつ頃から気になっていますか？',
    multiple: false,
    required: true,
    options: [
      { id: 'recent', label: '最近（1か月以内）' },
      { id: 'halfYear', label: '半年以内' },
      { id: 'overYear', label: '1年以上前から' },
      { id: 'lifeEvent', label: '生活の変化（出産・転職など）の後から' },
      { id: 'unknown', label: 'よく覚えていない' },
    ],
  },
  {
    id: 'wantToKnow',
    title: '今、いちばん知りたいことは何ですか？',
    multiple: false,
    required: true,
    options: [
      { id: 'myPosture', label: '自分の姿勢がどう見えているか' },
      { id: 'pelvisBasics', label: '骨盤と姿勢の関係' },
      { id: 'checkPoints', label: '姿勢を確認するときのポイント' },
      { id: 'treatment', label: '整体で何をするのか' },
    ],
  },
  {
    id: 'aboutTreatment',
    title: '施術について知りたいことはありますか？',
    description: '任意です。当てはまるものをすべて選んでください。',
    multiple: true,
    required: false,
    options: [
      { id: 'content', label: '施術の内容' },
      { id: 'flow', label: '来店から施術までの流れ' },
      { id: 'price', label: '初回の料金' },
      { id: 'howToBook', label: '予約の方法' },
    ],
  },
];

/** 質問ID → 選んだ選択肢IDの配列 */
export type SurveyAnswers = Record<string, string[]>;

export function isAnswered(question: SurveyQuestion, answers: SurveyAnswers): boolean {
  return (answers[question.id]?.length ?? 0) > 0;
}

/** 必須の質問にすべて回答済みか */
export function isSurveyComplete(answers: SurveyAnswers, questions = surveyQuestions): boolean {
  return questions.every((q) => !q.required || isAnswered(q, answers));
}
