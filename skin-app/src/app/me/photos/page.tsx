import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import { PageTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { loadSessionsWithPhotos } from '@/lib/photos';
import { SessionGallery } from '@/features/photos/session-gallery';

export const metadata: Metadata = { title: '保存した写真' };

export default async function MePhotosPage() {
  const user = await requireRole(['user']);
  const supabase = await createClient();
  const sessions = await loadSessionsWithPhotos(supabase, { userId: user.id }, 30);
  return (
    <div className="space-y-6">
      <PageTitle lead="写真はご本人だけが見られます。1枚ずつ、または撮影ごとに削除できます。">保存した写真</PageTitle>
      <LinkButton href="/me/capture">新しく撮影する</LinkButton>
      <SessionGallery sessions={sessions} canDeleteSession />
    </div>
  );
}
