import { expect, type Page } from '@playwright/test';
import { surveyQuestions } from '../../src/content/survey';
import { themes } from '../../src/content/themes';

export type LpEvent = { name: string; params: Record<string, unknown> };

/**
 * 外部への通信を差し止める。広告スクリプトは空の JS、予約ページはテスト用の HTML を返し、
 * それ以外の外部通信は遮断する。外部へ出ようとした URL を記録して返す。
 */
export async function stubExternal(page: Page): Promise<string[]> {
  const external: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    external.push(url.toString());
    if (url.hostname === 'www.googletagmanager.com' || url.hostname === 'connect.facebook.net') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    }
    if (url.hostname === 'reserve.example.com') {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<h1>テスト用の予約ページ</h1>' });
    }
    return route.abort();
  });
  return external;
}

/** GA4（dataLayer）に送られたイベント */
export async function ga4Events(page: Page): Promise<LpEvent[]> {
  return page.evaluate(() => {
    const layer = ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []) as ArrayLike<unknown>[];
    return layer
      .map((entry) => Array.from(entry))
      .filter((args) => args[0] === 'event')
      .map((args) => ({ name: args[1] as string, params: (args[2] ?? {}) as Record<string, unknown> }));
  });
}

/** Meta Pixel（fbq）に送られた呼び出し（fbevents.js を差し止めているため queue に残る） */
export async function pixelCalls(page: Page): Promise<unknown[][]> {
  return page.evaluate(() => {
    const fbq = (window as unknown as { fbq?: { queue?: ArrayLike<unknown>[] } }).fbq;
    return (fbq?.queue ?? []).map((args) => Array.from(args));
  });
}

export function count(events: LpEvent[], name: string): number {
  return events.filter((e) => e.name === name).length;
}

/** アンケートで使う文字列（選択肢ID・ラベル・テーマID）。広告イベントや URL に含まれてはいけない */
export const sensitiveStrings: string[] = [
  ...surveyQuestions.flatMap((q) => q.options.flatMap((o) => [o.id, o.label])),
  ...Object.keys(themes),
  ...Object.values(themes).map((t) => t.label),
].filter((s) => s.length >= 4);

export function expectNoSensitive(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const s of sensitiveStrings) expect(text, `「${s}」が含まれている`).not.toContain(s);
}

/** 横スクロール（表示崩れ）が出ていないか */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, '横にはみ出している').toBeLessThanOrEqual(client);
}

type Choice = { concern: string[]; scene: string[]; since?: string; wantToKnow?: string; about?: string[] };

/** 画面操作でアンケートに回答して結果画面まで進む */
export async function answerSurvey(page: Page, choice: Choice) {
  await page.goto('/pelvis/');
  await page.getByRole('link', { name: 'セルフチェックを始める' }).click();
  await expect(page).toHaveURL(/\/pelvis\/check\/$/);
  const steps: string[][] = [
    choice.concern,
    choice.scene,
    [choice.since ?? '最近（1か月以内）'],
    [choice.wantToKnow ?? '骨盤と姿勢の関係'],
    choice.about ?? [],
  ];
  for (const [i, labels] of steps.entries()) {
    await expect(page.getByTestId('progress-text')).toHaveText(`質問 ${i + 1} / ${steps.length}`);
    for (const label of labels) await page.getByText(label, { exact: true }).click();
    await page.getByRole('button', { name: i === steps.length - 1 ? '結果を見る' : '次へ' }).click();
  }
  await expect(page).toHaveURL(/\/pelvis\/result\/$/);
}

/** 画面操作を省いて回答済みの状態にする（表示確認用） */
export async function seedAnswers(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      'pelvis-lp:survey:v1',
      JSON.stringify({
        answers: { concern: ['nekoze'], scene: ['deskRound'], since: ['recent'], wantToKnow: ['pelvisBasics'] },
        step: 4,
        completed: true,
      }),
    );
  });
}
