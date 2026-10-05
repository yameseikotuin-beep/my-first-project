'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SupabaseConfig } from '@/lib/env';
import { Button, LinkButton } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import {
  angleGuides,
  estimatePose,
  evaluateQuality,
  issueMessages,
  type Angle,
  type QualityReport,
} from './quality';
import { canvasFromFile, canvasFromVideo, deviceClass, downscale, measureCanvas, STORAGE_MAX_SIDE, toJpeg } from './image';
import { loadFaceDetector } from './face-detector';
import { createPhotoSession, registerPhoto, type CaptureSubject } from './actions';

const ANGLES: readonly Angle[] = ['front', 'left', 'right'];
const LIVE_CHECK_INTERVAL_MS = 300;

type Shot = {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  quality: QualityReport;
  source: 'camera' | 'upload';
};

/** 利用者に見せてよい文言を持つエラー */
class UploadError extends Error {}

type Step = 'intro' | 'shoot' | 'review' | 'uploading' | 'done';
type Mode = 'camera' | 'upload';

type Props = {
  subject: CaptureSubject;
  /** 完了後に写真を確認する画面 */
  doneHref: string;
  /** 中止したときに戻る画面 */
  cancelHref: string;
  subjectLabel?: string;
  /** 写真のアップロード先（サーバーから受け取る公開用の接続情報） */
  supabaseConfig: SupabaseConfig;
  /** 保存後に「続けて分析する」のリンク先（末尾に撮影の ID を付ける） */
  analyzeHrefBase?: string;
};

async function analyze(
  canvas: HTMLCanvasElement,
  angle: Angle,
  detect: ((c: HTMLCanvasElement) => { faceCount: number; landmarks: { x: number; y: number }[] | null }) | null,
): Promise<QualityReport> {
  const { brightness, sharpness } = measureCanvas(canvas, canvas.width, canvas.height);
  const face = detect ? detect(downscale(canvas, 1024)) : null;
  const pose = face?.landmarks ? estimatePose(face.landmarks) : null;
  return evaluateQuality(
    {
      brightness,
      sharpness,
      faceCheckAvailable: Boolean(detect),
      faceCount: face?.faceCount ?? 0,
      yawDeg: pose?.yawDeg ?? null,
      pitchDeg: pose?.pitchDeg ?? null,
      faceWidthRatio: pose?.faceWidthRatio ?? null,
    },
    angle,
  );
}

