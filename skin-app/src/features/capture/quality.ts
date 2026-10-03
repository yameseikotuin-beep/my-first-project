// 撮影品質の判定（端末内で計算する。数値の意味がはっきりしている項目だけを扱う）
// docs/03-architecture.md §4 の QualityAssessor に当たる。

export type Angle = 'front' | 'left' | 'right';

export type QualityIssue =
  | 'too_dark'
  | 'too_bright'
  | 'blurry'
  | 'no_face'
  | 'multiple_faces'
  | 'turned_wrong'
  | 'tilted'
  | 'too_far'
  | 'too_close';

export type QualityMeasurement = {
  /** 平均の明るさ 0〜1 */
  brightness: number;
  /** 鮮明さ（ラプラシアンの分散。大きいほど鮮明） */
  sharpness: number;
  /** 顔検出が使えたか。使えない場合は向き・距離を判定しない */
  faceCheckAvailable: boolean;
  faceCount: number;
  /** 左右の向き（度）。正＝利用者から見て右を向いている */
  yawDeg: number | null;
  /** 上下の向き（度）。正＝上を向いている */
  pitchDeg: number | null;
  /** 画面に占める顔の幅の割合 0〜1 */
  faceWidthRatio: number | null;
};

export type QualityReport = QualityMeasurement & {
  passed: boolean;
  issues: QualityIssue[];
};

export const thresholds = {
  brightnessMin: 0.28,
  brightnessMax: 0.85,
  sharpnessMin: 60,
  frontYawMax: 10,
  sideYawMin: 20,
  sideYawMax: 50,
  pitchMax: 20,
  faceWidthMin: 0.3,
  faceWidthMax: 0.75,
} as const;

export const issueMessages: Record<QualityIssue, string> = {
  too_dark: '暗すぎます。明るい場所に移動してください',
  too_bright: '明るすぎます。強い光が直接当たらない場所に移動してください',
  blurry: 'ぶれています。端末を固定して、少し待ってから撮影してください',
  no_face: '顔が見つかりません。枠の中に顔を入れてください',
  multiple_faces: '複数の顔が写っています。お一人で撮影してください',
  turned_wrong: '顔の向きを指示に合わせてください',
  tilted: '顔が上下に傾いています。まっすぐ前を向いてください',
  too_far: '遠すぎます。もう少し近づいてください',
  too_close: '近すぎます。少し離れてください',
};

export const angleGuides: Record<Angle, { label: string; instruction: string }> = {
  front: { label: '正面', instruction: 'まっすぐ正面を向いてください' },
  left: { label: '左側', instruction: '顔を右に向けて、左の頬をカメラに向けてください' },
  right: { label: '右側', instruction: '顔を左に向けて、右の頬をカメラに向けてください' },
};

export function evaluateQuality(m: QualityMeasurement, angle: Angle): QualityReport {
  const issues: QualityIssue[] = [];
  if (m.brightness < thresholds.brightnessMin) issues.push('too_dark');
  if (m.brightness > thresholds.brightnessMax) issues.push('too_bright');
  if (m.sharpness < thresholds.sharpnessMin) issues.push('blurry');

  if (m.faceCheckAvailable) {
    if (m.faceCount === 0) {
      issues.push('no_face');
    } else if (m.faceCount > 1) {
      issues.push('multiple_faces');
    } else {
      if (m.yawDeg !== null) {
        const yaw = m.yawDeg;
        const ok =
          angle === 'front'
            ? Math.abs(yaw) <= thresholds.frontYawMax
            : // 左の頬を見せる＝顔を右に向ける（yaw が正）
              (angle === 'left' ? yaw : -yaw) >= thresholds.sideYawMin &&
              (angle === 'left' ? yaw : -yaw) <= thresholds.sideYawMax;
        if (!ok) issues.push('turned_wrong');
      }
      if (m.pitchDeg !== null && Math.abs(m.pitchDeg) > thresholds.pitchMax) issues.push('tilted');
      if (m.faceWidthRatio !== null) {
        if (m.faceWidthRatio < thresholds.faceWidthMin) issues.push('too_far');
        if (m.faceWidthRatio > thresholds.faceWidthMax) issues.push('too_close');
      }
    }
  }
  return { ...m, passed: issues.length === 0, issues };
}

/** RGBA の画素から平均の明るさ（0〜1）を求める */
export function measureBrightness(rgba: Uint8ClampedArray): number {
  let sum = 0;
  const n = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) {
    sum += 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
  }
  return n === 0 ? 0 : sum / n / 255;
}

/** RGBA の画素からラプラシアンの分散（鮮明さの目安）を求める */
export function measureSharpness(rgba: Uint8ClampedArray, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
    gray[p] = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
  }
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

type Point = { x: number; y: number };

/**
 * 顔の特徴点（MediaPipe Face Landmarker の正規化座標）から、向きと顔の大きさの目安を求める。
 * 正確な角度ではなく、撮影ガイドのための目安。
 * 使う点：1=鼻先、234=右頬の輪郭（画像の左側）、454=左頬の輪郭（画像の右側）、10=額、152=あご
 */
export function estimatePose(landmarks: readonly Point[]): {
  yawDeg: number;
  pitchDeg: number;
  faceWidthRatio: number;
} | null {
  const nose = landmarks[1];
  const leftEdge = landmarks[234];
  const rightEdge = landmarks[454];
  const top = landmarks[10];
  const chin = landmarks[152];
  if (!nose || !leftEdge || !rightEdge || !top || !chin) return null;

  const width = rightEdge.x - leftEdge.x;
  const height = chin.y - top.y;
  if (width <= 0 || height <= 0) return null;

  // 鼻先が輪郭の中央からどれだけずれているか（-1〜1）
  const horizontal = ((nose.x - leftEdge.x) / width - 0.5) * 2;
  // 画像上で鼻先が右（x が大きい）にずれる＝利用者から見て左を向いている（自撮りは鏡像でない元画像で判定）
  const yawDeg = -Math.asin(Math.max(-1, Math.min(1, horizontal))) * (180 / Math.PI);

  // 正面を向いたときの鼻先の縦位置はおよそ 0.55〜0.6
  const vertical = (nose.y - top.y) / height - 0.58;
  const pitchDeg = -Math.asin(Math.max(-1, Math.min(1, vertical * 2.5))) * (180 / Math.PI);

  return { yawDeg, pitchDeg, faceWidthRatio: Math.min(1, width) };
}
