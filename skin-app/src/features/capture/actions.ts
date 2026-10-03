'use server';

import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validation/schemas';

export type CaptureSubject = { kind: 'self' } | { kind: 'customer'; customerId: string };

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * 撮影セッションを作る。同意がない場合は RLS で拒否される。
 * ID はここで決め、作成後に読み返さない（insert ... returning は、閲覧の RLS が
 * 同じ文の中で作った行を見られないため拒否される）。
 */
export async function createPhotoSession(
  subject: CaptureSubject,
): Promise<Result<{ sessionId: string; pathPrefix: string }>> {
  const supabase = await createClient();
  if (subject.kind === 'self') {
    const user = await requireRole(['user']);
    const sessionId = crypto.randomUUID();
    const { error } = await supabase
      .from('photo_sessions')
      .insert({ id: sessionId, user_id: user.id, captured_by: user.id });
    if (error) {
      return { ok: false, message: '撮影を開始できません。撮影と保存への同意が必要です。' };
    }
    return { ok: true, data: { sessionId, pathPrefix: `self/${user.id}/${sessionId}/` } };
  }

  const user = await requireRole(['staff', 'admin']);
  const customerId = uuidSchema.safeParse(subject.customerId);
  if (!customerId.success) return { ok: false, message: '顧客が見つかりません。' };
  const sessionId = crypto.randomUUID();
  const { error } = await supabase
    .from('photo_sessions')
    .insert({ id: sessionId, customer_id: customerId.data, captured_by: user.id });
  if (error) {
    return {
      ok: false,
      message: '撮影を開始できません。担当のお客さまで、撮影と保存への同意があることを確認してください。',
    };
  }
  return { ok: true, data: { sessionId, pathPrefix: `salon/${customerId.data}/${sessionId}/` } };
}

const finite = z.number().finite();

const photoSchema = z.object({
  sessionId: z.uuid(),
  photoId: z.uuid(),
  angle: z.enum(['front', 'left', 'right']),
  width: z.int().min(1).max(8192),
  height: z.int().min(1).max(8192),
  deviceClass: z.enum(['phone', 'tablet', 'desktop']),
  source: z.enum(['camera', 'upload']),
  quality: z.object({
    brightness: finite.min(0).max(1),
    sharpness: finite.min(0).max(1e6),
    faceCheckAvailable: z.boolean(),
    faceCount: z.int().min(0).max(10),
    yawDeg: finite.min(-90).max(90).nullable(),
    pitchDeg: finite.min(-90).max(90).nullable(),
    faceWidthRatio: finite.min(0).max(1).nullable(),
    passed: z.boolean(),
    issues: z.array(z.string().max(30)).max(10),
  }),
});

export type PhotoRegistration = z.input<typeof photoSchema>;

/** アップロード済みの写真の情報を登録する。保存場所は RLS でセッションと一致するか確認される */
export async function registerPhoto(input: PhotoRegistration): Promise<Result<null>> {
  await requireRole(['user', 'staff', 'admin']);
  const parsed = photoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: '写真の情報が正しくありません。' };
  const p = parsed.data;

  const supabase = await createClient();
  const { data: session } = await supabase
    .from('photo_sessions')
    .select('id, user_id, customer_id')
    .eq('id', p.sessionId)
    .maybeSingle();
  if (!session) return { ok: false, message: '撮影セッションが見つかりません。' };

  const owner = session.user_id ? `self/${session.user_id}` : `salon/${session.customer_id}`;
  const { error } = await supabase.from('photos').insert({
    id: p.photoId,
    session_id: p.sessionId,
    angle: p.angle,
    storage_path: `${owner}/${p.sessionId}/${p.photoId}.jpg`,
    width: p.width,
    height: p.height,
    quality: { ...p.quality, source: p.source },
    quality_passed: p.quality.passed,
    device_class: p.deviceClass,
  });
  if (error) return { ok: false, message: '写真の情報を保存できませんでした。' };
  return { ok: true, data: null };
}
