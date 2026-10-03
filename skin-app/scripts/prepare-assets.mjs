// MediaPipe（端末内で動く顔検出）のファイルを public/mediapipe に用意する。
// - WASM ファイル：node_modules からコピー
// - 顔の特徴点モデル：Google の配布元からダウンロード（すでにあれば何もしない）
// 写真は外部に送らず、これらのファイルを自分のサイトから配信して端末内で処理する。
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public', 'mediapipe');
const wasmSrc = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const modelUrl =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const modelPath = path.join(outDir, 'face_landmarker.task');

await mkdir(path.join(outDir, 'wasm'), { recursive: true });
for (const file of await readdir(wasmSrc)) {
  await copyFile(path.join(wasmSrc, file), path.join(outDir, 'wasm', file));
}

const exists = await stat(modelPath).then((s) => s.size > 0, () => false);
if (!exists) {
  try {
    const res = await fetch(modelUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(modelPath, buf);
    const sha = createHash('sha256').update(buf).digest('hex');
    console.log(`[prepare-assets] face_landmarker.task をダウンロードしました (sha256 ${sha})`);
  } catch (err) {
    // ダウンロードできなくてもアプリは動く（顔の向き・距離の自動確認だけが使えなくなる）
    console.warn(`[prepare-assets] モデルをダウンロードできませんでした: ${err.message}`);
    console.warn('[prepare-assets] 顔の向き・距離の自動確認は無効になります。');
  }
}
console.log('[prepare-assets] MediaPipe のファイルを public/mediapipe に用意しました');
