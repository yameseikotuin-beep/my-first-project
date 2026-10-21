import type { Metadata } from 'next';
import { SurveyResultView } from '@/components/SurveyResultView';

export const metadata: Metadata = {
  title: 'チェック結果',
  robots: { index: false },
};

export default function ResultPage() {
  return <SurveyResultView />;
}
