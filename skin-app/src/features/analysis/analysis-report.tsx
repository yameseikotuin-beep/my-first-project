import { Card, PageTitle } from '@/components/ui/card';
import { ConfirmSubmit } from '@/components/ui/confirm-submit';
import { LinkButton } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import type { AnalysisDetail } from '@/lib/analyses';
import {
  angleLabels,
  confidenceLabel,
  gradeLabels,
  metricLabels,
  regionLabels,
} from '@/lib/analysis/labels';
import { METRICS, REGIONS, type Metric, type Region } from '@/lib/analysis/types';
import type { AnalysisItemRow } from '@/lib/supabase/database.types';
import { deleteAnalysis } from './actions';

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Tokyo' });

const aiNotices: Record<string, { tone: 'info' | 'warning'; text: string }> = {
  not_requested: { tone: 'info', text: 'AI には送信していません。説明文は AI を使わない仮のものです。' },
  no_consent: { tone: 'warning', text: 'AI への送信の同意がないため、AI の説明文は作成していません。' },
  not_configured: { tone: 'warning', text: 'AI に接続されていないため、AI の説明文は作成していません。' },
  limit: { tone: 'warning', text: '本日の AI 利用回数の上限に達したため、AI の説明文は作成していません。' },
  error: { tone: 'warning', text: 'AI の説明文を作成できませんでした。時間をおいて、もう一度分析してください。' },
};

/** 部位ごとに、いちばん目立つ項目の評価 */
function regionSummary(items: AnalysisItemRow[], region: Region) {
  const graded = items.filter((i) => i.region === region && i.determinable && i.grade !== null);
  if (graded.length === 0) return null;
  return graded.reduce((a, b) => ((b.grade ?? 0) > (a.grade ?? 0) ? b : a));
}

// 顔の図の上の各部位の位置（viewBox 0 0 200 252）
const regionPositions: Record<Region, { x: number; y: number }> = {
  forehead: { x: 100, y: 42 },
  under_eye: { x: 100, y: 96 },
  cheek_right: { x: 50, y: 138 }, // 図の左側＝本人から見て右の頬（正面の写真の見え方に合わせる）
  cheek_left: { x: 150, y: 138 },
  nose: { x: 100, y: 156 },
  chin: { x: 100, y: 212 },
};

const gradeFill = ['#f3eee3', '#e6eee8', '#cfe0d4', '#e9dcbc', '#d9c08c', '#c9a65f'];

