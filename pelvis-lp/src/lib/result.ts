// アンケート回答から主要テーマを決める。
// 悩み（concern）の選択は 2 点、場面（scene）の選択は 1 点として集計し、
// 最高点のテーマを選ぶ。同点のときは themePriority の順で決める。

import { surveyQuestions, type SurveyAnswers, type SurveyQuestion } from '@/content/survey';
import { fallbackTheme, themePriority, type ThemeId } from '@/content/themes';

const weights: Record<string, number> = { concern: 2, scene: 1 };

export type SurveyResult = {
  mainTheme: ThemeId;
  /** 点数のついたテーマ（高い順） */
  rankedThemes: ThemeId[];
  /** 選択した悩み・場面の表示用ラベル */
  selectedLabels: string[];
};

export function determineResult(answers: SurveyAnswers, questions: SurveyQuestion[] = surveyQuestions): SurveyResult {
  const scores = new Map<ThemeId, number>();
  const selectedLabels: string[] = [];

  for (const question of questions) {
    const weight = weights[question.id];
    if (weight === undefined) continue;
    const chosen = answers[question.id] ?? [];
    for (const option of question.options) {
      if (!chosen.includes(option.id)) continue;
      selectedLabels.push(option.label);
      if (option.theme) scores.set(option.theme, (scores.get(option.theme) ?? 0) + weight);
    }
  }

  const rankedThemes = themePriority
    .filter((id) => (scores.get(id) ?? 0) > 0)
    // sort は安定ソートなので、同点なら themePriority の順が保たれる
    .sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));

  return {
    mainTheme: rankedThemes[0] ?? fallbackTheme,
    rankedThemes,
    selectedLabels,
  };
}
