import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { loadSessionsWithPhotos } from '@/lib/photos';
import { uuidSchema } from '@/lib/validation/schemas';
import { AnalyzeConfirm } from '@/features/analysis/analyze-confirm';
import { getAiAvailability } from '@/features/analysis/ai-availability';

export const metadata: Metadata = { title: '分析の確認' };
// AI の説明文の作成には時間がかかるため、処理の制限時間を延ばす
export const maxDuration = 60;

export default async function MeAnalyzePage({ searchParams }: PageProps<'/me/analyses/new'>) {
  const user = await requireRole(['user']);
  const { session: sessionParam } = await searchParams;
  const sessionId = uuidSchema.safeParse(sessionParam);
  if (!sessionId.success) notFound();
  const supabase = await createClient();
  const [session] = await loadSessionsWithPhotos(supabase, { sessionId: sessionId.data }, 1);
  if (!session || session.user_id !== user.id) notFound();
  const ai = await getAiAvailability(supabase, { userId: user.id }, 'user');
  return <AnalyzeConfirm session={session} ai={ai} consentHref="/consent" />;
}
