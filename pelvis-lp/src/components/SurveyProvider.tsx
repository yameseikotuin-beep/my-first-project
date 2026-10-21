'use client';

// アンケートの回答をページ間で共有する。
// 回答はこのブラウザのタブ内（sessionStorage）だけに置き、サーバーや URL には一切出さない。

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { surveyQuestions, type SurveyAnswers } from '@/content/survey';

const STORAGE_KEY = 'pelvis-lp:survey:v1';

type StoredState = { answers: SurveyAnswers; step: number; completed: boolean };

type SurveyContextValue = StoredState & {
  /** sessionStorage からの読み込みが済んだか（済むまでは「未回答」と判断しない） */
  hydrated: boolean;
  setAnswer: (questionId: string, optionIds: string[]) => void;
  setStep: (step: number) => void;
  markCompleted: () => void;
  reset: () => void;
};

const initialState: StoredState = { answers: {}, step: 0, completed: false };

const SurveyContext = createContext<SurveyContextValue | null>(null);

function readStored(): StoredState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const answers: SurveyAnswers = {};
    // 既知の質問・選択肢だけを読み込む
    for (const q of surveyQuestions) {
      const value = parsed.answers?.[q.id];
      if (!Array.isArray(value)) continue;
      const valid = value.filter((id) => q.options.some((o) => o.id === id));
      if (valid.length) answers[q.id] = q.multiple ? valid : valid.slice(0, 1);
    }
    const step = Number.isInteger(parsed.step) ? Math.min(Math.max(parsed.step as number, 0), surveyQuestions.length - 1) : 0;
    return { answers, step, completed: parsed.completed === true };
  } catch {
    return initialState;
  }
}

export function SurveyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // サーバー描画と一致させるため、保存済みの回答は表示後に読み込む
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 保存できなくても、このページを開いている間は回答を保持できる
    }
  }, [state, hydrated]);

  const setAnswer = useCallback((questionId: string, optionIds: string[]) => {
    // 回答を変えたら結果は確定前の状態に戻す
    setState((s) => ({ ...s, answers: { ...s.answers, [questionId]: optionIds }, completed: false }));
  }, []);
  const setStep = useCallback((step: number) => setState((s) => ({ ...s, step })), []);
  const markCompleted = useCallback(() => setState((s) => ({ ...s, completed: true })), []);
  const reset = useCallback(() => setState(initialState), []);

  const value = useMemo(
    () => ({ ...state, hydrated, setAnswer, setStep, markCompleted, reset }),
    [state, hydrated, setAnswer, setStep, markCompleted, reset],
  );

  return <SurveyContext.Provider value={value}>{children}</SurveyContext.Provider>;
}

export function useSurvey(): SurveyContextValue {
  const ctx = useContext(SurveyContext);
  if (!ctx) throw new Error('useSurvey は SurveyProvider の内側で使ってください');
  return ctx;
}
