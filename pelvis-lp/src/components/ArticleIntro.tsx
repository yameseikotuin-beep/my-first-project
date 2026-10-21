'use client';

import { isSurveyComplete } from '@/content/survey';
import { fallbackTheme, themes } from '@/content/themes';
import { determineResult } from '@/lib/result';
import { useSurvey } from './SurveyProvider';

/** 記事の導入。アンケートの回答に合わせて切り替える（未回答なら全般向け） */
export function ArticleIntro() {
  const { answers, completed, hydrated } = useSurvey();
  const themeId = hydrated && completed && isSurveyComplete(answers) ? determineResult(answers).mainTheme : fallbackTheme;
  const theme = themes[themeId];

  return (
    <header className={`transition-opacity ${hydrated ? 'opacity-100' : 'opacity-0'}`}>
      <p className="text-sm font-bold text-navy-700">骨盤と姿勢のコラム</p>
      <h1 data-testid="article-title" className="mt-2 text-2xl leading-snug font-bold text-navy-900 sm:text-3xl sm:leading-snug">
        {theme.articleTitle}
      </h1>
      <div data-testid="article-intro" data-theme={themeId} className="mt-5 space-y-4">
        {theme.articleIntro.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </header>
  );
}