function QualityList({ report }: { report: QualityReport | null }) {
  if (!report) return <p className="text-ink-muted">確認中…</p>;
  const items: { label: string; ok: boolean; message?: string; skipped?: boolean }[] = [
    {
      label: '明るさ',
      ok: !report.issues.some((i) => i === 'too_dark' || i === 'too_bright'),
      message: report.issues.includes('too_dark')
        ? issueMessages.too_dark
        : report.issues.includes('too_bright')
          ? issueMessages.too_bright
          : undefined,
    },
    { label: 'ブレ', ok: !report.issues.includes('blurry'), message: issueMessages.blurry },
    {
      label: '顔の向き',
      ok: !report.issues.some((i) => ['no_face', 'multiple_faces', 'turned_wrong', 'tilted'].includes(i)),
      message: report.issues
        .filter((i) => ['no_face', 'multiple_faces', 'turned_wrong', 'tilted'].includes(i))
        .map((i) => issueMessages[i])
        .join('。'),
      skipped: !report.faceCheckAvailable,
    },
    {
      label: '距離',
      ok: !report.issues.some((i) => i === 'too_far' || i === 'too_close'),
      message: report.issues.includes('too_far') ? issueMessages.too_far : issueMessages.too_close,
      skipped: !report.faceCheckAvailable,
    },
  ];
  return (
    <ul className="grid grid-cols-1 gap-1 text-[0.95rem] sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.label} className="flex gap-2">
          <span aria-hidden className={item.skipped ? 'text-ink-muted' : item.ok ? 'text-sage-strong' : 'text-warning'}>
            {item.skipped ? '－' : item.ok ? '○' : '△'}
          </span>
          <span>
            <span className="font-medium">{item.label}</span>：
            {item.skipped ? '自動確認なし' : item.ok ? 'OK' : item.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CaptureFlow({ subject, doneHref, cancelHref, subjectLabel, supabaseConfig, analyzeHrefBase }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [mode, setMode] = useState<Mode>('camera');
  const [angleIndex, setAngleIndex] = useState(0);
  const [shots, setShots] = useState<Partial<Record<Angle, Shot>>>({});
  const [live, setLive] = useState<QualityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faceCheck, setFaceCheck] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pendingUpload, setPendingUpload] = useState<Shot | null>(null);
  // 保存済みの角度（保存の途中で失敗したときに、続きから再開するため）
  const [uploadedAngles, setUploadedAngles] = useState<readonly Angle[]>([]);
  // 確認画面から1枚だけ撮り直しているときは、撮り終えたら確認画面に戻る
  const [retaking, setRetaking] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Awaited<ReturnType<typeof loadFaceDetector>>>(null);
  const sessionRef = useRef<{ sessionId: string; pathPrefix: string } | null>(null);
  const uploadedRef = useRef<Set<Angle>>(new Set());

  const angle = ANGLES[angleIndex];

  useEffect(() => {
    let cancelled = false;
    loadFaceDetector().then((d) => {
      if (cancelled) return;
      detectorRef.current = d;
      setFaceCheck(d ? 'ready' : 'unavailable');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // 画面を離れるときはカメラを止め、プレビュー用の URL を解放する
  useEffect(() => stopCamera, [stopCamera]);
  const shotsRef = useRef(shots);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);
  useEffect(
    () => () => {
      Object.values(shotsRef.current).forEach((s) => s && URL.revokeObjectURL(s.previewUrl));
    },
    [],
  );

  // 撮影ステップの間だけカメラを動かす
  useEffect(() => {
    if (step !== 'shoot' || mode !== 'camera') return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'カメラの使用が許可されていません。ブラウザの設定で許可するか、「写真を選ぶ」から撮影済みの写真を使ってください。'
            : 'カメラを起動できませんでした。「写真を選ぶ」から撮影済みの写真を使うこともできます。',
        );
      });
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [step, mode, stopCamera]);

  // カメラ映像を一定間隔で確認する
  useEffect(() => {
    if (step !== 'shoot' || mode !== 'camera') return;
    let timer: number;
    let lastTs = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        const { brightness, sharpness } = measureCanvas(video, video.videoWidth, video.videoHeight);
        let face = null;
        const detector = detectorRef.current;
        if (detector) {
          const ts = Math.max(performance.now(), lastTs + 1);
          lastTs = ts;
          face = detector.detectVideo(video, ts);
        }
        const pose = face?.landmarks ? estimatePose(face.landmarks) : null;
        setLive(
          evaluateQuality(
            {
              brightness,
              sharpness,
              faceCheckAvailable: Boolean(detector),
              faceCount: face?.faceCount ?? 0,
              yawDeg: pose?.yawDeg ?? null,
              pitchDeg: pose?.pitchDeg ?? null,
              faceWidthRatio: pose?.faceWidthRatio ?? null,
            },
            angle,
          ),
        );
      }
      timer = window.setTimeout(tick, LIVE_CHECK_INTERVAL_MS);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [step, mode, angle]);

  function saveShot(shot: Shot) {
    setShots((prev) => {
      const old = prev[angle];
      if (old) URL.revokeObjectURL(old.previewUrl);
      return { ...prev, [angle]: shot };
    });
    uploadedRef.current.delete(angle);
    setUploadedAngles([...uploadedRef.current]);
    goNext();
  }

  function goNext() {
    setLive(null);
    setPendingUpload(null);
    setError(null);
    if (retaking) {
      setRetaking(false);
      stopCamera();
      setStep('review');
    } else if (angleIndex < ANGLES.length - 1) {
      setAngleIndex(angleIndex + 1);
    } else {
      stopCamera();
      setStep('review');
    }
  }

  async function takePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const full = canvasFromVideo(video);
    const canvas = downscale(full, STORAGE_MAX_SIDE);
    const detect = detectorRef.current ? detectorRef.current.detectImage : null;
    const quality = await analyze(canvas, angle, detect);
    const blob = await toJpeg(canvas);
    saveShot({
      blob,
      previewUrl: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
      quality,
      source: 'camera',
    });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const canvas = downscale(await canvasFromFile(file), STORAGE_MAX_SIDE);
      const detect = detectorRef.current ? detectorRef.current.detectImage : null;
      const quality = await analyze(canvas, angle, detect);
      const blob = await toJpeg(canvas);
      if (pendingUpload) URL.revokeObjectURL(pendingUpload.previewUrl);
      setPendingUpload({
        blob,
        previewUrl: URL.createObjectURL(blob),
        width: canvas.width,
        height: canvas.height,
        quality,
        source: 'upload',
      });
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'unsupported_image'
          ? 'この形式の画像は読み込めません（HEIC など）。JPEG か PNG の写真を選んでください。'
          : '画像を読み込めませんでした。別の写真を選んでください。',
      );
    }
  }

  function retake(target: Angle) {
    setAngleIndex(ANGLES.indexOf(target));
    setRetaking(true);
    setStep('shoot');
  }

  async function upload() {
    const entries = ANGLES.filter((a) => shots[a]).map((a) => [a, shots[a]!] as const);
    if (entries.length === 0) return;
    setStep('uploading');
    setError(null);
    setProgress({ done: uploadedRef.current.size, total: entries.length });

    try {
      if (!sessionRef.current) {
        const created = await createPhotoSession(subject);
        if (!created.ok) throw new UploadError(created.message);
        sessionRef.current = created.data;
      }
      const { sessionId, pathPrefix } = sessionRef.current;
      const supabase = createClient(supabaseConfig);
      const device = deviceClass();

      for (const [a, shot] of entries) {
        if (uploadedRef.current.has(a)) continue;
        const photoId = crypto.randomUUID();
        const { error: uploadError } = await supabase.storage
          .from('face-photos')
          .upload(`${pathPrefix}${photoId}.jpg`, shot.blob, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw new UploadError('写真を保存できませんでした。通信状態を確認して、もう一度お試しください。');
        const registered = await registerPhoto({
          sessionId,
          photoId,
          angle: a,
          width: shot.width,
          height: shot.height,
          deviceClass: device,
          source: shot.source,
          quality: {
            brightness: shot.quality.brightness,
            sharpness: shot.quality.sharpness,
            faceCheckAvailable: shot.quality.faceCheckAvailable,
            faceCount: shot.quality.faceCount,
            yawDeg: shot.quality.yawDeg,
            pitchDeg: shot.quality.pitchDeg,
            faceWidthRatio: shot.quality.faceWidthRatio,
            passed: shot.quality.passed,
            issues: shot.quality.issues,
          },
        });
        if (!registered.ok) throw new UploadError(registered.message);
        setSavedSessionId(sessionId);
        uploadedRef.current.add(a);
        setUploadedAngles([...uploadedRef.current]);
        setProgress({ done: uploadedRef.current.size, total: entries.length });
      }
      setStep('done');
    } catch (err) {
      setError(
        err instanceof UploadError
          ? err.message
          : '保存できませんでした。ログインの有効期限が切れた可能性があります。ページを再読み込みしてお試しください。',
      );
      setStep('review');
    }
  }

  // ---------------------------------------------------------------- 画面
  if (step === 'intro') {
    return (
      <div className="space-y-5">
        {subjectLabel ? <p className="text-ink-muted">撮影する方：{subjectLabel}</p> : null}
        <ol className="space-y-2 rounded-2xl bg-surface p-5 [&>li]:ml-5 [&>li]:list-decimal">
          <li>明るく、光がなるべく均一に当たる場所で撮影してください（窓の正面など）。</li>
          <li>前髪や眼鏡で肌が隠れないようにしてください。</li>
          <li>正面 → 左側 → 右側 の順に撮影します。左右は省略できます。</li>
          <li>顔の向き・明るさ・距離はこの端末の中で確認し、外部には送りません。</li>
        </ol>
        {faceCheck === 'unavailable' ? (
          <Notice tone="warning" title="顔の向き・距離の自動確認が使えません">
            明るさとブレだけを確認します。画面の案内を見ながら撮影してください。
          </Notice>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              setMode('camera');
              setStep('shoot');
            }}
          >
            カメラで撮影する
          </Button>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => {
              setMode('upload');
              setStep('shoot');
            }}
          >
            写真を選ぶ
          </Button>
        </div>
        <LinkButton href={cancelHref} variant="ghost" className="w-full sm:w-auto">
          やめる
        </LinkButton>
      </div>
    );
  }

  if (step === 'shoot') {
    const guide = angleGuides[angle];
    const report = mode === 'camera' ? live : (pendingUpload?.quality ?? null);
    return (
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl font-semibold">
            {guide.label}
            <span className="ml-2 text-base font-normal text-ink-muted">
              （{angleIndex + 1}/{ANGLES.length}）
            </span>
          </h2>
          <Link href={cancelHref} className="text-sm text-ink-muted underline">
            中止（保存しない）
          </Link>
        </div>
        <p className="font-medium">{guide.instruction}</p>

        {error ? (
          <Notice tone="danger" live>
            {error}
          </Notice>
        ) : null}

        {mode === 'camera' ? (
          <div className="relative mx-auto h-[50svh] max-h-[36rem] min-h-64 w-full max-w-md overflow-hidden rounded-3xl bg-ink">
            {/* 自分の姿を見やすくするため、表示だけ左右反転する（保存する写真は反転しない） */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full -scale-x-100 object-cover"
              aria-label="カメラの映像"
            />
            <div
              aria-hidden
              className={`pointer-events-none absolute left-1/2 top-1/2 h-[62%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 ${
                live?.passed ? 'border-sage-soft' : 'border-gold'
              }`}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="font-medium">{guide.label}の写真を選ぶ</span>
              <input
                key={angle}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-2 block w-full rounded-xl border border-line bg-surface p-3"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
            {pendingUpload ? (
              // eslint-disable-next-line @next/next/no-img-element -- 端末内の blob URL を表示するため
              <img
                src={pendingUpload.previewUrl}
                alt={`選んだ${guide.label}の写真`}
                className="mx-auto max-h-80 rounded-2xl object-contain"
              />
            ) : null}
          </div>
        )}

        <div aria-live="polite" className="rounded-2xl border border-line bg-surface p-4">
          <QualityList report={report} />
        </div>

        <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          {mode === 'camera' ? (
            <>
              <Button className="w-full" onClick={() => void takePhoto()} disabled={!live?.passed}>
                撮影する
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => void takePhoto()} disabled={!live}>
                条件を満たさないまま撮影する
              </Button>
            </>
          ) : (
            <Button className="w-full" onClick={() => pendingUpload && saveShot(pendingUpload)} disabled={!pendingUpload}>
              {pendingUpload && !pendingUpload.quality.passed ? 'この写真を使う（条件を満たしていません）' : 'この写真を使う'}
            </Button>
          )}
          {retaking ? (
            <Button variant="ghost" className="w-full" onClick={goNext}>
              撮り直しをやめて確認画面に戻る
            </Button>
          ) : angle !== 'front' ? (
            <Button variant="ghost" className="w-full" onClick={goNext}>
              {guide.label}の撮影を省略する
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (step === 'review' || step === 'uploading') {
    const taken = ANGLES.filter((a) => shots[a]);
    const hasLowQuality = taken.some((a) => !shots[a]!.quality.passed);
    return (
      <div className="space-y-5">
        <h2 className="font-serif text-xl font-semibold">写真の確認</h2>
        {error ? (
          <Notice tone="danger" live>
            {error}
          </Notice>
        ) : null}
        {hasLowQuality ? (
          <Notice tone="warning" title="撮影条件を満たしていない写真があります">
            そのまま保存できますが、後で比較するときの精度が下がります。できれば撮り直してください。
          </Notice>
        ) : null}
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ANGLES.map((a) => {
            const shot = shots[a];
            return (
              <li key={a} className="rounded-2xl border border-line bg-surface p-3">
                <p className="font-medium">{angleGuides[a].label}</p>
                {shot ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- 端末内の blob URL を表示するため */}
                    <img
                      src={shot.previewUrl}
                      alt={`${angleGuides[a].label}の写真`}
                      className="mt-2 aspect-[3/4] w-full rounded-xl object-cover"
                    />
                    <p className={`mt-2 text-sm ${shot.quality.passed ? 'text-sage-strong' : 'text-warning'}`}>
                      {shot.quality.passed ? '○ 撮影条件OK' : `△ ${shot.quality.issues.map((i) => issueMessages[i]).join('。')}`}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-ink-muted">省略しました</p>
                )}
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => retake(a)}
                  disabled={step === 'uploading' || uploadedAngles.includes(a)}
                >
                  {shot ? '撮り直す' : '撮影する'}
                </Button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="w-full sm:w-auto"
            onClick={() => void upload()}
            disabled={taken.length === 0 || step === 'uploading'}
            aria-busy={step === 'uploading'}
          >
            {step === 'uploading'
              ? `保存中…（${progress?.done ?? 0}/${progress?.total ?? taken.length}）`
              : error
                ? 'もう一度保存する'
                : '保存する'}
          </Button>
          <LinkButton href={cancelHref} variant="ghost" className="w-full sm:w-auto">
            保存せずにやめる
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Notice tone="success" title="写真を保存しました" live>
        保存した写真はいつでも確認・削除できます。
      </Notice>
      <div className="flex flex-col gap-3 sm:flex-row">
        {analyzeHrefBase && savedSessionId ? (
          <LinkButton href={`${analyzeHrefBase}${savedSessionId}`} className="w-full sm:w-auto">
            続けて分析する
          </LinkButton>
        ) : null}
        <LinkButton href={doneHref} variant="secondary" className="w-full sm:w-auto">
          保存した写真を見る
        </LinkButton>
      </div>
    </div>
  );
}
