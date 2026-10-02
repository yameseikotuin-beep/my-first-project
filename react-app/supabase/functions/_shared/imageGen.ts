/**
 * 料理画像生成の共通ロジック（Gemini の画像生成。外部ライブラリに依存しない）。
 */

export interface ImageRequest {
  recipeId: string
  recipeName: string
  ingredients: string[]
  genre?: string
  method?: string
}

export class ImageRequestError extends Error {
  status = 400
}

export function validateImageRequest(body: unknown): ImageRequest {
  const b = body as Record<string, unknown> | null
  if (!b || typeof b !== 'object') throw new ImageRequestError('リクエストの形式が不正です')
  const recipeId = b.recipeId
  // 保存先のパスに使うため、英数字・ハイフン・アンダースコアのみ
  if (typeof recipeId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(recipeId)) throw new ImageRequestError('recipeId が不正です')
  const name = b.recipeName
  if (typeof name !== 'string' || !name.trim() || name.length > 80) throw new ImageRequestError('料理名が不正です')
  const ing = b.ingredients
  if (!Array.isArray(ing) || ing.length === 0 || ing.length > 25 || !ing.every((x) => typeof x === 'string' && x.length <= 40)) {
    throw new ImageRequestError('材料が不正です')
  }
  const opt = (k: string) => (typeof b[k] === 'string' && (b[k] as string).length <= 20 ? (b[k] as string) : undefined)
  return { recipeId, recipeName: name.trim(), ingredients: ing as string[], genre: opt('genre'), method: opt('method') }
}

const clean = (s: string) => s.replace(/[\n\r"<>{}]/g, ' ').trim()

/** 料理写真風の画像を作るためのプロンプト */
export function buildImagePrompt(r: ImageRequest): string {
  return [
    `A realistic, appetizing food photograph of a home-cooked Japanese diet-friendly dish called "${clean(r.recipeName)}"${r.genre ? ` (${clean(r.genre)} cuisine)` : ''}.`,
    `Main ingredients: ${r.ingredients.map(clean).join(', ')}.`,
    r.method ? `Cooking method: ${clean(r.method)}.` : '',
    'One serving plated on simple ceramic tableware on a light wooden table, soft natural daylight, shot from a 45-degree angle, shallow depth of field.',
    'Healthy, high-protein, low-fat home cooking with modest portions. No text, no labels, no watermark, no people, no hands.',
  ].filter(Boolean).join(' ')
}

export class ImageGenerationError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

/** Gemini の generateContent の応答から画像（base64）を取り出す */
export function extractImage(json: unknown): { mimeType: string; base64: string } {
  const j = json as {
    promptFeedback?: { blockReason?: string }
    candidates?: { finishReason?: string; content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[]
  }
  if (j?.promptFeedback?.blockReason) {
    throw new ImageGenerationError('この料理名・材料では画像を生成できませんでした（安全性フィルター）。', 422)
  }
  const cand = j?.candidates?.[0]
  const part = cand?.content?.parts?.find((p) => p.inlineData?.data)
  if (!part?.inlineData?.data) {
    if (cand?.finishReason && cand.finishReason !== 'STOP') {
      throw new ImageGenerationError(`画像を生成できませんでした（${cand.finishReason}）。`, 422)
    }
    throw new ImageGenerationError('画像生成サービスから画像が返されませんでした。')
  }
  const mimeType = part.inlineData.mimeType ?? 'image/png'
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) throw new ImageGenerationError(`想定外の画像形式です（${mimeType}）。`)
  return { mimeType, base64: part.inlineData.data }
}

export function extensionFor(mimeType: string): string {
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png'
}
