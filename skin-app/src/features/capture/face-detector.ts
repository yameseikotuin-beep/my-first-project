'use client';

// 端末内で動く顔検出（MediaPipe Face Landmarker）。写真を外部に送らない。
// モデルと WASM は自分のサイト（/mediapipe）から配信する（scripts/prepare-assets.mjs）。
import type { FaceLandmarker } from '@mediapipe/tasks-vision';

export type FaceDetection = {
  faceCount: number;
  landmarks: { x: number; y: number }[] | null;
};

type Detector = {
  detectVideo(video: HTMLVideoElement, timestampMs: number): FaceDetection;
  detectImage(image: HTMLCanvasElement): FaceDetection;
};

let loading: Promise<Detector | null> | null = null;

async function createLandmarker(mode: 'VIDEO' | 'IMAGE'): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate },
    runningMode: mode,
    numFaces: 2,
  });
  try {
    return await FaceLandmarker.createFromOptions(fileset, options('GPU'));
  } catch {
    return await FaceLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

function toDetection(result: { faceLandmarks: { x: number; y: number }[][] }): FaceDetection {
  return {
    faceCount: result.faceLandmarks.length,
    landmarks: result.faceLandmarks.length === 1 ? result.faceLandmarks[0] : null,
  };
}

/** 顔検出を読み込む。読み込めない場合は null（顔の向き・距離の確認なしで撮影できる） */
export function loadFaceDetector(): Promise<Detector | null> {
  loading ??= (async () => {
    try {
      const [video, image] = await Promise.all([createLandmarker('VIDEO'), createLandmarker('IMAGE')]);
      return {
        detectVideo: (el, ts) => toDetection(video.detectForVideo(el, ts)),
        detectImage: (canvas) => toDetection(image.detect(canvas)),
      };
    } catch (err) {
      console.warn('[capture] face detector unavailable', err instanceof Error ? err.name : err);
      return null;
    }
  })();
  return loading;
}
