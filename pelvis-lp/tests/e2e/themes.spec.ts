import { expect, test } from '@playwright/test';
import { answerSurvey, stubExternal } from './helpers';

// 主要な回答パターンごとに結果テーマと記事の導入が切り替わること
const patterns = [
  { concern: ['反り腰が気になる'], scene: ['立っているとき、腰が反っている気がする'], theme: 'pelvicTilt', label: '反り腰・骨盤の傾きに関する関心' },
  { concern: ['猫背が気になる'], scene: ['デスクワークやスマホで背中が丸くなる'], theme: 'posture', label: '猫背・姿勢に関する関心' },
  { concern: ['姿勢の左右差（肩や腰の高さ）が気になる'], scene: ['鏡や写真で体の傾きが気になる'], theme: 'asymmetry', label: '姿勢の左右差に関する関心' },
  { concern: ['下腹部の見た目が気になる'], scene: ['横から見たときの体型が気になる'], theme: 'bodyShape', label: '体型の見え方に関する関心' },
  { concern: ['腰まわりの違和感が気になる'], scene: ['長く座った後、腰まわりが気になる'], theme: 'waist', label: '腰まわりの違和感に関する関心' },
  { concern: ['その他・うまく言葉にできない'], scene: ['特に思い当たらない'], theme: 'general', label: '骨盤・姿勢全般に関する関心' },
  // 複数回答：同点（猫背 2+1、左右差 2）→ 合計の高い猫背
  { concern: ['猫背が気になる', '姿勢の左右差（肩や腰の高さ）が気になる'], scene: ['デスクワークやスマホで背中が丸くなる'], theme: 'posture', label: '猫背・姿勢に関する関心' },
  // 複数回答：完全な同点 → 優先順位（反り腰 > 腰まわり）
  { concern: ['腰まわりの違和感が気になる', '反り腰が気になる'], scene: ['特に思い当たらない'], theme: 'pelvicTilt', label: '反り腰・骨盤の傾きに関する関心' },
];

for (const p of patterns) {
  test(`${p.concern.join('＋')} → ${p.label}`, async ({ page }) => {
    await stubExternal(page);
    await answerSurvey(page, p);
    await expect(page.getByTestId('main-theme')).toHaveText(p.label);
    await page.getByRole('link', { name: '記事を読む' }).click();
    await expect(page.getByTestId('article-intro')).toHaveAttribute('data-theme', p.theme);
  });
}
