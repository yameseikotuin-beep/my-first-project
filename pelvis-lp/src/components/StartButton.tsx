'use client';

import Link from 'next/link';
import { useSurvey } from './SurveyProvider';

/** アンケート開始ボタン。回答は残したまま、1問目から表示する */
export function StartButton({ className, children = 'セルフチェックを始める' }: { className: string; children?: React.ReactNode }) {
  const { setStep } = useSurvey();
  return (
    <Link href="/pelvis/check/" onClick={() => setStep(0)} className={className}>
      {children}
    </Link>
  );
}
