import { describe, expect, it } from 'vitest';
import { isSurveyComplete, surveyQuestions, type SurveyAnswers } from '@/content/survey';
import { themePriority, themes } from '@/content/themes';
import { determineResult } from '@/lib/result';

const base: SurveyAnswers = { since: ['recent'], wantToKnow: ['myPosture'] };

describe('determineResult', () => {
  const concernToTheme = surveyQuestions[0].options.filter((o) => o.theme);

  it.each(concernToTheme.map((o) => [o.id, o.theme]))('悩み「%s」だけを選ぶとテーマ %s になる', (concernId, theme) => {
    const result = determineResult({ ...base, concern: [concernId as string], scene: ['none'] });
    expect(result.mainTheme).toBe(theme);
  });

  it('すべての主要テーマが themes に定義されている', () => {
    for (const id of [...themePriority, 'general' as const]) expect(themes[id].label).toBeTruthy();
  });

  it('悩みの点数（2点）は場面（1点）より重い', () => {
    const result = determineResult({ ...base, concern: ['waist'], scene: ['standingArch'] });
    expect(result.mainTheme).toBe('waist');
    expect(result.rankedThemes).toEqual(['waist', 'pelvicTilt']);
  });

  it('同点のときは優先順位で決まる', () => {
    const result = determineResult({ ...base, concern: ['waist', 'nekoze', 'asymmetry'], scene: ['none'] });
    expect(result.mainTheme).toBe('posture');
    expect(result.rankedThemes).toEqual(['posture', 'asymmetry', 'waist']);
  });

  it('悩みと場面の合計で決まる（複数回答）', () => {
    const result = determineResult({ ...base, concern: ['sorigoshi', 'lowerBelly'], scene: ['sideView'] });
    expect(result.mainTheme).toBe('bodyShape');
  });

  it('該当テーマがないときは全般テーマになる', () => {
    const result = determineResult({ ...base, concern: ['other'], scene: ['none'] });
    expect(result.mainTheme).toBe('general');
    expect(result.rankedThemes).toEqual([]);
  });

  it('選択した悩みと場面のラベルを一覧にする', () => {
    const result = determineResult({ ...base, concern: ['nekoze'], scene: ['deskRound', 'mirrorTilt'] });
    expect(result.selectedLabels).toEqual([
      '猫背が気になる',
      'デスクワークやスマホで背中が丸くなる',
      '鏡や写真で体の傾きが気になる',
    ]);
  });
});

describe('isSurveyComplete', () => {
  it('必須の質問に未回答があると false', () => {
    expect(isSurveyComplete({ concern: ['nekoze'] })).toBe(false);
  });
  it('任意の質問（Q5）は未回答でもよい', () => {
    expect(isSurveyComplete({ ...base, concern: ['nekoze'], scene: ['none'] })).toBe(true);
  });
  it('質問は 3〜5 問で、個人情報を聞く自由入力はない', () => {
    expect(surveyQuestions.length).toBeGreaterThanOrEqual(3);
    expect(surveyQuestions.length).toBeLessThanOrEqual(5);
    for (const q of surveyQuestions) expect(q.options.length).toBeGreaterThan(1);
  });
});
