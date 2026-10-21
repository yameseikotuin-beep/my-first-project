import type { Metadata } from 'next';
import { SurveyForm } from '@/components/SurveyForm';

export const metadata: Metadata = {
  title: 'セルフチェック',
  robots: { index: false },
};

export default function CheckPage() {
  return <SurveyForm />;
}
