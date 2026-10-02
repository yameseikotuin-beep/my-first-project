// 料理写真風の画像生成（Google Gemini の画像生成）。APIキーはサーバー側の環境変数にだけ置く。
// 生成した画像は非公開の Storage バケットに「ユーザーID/レシピID」で保存し、パスを返す。
import { decodeBase64 } from 'jsr:@std/encoding@1/base64'
import { checkRateLimit, corsHeaders, envInt, errorJson, HttpError, json, recordUsage, requireUser } from '../_shared/http.ts'
import { buildImagePrompt, extensionFor, extractImage, ImageGenerationError, ImageRequestError, validateImageRequest } from '../_shared/imageGen.ts'

const MODEL = Deno.env.get('GEMINI_IMAGE_MODEL') ?? 'gemini-3.1-flash-image'
const DAILY_LIMIT = envInt('AI_IMAGE_DAILY_LIMIT', 20)
const BUCKET = 'recipe-images'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorJson(405, 'POST で呼び出してください。')
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new HttpError(500, 'サーバーの画像生成の設定（APIキー）がありません。管理者に連絡してください。')
    const { user, admin } = await requireUser(req)
    const body = await req.json().catch(() => {
      throw new HttpError(400, 'リクエストがJSONではありません。')
    })
    const input = validateImageRequest(body)
    await checkRateLimit(admin, user.id, 'image', DAILY_LIMIT)

    let res: Response
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildImagePrompt(input) }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '4:3' } },
        }),
        signal: AbortSignal.timeout(90_000),
      })
    } catch {
      throw new HttpError(503, '画像生成サービスに接続できませんでした。再試行してください。')
    }
    if (res.status === 429) throw new HttpError(429, '画像生成サービスが混み合っています。少し待ってから再試行してください。')
    if (res.status === 401 || res.status === 403) {
      console.error('Gemini auth error', res.status)
      throw new HttpError(500, 'サーバーの画像生成の設定（APIキー）に問題があります。管理者に連絡してください。')
    }
    if (!res.ok) {
      console.error('Gemini error', res.status, await res.text().catch(() => ''))
      throw new HttpError(502, '画像生成サービスでエラーが発生しました。再試行してください。')
    }
    const image = extractImage(await res.json())
    const path = `${user.id}/${input.recipeId}.${extensionFor(image.mimeType)}`
    const { error } = await admin.storage.from(BUCKET).upload(path, decodeBase64(image.base64), { contentType: image.mimeType, upsert: true })
    if (error) {
      console.error('storage upload error', error.message)
      throw new HttpError(500, '画像を保存できませんでした。')
    }
    await recordUsage(admin, user.id, 'image')
    return json({ path, model: MODEL })
  } catch (e) {
    if (e instanceof HttpError || e instanceof ImageRequestError || e instanceof ImageGenerationError) return errorJson(e.status, e.message)
    console.error(e)
    return errorJson(500, 'サーバーでエラーが発生しました。')
  }
})
