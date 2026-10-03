import { describe, expect, it } from 'vitest';
import {
  estimatePose,
  evaluateQuality,
  measureBrightness,
  measureSharpness,
  type QualityMeasurement,
} from '@/features/capture/quality';

const good: QualityMeasurement = {
  brightness: 0.55,
  sharpness: 200,
  faceCheckAvailable: true,
  faceCount: 1,
  yawDeg: 0,
  pitchDeg: 0,
  faceWidthRatio: 0.5,
};

describe('evaluateQuality', () => {
  it('条件をすべて満たせば合格', () => {
    expect(evaluateQuality(good, 'front')).toMatchObject({ passed: true, issues: [] });
  });

  it('暗い・明るすぎる・ぶれている写真を指摘する', () => {
    expect(evaluateQuality({ ...good, brightness: 0.1 }, 'front').issues).toContain('too_dark');
    expect(evaluateQuality({ ...good, brightness: 0.95 }, 'front').issues).toContain('too_bright');
    expect(evaluateQuality({ ...good, sharpness: 5 }, 'front').issues).toContain('blurry');
  });

  it('顔がない・複数あるときは指摘する', () => {
    expect(evaluateQuality({ ...good, faceCount: 0 }, 'front').issues).toEqual(['no_face']);
    expect(evaluateQuality({ ...good, faceCount: 2 }, 'front').issues).toEqual(['multiple_faces']);
  });

  it('正面は横を向いていると不合格', () => {
    expect(evaluateQuality({ ...good, yawDeg: 25 }, 'front').issues).toContain('turned_wrong');
  });

  it('左側の撮影では顔を右に向ける（yaw が正）', () => {
    expect(evaluateQuality({ ...good, yawDeg: 30 }, 'left').passed).toBe(true);
    expect(evaluateQuality({ ...good, yawDeg: -30 }, 'left').issues).toContain('turned_wrong');
    expect(evaluateQuality({ ...good, yawDeg: 0 }, 'left').issues).toContain('turned_wrong');
  });

  it('右側の撮影では顔を左に向ける（yaw が負）', () => {
    expect(evaluateQuality({ ...good, yawDeg: -30 }, 'right').passed).toBe(true);
    expect(evaluateQuality({ ...good, yawDeg: 30 }, 'right').issues).toContain('turned_wrong');
  });

  it('距離と上下の傾きを指摘する', () => {
    expect(evaluateQuality({ ...good, faceWidthRatio: 0.1 }, 'front').issues).toContain('too_far');
    expect(evaluateQuality({ ...good, faceWidthRatio: 0.9 }, 'front').issues).toContain('too_close');
    expect(evaluateQuality({ ...good, pitchDeg: 30 }, 'front').issues).toContain('tilted');
  });

  it('顔検出が使えないときは明るさとブレだけで判定する', () => {
    const r = evaluateQuality(
      { ...good, faceCheckAvailable: false, faceCount: 0, yawDeg: null, pitchDeg: null, faceWidthRatio: null },
      'left',
    );
    expect(r).toMatchObject({ passed: true, issues: [] });
  });
});

describe('measureBrightness / measureSharpness', () => {
  const solid = (v: number, n: number) => new Uint8ClampedArray(Array.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : v)));

  it('明るさは 0〜1 で返る', () => {
    expect(measureBrightness(solid(0, 16))).toBe(0);
    expect(measureBrightness(solid(255, 16))).toBeCloseTo(1);
  });

  it('一様な画像は鮮明さ 0、模様のある画像は大きい', () => {
    expect(measureSharpness(solid(128, 100), 10, 10)).toBe(0);
    const checker = new Uint8ClampedArray(100 * 4);
    for (let p = 0; p < 100; p++) {
      const v = (Math.floor(p / 10) + (p % 10)) % 2 === 0 ? 0 : 255;
      checker.set([v, v, v, 255], p * 4);
    }
    expect(measureSharpness(checker, 10, 10)).toBeGreaterThan(1000);
  });
});

describe('estimatePose', () => {
  function face(noseX: number, noseY = 0.58) {
    const pts = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));
    pts[234] = { x: 0.3, y: 0.5 };
    pts[454] = { x: 0.7, y: 0.5 };
    pts[10] = { x: 0.5, y: 0.2 };
    pts[152] = { x: 0.5, y: 0.8 };
    pts[1] = { x: noseX, y: 0.2 + 0.6 * noseY };
    return pts;
  }

  it('鼻先が中央なら正面', () => {
    const pose = estimatePose(face(0.5))!;
    expect(Math.abs(pose.yawDeg)).toBeLessThan(1);
    expect(Math.abs(pose.pitchDeg)).toBeLessThan(1);
    expect(pose.faceWidthRatio).toBeCloseTo(0.4);
  });

  it('鼻先が画像の左に寄ると、利用者から見て右を向いている（yaw が正）', () => {
    expect(estimatePose(face(0.4))!.yawDeg).toBeGreaterThan(20);
    expect(estimatePose(face(0.6))!.yawDeg).toBeLessThan(-20);
  });

  it('特徴点が足りなければ null', () => {
    expect(estimatePose([])).toBeNull();
  });
});
