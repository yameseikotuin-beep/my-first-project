import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: '写真とAIの利用について' };

export default function AiAndPhotosPage() {
  return (
    <LegalPage title="写真とAIの利用について">
      <section>
        <h2>撮影</h2>
        <p>
          撮影中の顔の検出・明るさや向きの確認は、お使いの端末の中だけで行います。この段階で写真が外部に送られることはありません。
        </p>
      </section>
      <section>
        <h2>保存</h2>
        <p>
          保存した写真は非公開の場所に置かれ、ご本人（サロンでは担当スタッフと管理者）だけが見られます。写真を表示するためのリンクは約1分で無効になります。
        </p>
      </section>
      <section>
        <h2>AIへの送信（今後追加予定）</h2>
        <ul>
          <li>送信先：Anthropic 社（Claude API）</li>
          <li>送信するもの：縮小した顔写真。氏名や連絡先は送りません。</li>
          <li>目的：画像上の見た目の特徴を文章で説明するため</li>
          <li>送信の直前に毎回確認し、同意いただいた場合だけ送信します。</li>
          <li>送信先でのデータの取り扱い：【導入時に送信先の最新の規約・方針を確認して記入】</li>
        </ul>
      </section>
      <section>
        <h2>AIの評価の限界</h2>
        <p>
          評価は写真の見え方にもとづく推定で、照明・角度・メイク・カメラの性能などによって変わります。診断ではありません。測定機器による実測値とは区別して表示します。
        </p>
      </section>
    </LegalPage>
  );
}
