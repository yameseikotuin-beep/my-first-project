// AIによるレシピ考案（Claude）。APIキーはサーバー側の環境変数（Supabase のシークレット）にだけ置く。
// AIが返すのは料理の構成だけで、栄養計算と条件の検証はアプリ側の計算エンジンが行う。
import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0'
import foodsJson from '../_shared/foods.json' with { type: 'json' }
import { checkRateLimit, corsHeaders, envInt, errorJson, HttpError, json, recordUsage, requireUser } from '../_shared/http.ts'
import {
  AiOutputError, allowedFoods, buildSystemPrompt, buildUserPrompt, responseSchema, validateAiOutput, validateRequest, ValidationError, type FoodEntry,
} from '../_shared/recipeAi.ts'

const FOODS = foodsJson as FoodEntry[]
const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-opus-5-5'
const DAILY_LIMIT = envInt('AI_RECIPE_DAILY_LIMIT', 30)
const SYSTEM = buildSystemPrompt(FOODS)

// ANTHROPIC_API_KEY を環境変数から読む
const anthropic = new Anthropic({ maxRetries: 2, timeout: 120_000 })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorJson(405, 'POST で呼び出してください。')
  try {
    const { user, admin } = await requireUser(req)
    const body = await req.json().catch(() => {
      throw new HttpError(400, 'リクエストがJSONではありません。')
    })
    const input = validateRequest(body, FOODS)
    const allowed = allowedFoods(input, FOODS)
    if (allowed.filter((f) => f.role === 'protein').length === 0 && input.mode === 'calorie') {
      throw new HttpError(422, '避けたい食材・アレルギーの指定により、使えるたんぱく質源がありません。')
    }
    await checkRateLimit(admin, user.id, 'recipe', DAILY_LIMIT)

    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // 安全性フィルターで断られた場合はサーバー側で別モデルに切り替える
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: responseSchema(allowed.map((f) => f.id)) },
      },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildUserPrompt(input, allowed, FOODS) }],
    })

    if (response.stop_reason === 'refusal') {
      throw new HttpError(422, 'この内容ではAIがレシピを作成できませんでした。条件や希望の文章を変えて再試行してください。')
    }
    if (response.stop_reason === 'max_tokens') {
      throw new HttpError(502, 'AIの応答が長すぎて途中で終わりました。レシピの数を減らして再試行してください。')
    }
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new AiOutputError('AIの応答を読み取れませんでした。再試行してください。')
    }
    const { recipes, dropped } = validateAiOutput(parsed, input, allowed)
    await recordUsage(admin, user.id, 'recipe')
    return json({ recipes, dropped, model: response.model })
  } catch (e) {
    return toErrorResponse(e)
  }
})

function toErrorResponse(e: unknown): Response {
  if (e instanceof HttpError || e instanceof ValidationError || e instanceof AiOutputError) return errorJson(e.status, e.message)
  if (e instanceof Anthropic.RateLimitError) return errorJson(429, 'AIサービスが混み合っています。少し待ってから再試行してください。')
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    console.error('Anthropic auth error', e.status)
    return errorJson(500, 'サーバーのAI設定（APIキー）に問題があります。管理者に連絡してください。')
  }
  if (e instanceof Anthropic.APIConnectionError) return errorJson(503, 'AIサービスに接続できませんでした。再試行してください。')
  if (e instanceof Anthropic.APIError) {
    console.error('Anthropic API error', e.status, e.message)
    return errorJson(e.status && e.status >= 500 ? 503 : 502, 'AIサービスでエラーが発生しました。再試行してください。')
  }
  console.error(e)
  return errorJson(500, 'サーバーでエラーが発生しました。')
}