function FaceMap({ items }: { items: AnalysisItemRow[] }) {
  return (
    <figure className="mx-auto w-full max-w-xs">
      <svg viewBox="0 0 200 252" role="img" aria-labelledby="face-map-title" className="w-full">
        <title id="face-map-title">部位ごとのいちばん目立つ項目の評価</title>
        <ellipse cx="100" cy="128" rx="80" ry="112" fill="#fffdf8" stroke="#c9b07a" strokeWidth="2" />
        {REGIONS.map((region) => {
          const top = regionSummary(items, region);
          const pos = regionPositions[region];
          return (
            <g key={region}>
              <circle cx={pos.x} cy={pos.y} r="17" fill={gradeFill[top?.grade ?? 0]} stroke="#8a7240" strokeWidth="1" />
              <text x={pos.x} y={pos.y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#2e2b26">
                {top?.grade ?? '－'}
              </text>
              <text x={pos.x} y={pos.y + 29} textAnchor="middle" fontSize="10" fill="#645e54">
                {regionLabels[region]}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-center text-sm text-ink-muted">
        数字は部位ごとのいちばん目立つ項目の評価（1〜5）。「－」は判定できなかった部位です。図は正面から見た向きです。
      </figcaption>
    </figure>
  );
}

function ItemTable({ items, metric }: { items: AnalysisItemRow[]; metric: Metric }) {
  const rows = REGIONS.map((region) => items.find((i) => i.metric === metric && i.region === region)).filter(
    (r): r is AnalysisItemRow => Boolean(r),
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-[0.95rem]">
        <caption className="sr-only">{metricLabels[metric]}の部位ごとの評価</caption>
        <thead className="text-sm text-ink-muted">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">部位</th>
            <th scope="col" className="py-2 pr-3 font-medium">評価（1〜5）</th>
            <th scope="col" className="py-2 font-medium">確信度</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.region}>
              <td className="py-2 pr-3">{regionLabels[r.region as Region]}</td>
              <td className="py-2 pr-3">
                {r.determinable && r.grade ? (
                  <>
                    <span className="font-medium">{r.grade}</span>
                    <span className="ml-2 text-ink-muted">{gradeLabels[r.grade as 1 | 2 | 3 | 4 | 5]}</span>
                  </>
                ) : (
                  <span className="text-ink-muted">判定できず{r.reason ? `（${r.reason}）` : ''}</span>
                )}
              </td>
              <td className="py-2">
                {confidenceLabel(Number(r.confidence))}
                <span className="ml-1 text-sm text-ink-muted">（{Number(r.confidence).toFixed(2)}）</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnalysisReport({
  detail,
  aiNotice,
  againHref,
  customerId,
  canDelete,
  subjectLabel,
}: {
  detail: AnalysisDetail;
  aiNotice?: string;
  againHref: string;
  customerId?: string;
  canDelete: boolean;
  subjectLabel?: string;
}) {
  const { analysis, items, description, session } = detail;
  const notes = Array.isArray(description?.item_notes)
    ? (description.item_notes as { metric?: string; note?: string }[])
    : [];
  const notice = aiNotice && aiNotice !== 'retake' ? aiNotices[aiNotice] : undefined;

  return (
    <div className="space-y-6">
      <PageTitle lead={subjectLabel}>肌の見た目の分析結果</PageTitle>

      {/* 常に表示する注意書き（AI の出力とは別に、アプリが必ず表示する） */}
      <div className="space-y-2">
        <Notice tone="info" title="画像上の見た目の推定です。診断ではありません">
          照明・角度・メイク・カメラの性能などによって、見え方や評価は変わります。肌年齢・水分量・油分量などは、写真からは判定しません。
        </Notice>
        {!analysis.analyzer_validated ? (
          <Notice tone="warning" title="モック（未検証）の評価です">
            項目ごとの評価の数字は、検証されていない仮の値です。画像を解析した結果ではなく、肌の状態を表すものではありません。
          </Notice>
        ) : null}
        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      </div>

      <p className="text-sm text-ink-muted">
        分析日時：{dateFormat.format(new Date(analysis.created_at))}
        {session ? `　撮影日時：${dateFormat.format(new Date(session.created_at))}` : ''}
        　説明文：
        {description?.provider === 'anthropic' ? `AI（${description.model ?? 'Claude'}）が作成` : 'AI を使わない仮の文章'}
      </p>

      {analysis.status === 'retake_required' ? (
        <Card className="space-y-3">
          <h2 className="font-serif text-lg font-semibold">撮り直しが必要です</h2>
          <p>{analysis.retake_reason}</p>
          <LinkButton href={againHref}>撮り直す</LinkButton>
        </Card>
      ) : null}

      {session && session.photos.length > 0 ? (
        <Card>
          <h2 className="font-serif text-lg font-semibold">撮影条件</h2>
          <ul className="mt-3 grid grid-cols-3 gap-3">
            {session.photos.map((p) => (
              <li key={p.id}>
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 短時間で失効する署名付き URL のため
                  <img src={p.url} alt={`${angleLabels[p.angle]}の写真`} className="aspect-[3/4] w-full rounded-xl object-cover" />
                ) : null}
                <p className={`mt-1 text-sm ${p.quality_passed ? 'text-sage-strong' : 'text-warning'}`}>
                  {angleLabels[p.angle]}：{p.quality_passed ? '○ 条件OK' : '△ 条件外'}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {analysis.status === 'completed' ? (
        <>
          <Card className="grid gap-6 md:grid-cols-[18rem_1fr] md:items-start">
            <FaceMap items={items} />
            <div className="space-y-3">
              <h2 className="font-serif text-lg font-semibold">見た目の特徴の説明</h2>
              {description ? <p className="whitespace-pre-wrap">{description.summary}</p> : null}
              {notes.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5">
                  {notes.map((n, i) => (
                    <li key={i}>{n.note}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-6">
            <h2 className="font-serif text-lg font-semibold">項目別の評価（モック）</h2>
            {METRICS.map((metric) => (
              <section key={metric}>
                <h3 className="font-medium">{metricLabels[metric]}</h3>
                <ItemTable items={items} metric={metric} />
              </section>
            ))}
          </Card>

          {description?.cautions ? (
            <Card>
              <h2 className="font-serif text-lg font-semibold">注意事項</h2>
              <p className="mt-2 whitespace-pre-wrap">{description.cautions}</p>
            </Card>
          ) : null}

          {description?.self_care_info ? (
            <Card>
              <h2 className="font-serif text-lg font-semibold">セルフケアの一般情報</h2>
              <p className="mt-2 whitespace-pre-wrap">{description.self_care_info}</p>
              <p className="mt-2 text-sm text-ink-muted">一般的な情報です。肌に合わないと感じたら使用を控えてください。</p>
            </Card>
          ) : null}
        </>
      ) : null}

      <Notice tone={description?.suggest_medical_consult ? 'warning' : 'info'} title="医療機関への相談の目安">
        {description?.suggest_medical_consult
          ? '写真の見え方から、医療機関（皮膚科など）への相談をおすすめします。'
          : ''}
        強い赤み・かゆみ・痛み、急な変化、形や色が不規則なほくろのような部分など、気になる症状がある場合は、この結果にかかわらず医療機関（皮膚科など）にご相談ください。
      </Notice>

      <p className="text-sm text-ink-muted">前回との比較と、印刷（PDF）は今後のアップデートで追加されます。</p>

      <div className="flex flex-wrap gap-3">
        <LinkButton href={againHref} variant="secondary">
          もう一度撮影する
        </LinkButton>
        {canDelete ? (
          <form action={deleteAnalysis}>
            <input type="hidden" name="analysisId" value={analysis.id} />
            {customerId ? <input type="hidden" name="customerId" value={customerId} /> : null}
            <ConfirmSubmit confirmMessage="この分析結果を削除します（写真は削除されません）。元に戻せません。よろしいですか？">
              この分析結果を削除
            </ConfirmSubmit>
          </form>
        ) : null}
      </div>
    </div>
  );
}
