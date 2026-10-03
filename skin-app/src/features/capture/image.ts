'use client';

import { measureBrightness, measureSharpness } from './quality';

/** 保存する写真の長辺（px） */
export const STORAGE_MAX_SIDE = 2048;
/** 品質の計算に使う縮小画像の幅（px）。解像度によって値が変わらないよう固定する */
const MEASURE_WIDTH = 256;

export function canvasFromVideo(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  return canvas;
}

/**
 * アップロードされた画像ファイルを読み込む。
 * 写真の向き（EXIF の回転情報）は反映し、それ以外の情報（位置情報など）は描き直しで取り除かれる。
 */
export async function canvasFromFile(file: File): Promise<HTMLCanvasElement> {
  if (!file.type.startsWith('image/')) throw new Error('not_image');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('unsupported_image');
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

export function downscale(source: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  if (scale === 1) return source;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** 明るさと鮮明さを計算する（縮小した画像で計算する） */
export function measureCanvas(source: CanvasImageSource, sourceWidth: number, sourceHeight: number) {
  const w = MEASURE_WIDTH;
  const h = Math.max(1, Math.round((sourceHeight / sourceWidth) * w));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return { brightness: measureBrightness(data), sharpness: measureSharpness(data, w, h) };
}

/** JPEG に変換する（描き直したものを書き出すため、EXIF などのメタデータは含まれない） */
export function toJpeg(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode_failed'))), 'image/jpeg', quality);
  });
}

export function deviceClass(): 'phone' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return /Android/i.test(ua) && !/Mobi/i.test(ua) ? 'tablet' : 'phone';
  return 'desktop';
}
