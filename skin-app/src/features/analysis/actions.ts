'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/audit';
import { getActiveConsents } from '@/lib/consent';
import { PHOTO_BUCKET } from '@/lib/photos';
import type { FormState } from '@/lib/form-state';
import { uuidSchema } from '@/lib/validation/schemas';
import { mockAnalyzer } from '@/lib/analysis/mock-analyzer';
import { checkPhotos, checkResults } from '@/lib/analysis/quality-gate';
import type { AnalyzerPhoto, ItemResult, PhotoQuality } from '@/lib/analysis/types';
import type { VisualDescription } from '@/lib/ai/description';
import { mockDescriber } from '@/lib/ai/mock-describer';
import { claudeDescriber, claudeModel, isClaudeConfigured } from '@/lib/ai/claude-describer';
import { aiDailyLimit } from '@/lib/ai/limits';

/** AI の説明文を作らなかった（作れなかった）理由。結果の画面で一度だけ案内する */
type AiNotice = 'not_requested' | 'no_consent' | 'not_configured' | 'limit' | 'error' | 'retake';

// 使う特徴抽出の実装。検証済みのモデルができたら、ここ（または設定）で差し替える
const analyzer = mockAnalyzer;

export async function startAnalysis(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(['user', 'staff', 'admin']);
  const sessionId = uuidSchema.safeParse(formData.get('sessionId'));
  if (!sessionId.success) return { message: '撮影が見つかりません。' };
  const wantsAi = formData.get('ai') === '1';

  const supabase = await createClient();
  // RLS により、本人の撮影か担当顧客の撮影しか取得できない
  const { data: session } = await supabase
    .from('photo_sessions')
    .select('id, user_id, customer_id, photos(id, angle, storage_path, quality, quality_passed)')
    .eq('id', sessionId.data)
    .maybeSingle();
  if (!session) return { message: '撮影が見つかりません。' };
  if (session.photos.length === 0) return { message: 'この撮影には写真がありません。もう一度撮影してください。' };

  const photos: (AnalyzerPhoto & { storagePath: string })[] = session.photos.map((p) => ({
    id: p.id,
    angle: p.angle,
    storagePath: p.storage_path,
    quality: { ...((p.quality ?? {}) as Partial<PhotoQuality>), passed: p.quality_passed, issues: [] },
  }));

  // 1. 特徴抽出（モック）と、判定できるかの確認
  const photoGate = checkPhotos(photos);
  const items: ItemResult[] = photoGate.ok ? await analyzer.analyze(photos) : [];
  const gate = photoGate.ok ? checkResults(items) : photoGate;
  const status = gate.ok ? 'completed' : 'retake_required';

  // 2. 見た目の説明文
  let description: VisualDescription;
  let notice: AiNotice | null = null;
  if (!gate.ok) {
    notice = 'retake';
    description = {
      ...(await mockDescriber.describe({ photos: [], items: [] })),
      summary: gate.reason,
      itemNotes: [],
      selfCareInfo: '',
    };
  } else if (!wantsAi) {
    notice = 'not_requested';
    description = await mockDescriber.describe({ photos: [], items });
  } else {
    const subject = session.user_id ? { userId: session.user_id } : { customerId: session.customer_id! };
    const consents = await getActiveConsents(supabase, subject);
    const { data: usedToday } = await supabase.rpc('my_ai_usage_today');
    if (!consents.ai_processing) {
      notice = 'no_consent';
    } else if (!isClaudeConfigured()) {
      notice = 'not_configured';
    } else if ((usedToday ?? 0) >= aiDailyLimit(user.profile.role)) {
      notice = 'limit';
    }

    if (notice) {
      description = await mockDescriber.describe({ photos: [], items });
    } else {
      const withImages = await Promise.all(
        photos.map(async (p) => {
          const { data } = await supabase.storage.from(PHOTO_BUCKET).download(p.storagePath);
          return data ? { ...p, jpeg: new Uint8Array(await data.arrayBuffer()) } : null;
        }),
      );
      const sendable = withImages.filter((p): p is NonNullable<typeof p> => p !== null);
      await writeAudit(supabase, 'ai.send', { type: 'photo_sessions', id: session.id }, {
        photo_ids: sendable.map((p) => p.id),
        provider: 'anthropic',
        model: claudeModel(),
      });
      try {
        description = await claudeDescriber.describe({ photos: sendable, items });
        await supabase.from('ai_usage').insert({ actor_id: user.id, purpose: 'describe', model: description.model, succeeded: true });
      } catch (err) {
        console.error('[analysis] describer failed', err instanceof Error ? err.name : 'unknown');
        await supabase.from('ai_usage').insert({ actor_id: user.id, purpose: 'describe', model: claudeModel(), succeeded: false });
        notice = 'error';
        description = await mockDescriber.describe({ photos: [], items });
      }
    }
  }

  // 3. まとめて保存する（ID はここで決め、保存後に読み返さない）
  const analysisId = crypto.randomUUID();
  const { error: analysisError } = await supabase.from('analyses').insert({
    id: analysisId,
    session_id: session.id,
    status,
    analyzer_name: analyzer.info.name,
    analyzer_version: analyzer.info.version,
    analyzer_validated: analyzer.info.validated,
    retake_reason: gate.ok ? null : gate.reason,
    created_by: user.id,
  });
  if (analysisError) return { message: '分析結果を保存できませんでした。もう一度お試しください。' };

  if (items.length > 0) {
    const { error } = await supabase.from('analysis_items').insert(
      items.map((i) => ({
        analysis_id: analysisId,
        metric: i.metric,
        region: i.region,
        determinable: i.determinable,
        grade: i.grade,
        confidence: i.confidence,
        reason: i.reason ?? null,
      })),
    );
    if (error) return { message: '分析結果の一部を保存できませんでした。もう一度お試しください。' };
  }
  await supabase.from('analysis_descriptions').insert({
    analysis_id: analysisId,
    summary: description.summary,
    item_notes: description.itemNotes,
    cautions: description.cautions,
    self_care_info: description.selfCareInfo,
    suggest_medical_consult: description.suggestMedicalConsult,
    provider: description.provider,
    model: description.model,
    prompt_version: description.promptVersion,
    filtered_count: description.filteredCount,
  });

  const base = session.user_id ? '/me/analyses' : `/staff/customers/${session.customer_id}/analyses`;
  revalidatePath(session.user_id ? '/me' : `/staff/customers/${session.customer_id}`, 'layout');
  redirect(`${base}/${analysisId}${notice ? `?ai=${notice}` : ''}`);
}

export async function deleteAnalysis(formData: FormData): Promise<void> {
  await requireRole(['user', 'admin']);
  const id = uuidSchema.safeParse(formData.get('analysisId'));
  if (!id.success) return;
  const supabase = await createClient();
  // RLS：セルフは本人、サロンは管理者のみ削除できる
  await supabase.from('analyses').delete().eq('id', id.data);
  const customerId = uuidSchema.safeParse(formData.get('customerId'));
  if (customerId.success) {
    revalidatePath(`/staff/customers/${customerId.data}`, 'layout');
    redirect(`/staff/customers/${customerId.data}?tab=analyses`);
  }
  revalidatePath('/me', 'layout');
  redirect('/me/analyses');
}
