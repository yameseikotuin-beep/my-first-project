'use client';

import Link from 'next/link';
import { lpConfig } from '@/config/lp.config';
import { articleSections } from '@/content/article';
import { isSurveyComplete } from '@/content/survey';
import { themes } from '@/content/themes';
import { determineResult } from '@/lib/result';
import { StartButton } from './StartButton';
import { TrackView } from './TrackView';
import { useSurvey } from './SurveyProvider';

export function SurveyResultView() {
  const { answers, completed, hydrated } = useSurvey();

  if (!hydrated) {
    return <p className="py-16 text-center text-navy-700">読み込み中…</p>;
  }

  if (!completed || !isSurveyComplete(answers)) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-xl font-bold">まだ結果がありません</h1>
        <p className="mt-3">セルフチェックの質問に回答すると、結果が表示されます。</p>
        <Link
          href="/pelvis/check/"
          className="mt-6 inline-flex min-h-14 items-center justify-center rounded-full bg-navy-800 px-8 font-bold text-white"
        >
          セルフチェックに進む
        </Link>
      </div>
    );
  }

  const result = determineResult(answers);
  const theme = themes[result.mainTheme];
  const relatedSections = theme.relatedSections
    .map((id) => articleSections.find((s) => s.id === id))
    .filter((s) => s !== undefined);
  const otherThemes = result.rankedThemes.filter((id) => id !== result.mainTheme);

  return (
    <div className="py-8">
      <TrackView event="result_view" />
      <p className="text-sm font-bold text-navy-700">セルフチェックの結果</p>
      <h1 className="mt-1 text-sm">あなたの回答から整理すると…</h1>

      <section className="mt-4 rounded-2xl bg-navy-800 p-6 text-white shadow-md" aria-labelledby="main-theme">
        <p className="text-sm text-navy-100">いちばん多く選ばれたテーマ</p>
        <h2 id="main-theme" data-testid="main-theme" className="mt-1 text-xl leading-snug font-bold sm:text-2xl">
          {theme.label}
        </h2>
        <p className="mt-3 text-[0.95rem] text-navy-100">{theme.summary}</p>
        {otherThemes.length > 0 && (
          <p className="mt-3 text-sm text-navy-100">
            ほかに選ばれたテーマ：{otherThemes.map((id) => themes[id].label).join('、')}
          </p>
        )}
      </section>

      {result.selectedLabels.length > 0 && (
        <section className="mt-8" aria-labelledby="selected">
          <h2 id="selected" className="text-lg font-bold">
            選択した悩み・気になる場面
          </h2>
          <ul data-testid="selected-list" className="mt-3 space-y-2">
            {result.selectedLabels.map((label) => (
              <li key={label} className="flex gap-2 rounded-lg bg-white px-4 py-3 shadow-sm">
                <span aria-hidden="true" className="font-bold text-navy-700">
                  ✓
                </span>
                {label}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-beige-200 bg-white p-5" aria-labelledby="related">
        <h2 id="related" className="text-lg font-bold">
          あなたにおすすめの記事
        </h2>
        <p className="mt-3 font-bold text-navy-800">{theme.articleTitle}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy-700">
          {relatedSections.map((s) => (
            <li key={s.id}>{s.title}</li>
          ))}
          <li>{lpConfig.service.name}の内容と初回料金</li>
        </ul>
        <Link
          href="/pelvis/article/"
          className="mt-5 flex min-h-14 items-center justify-center rounded-full bg-navy-800 px-6 text-lg font-bold text-white shadow-md transition hover:bg-navy-700 active:scale-[0.98]"
        >
          記事を読む
        </Link>
      </section>

      <p className="mt-6 text-sm text-navy-700">
        ※この結果は、選んだ内容を整理して表示したもので、医学的な診断ではありません。痛みやしびれが強い場合、長く続く場合は医療機関にご相談ください。
      </p>
      <p className="mt-4 text-center">
        <StartButton className="text-sm font-bold text-navy-700 underline underline-offset-4">回答を見直す</StartButton>
      </p>
    </div>
  );
}
