'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { startAnalysis } from './actions';
import { initialFormState } from '@/lib/form-state';
import { buttonClass } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

function Buttons({ aiAvailable }: { aiAvailable: boolean }) {
  const { pending, data } = useFormStatus();
  const usingAi = data?.get('ai') === '1';
  if (pending) {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl border border-line bg-surface p-4">
        <p className="font-medium">分析しています…</p>
        <p className="text-sm text-ink-muted">
          {usingAi ? 'AI が写真を確認しています。30秒〜1分ほどかかることがあります。画面を閉じずにお待ちください。' : 'まもなく完了します。'}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {aiAvailable ? (
        <button type="submit" name="ai" value="1" className={buttonClass('primary', 'w-full sm:w-auto')}>
          AI に送信して分析する
        </button>
      ) : null}
      <button
        type="submit"
        name="ai"
        value="0"
        className={buttonClass(aiAvailable ? 'secondary' : 'primary', 'w-full sm:w-auto')}
      >
        AI に送らずに分析する
      </button>
    </div>
  );
}

export function AnalyzeForm({ sessionId, aiAvailable }: { sessionId: string; aiAvailable: boolean }) {
  const [state, action] = useActionState(startAnalysis, initialFormState);
  return (
    <form action={action} className="space-y-4">
      {state.message ? (
        <Notice tone="danger" live>
          {state.message}
        </Notice>
      ) : null}
      <input type="hidden" name="sessionId" value={sessionId} />
      <Buttons aiAvailable={aiAvailable} />
    </form>
  );
}
