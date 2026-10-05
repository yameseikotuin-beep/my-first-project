import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: '利用規約' };

export default function TermsPage() {
  return (
    <LegalPage title="利用規約">
      <section>
        <h2>1. 本サービスの内容</h2>
        <p>
          本サービスは、美容を目的として、顔写真の画像上の見た目の特徴を記録・表示し、セルフケアやサロンでのカウンセリングを補助するものです。
        </p>
      </section>
      <section>
        <h2>2. 医療行為ではないこと</h2>
        <ul>
          <li>本サービスは皮膚の病気の診断、治療の判断、医学的な助言を行いません。</li>
          <li>肌年齢・水分量・油分量などの数値を写真から判定することはありません。</li>
          <li>表示される評価は撮影条件の影響を受ける推定であり、正確さを保証するものではありません。</li>
          <li>気になる症状がある場合は、医療機関にご相談ください。</li>
        </ul>
      </section>
      <section>
        <h2>3. 利用条件</h2>
        <ul>
          <li>18歳以上の方がご利用いただけます。</li>
          <li>ご本人以外の顔写真を、その方の同意なく撮影・登録しないでください。</li>
        </ul>
      </section>
      <section>
        <h2>4. 退会とデータの削除</h2>
        <p>写真は「写真」画面から、アカウントとすべてのデータは設定画面の「退会」から、いつでも削除できます。</p>
      </section>
      <section>
        <h2>5. 運営者</h2>
        <p>【運営者名・所在地・連絡先を記入】</p>
      </section>
    </LegalPage>
  );
}
