'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { isAnswered, isSurveyComplete, surveyQuestions } from '@/content/survey';
import { trackOnce } from '@/lib/analytics';
import { useSurvey } from './SurveyProvider';

export function SurveyForm() {
  const router = useRouter();
  const { answers, step, hydrated, setAnswer, setStep, markCompleted } = useSurvey();
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef<number | null>(null);

  const total = surveyQuestions.length;
  const question = surveyQuestions[step];
  const selected = answers[question.id] ?? [];
  const isLast = step === total - 1;

  useEffect(() => {
    trackOnce('survey_start');
  }, []);

  // 「次へ」「戻る」で質問が切り替わったら見出しへ移動する（スクリーンリーダー・スクロール位置のため）。
  // 保存済みの回答を読み込んだときの切り替えでは移動しない
  useEffect(() => {
    if (!hydrated) return;
    if (shownStep.current !== null && shownStep.current !== step) {
      headingRef.current?.focus();
      window.scrollTo({ top: 0 });
    }
    shownStep.current = step;
  }, [step, hydrated]);

  function toggle(optionId: string) {
    setError('');
    if (question.multiple) {
      setAnswer(question.id, selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId]);
    } else {
      setAnswer(question.id, [optionId]);
    }
  }

  function next() {
    if (question.required && !isAnswered(question, answers)) {
      setError(question.multiple ? '当てはまるものを1つ以上選んでください。' : '当てはまるものを1つ選んでください。');
      return;
    }
    setError('');
    if (!isLast) {
      setStep(step + 1);
      return;
    }
    if (!isSurveyComplete(answers)) {
      // 通常は起きないが、未回答の必須質問があればそこへ戻す
      const firstMissing = surveyQuestions.findIndex((q) => q.required && !isAnswered(q, answers));
      setStep(firstMissing);
      setError('未回答の質問があります。');
      return;
    }
    markCompleted();
    trackOnce('survey_complete');
    router.push('/pelvis/result/');
  }

  function back() {
    setError('');
    if (step > 0) setStep(step - 1);
  }

  const progress = Math.round(((step + 1) / total) * 100);

  return (
    <div className="py-8" aria-busy={!hydrated}>
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between text-sm font-bold text-navy-700">
          <span data-testid="progress-text">
            質問 {step + 1} / {total}
          </span>
          <span>{progress}%</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-beige-200"
          role="progressbar"
          aria-label="回答の進み具合"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step + 1}
        >
          <div className="h-full rounded-full bg-navy-800 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <fieldset aria-describedby={error ? 'survey-error' : undefined}>
        <legend className="w-full">
          <span className="mb-1 block text-sm font-bold text-cta-700">
            Q{step + 1}
            {question.required ? '（必須）' : '（任意）'}
          </span>
          <h1 ref={headingRef} tabIndex={-1} className="text-xl leading-snug font-bold text-navy-900 focus:outline-none focus-visible:outline-none sm:text-2xl">
            {question.title}
          </h1>
          {question.description && <p className="mt-2 text-sm text-navy-700">{question.description}</p>}
        </legend>

        <div className="mt-5 grid gap-3">
          {question.options.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <label
                key={option.id}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition ${
                  checked ? 'border-navy-800 bg-navy-100 font-bold' : 'border-beige-200 bg-white hover:border-beige-400'
                }`}
              >
                <input
                  type={question.multiple ? 'checkbox' : 'radio'}
                  name={question.id}
                  value={option.id}
                  checked={checked}
                  onChange={() => toggle(option.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 text-sm text-white ${
                    question.multiple ? 'rounded-md' : 'rounded-full'
                  } ${checked ? 'border-navy-800 bg-navy-800' : 'border-beige-400 bg-white'}`}
                >
                  {checked ? '✓' : ''}
                </span>
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p id="survey-error" role="alert" className="mt-4 min-h-6 text-sm font-bold text-red-700">
        {error}
      </p>

      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-3">
        {step === 0 ? (
          <Link
            href="/pelvis/"
            className="flex min-h-14 items-center justify-center rounded-full border-2 border-navy-800 bg-white font-bold text-navy-800"
          >
            戻る
          </Link>
        ) : (
          <button
            type="button"
            onClick={back}
            className="min-h-14 rounded-full border-2 border-navy-800 bg-white font-bold text-navy-800"
          >
            戻る
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={!hydrated}
          className="min-h-14 rounded-full bg-navy-800 font-bold text-white shadow-md transition hover:bg-navy-700 active:scale-[0.98] disabled:opacity-60"
        >
          {isLast ? '結果を見る' : '次へ'}
        </button>
      </div>
    </div>
  );
}
