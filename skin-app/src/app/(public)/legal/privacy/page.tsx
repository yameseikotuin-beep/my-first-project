import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'プライバシーポリシー' };

export default function PrivacyPage() {
  return (
    <LegalPage title="プライバシーポリシー">
      <section>
        <h2>1. 取得する情報</h2>
        <ul>
          <li>アカウント情報：メールアドレス、表示名、18歳以上であることの確認日時</li>
          <li>顔写真と撮影条件（明るさ・ブレ・顔の向き・距離の値、端末の種類〔スマホ／タブレット／PC〕）</li>
          <li>同意の記録（どの文面に、いつ同意・撤回したか）</li>
          <li>サロンをご利用の場合：氏名、ふりがな、連絡先、生まれ年（任意）、メモ</li>
          <li>操作の記録（監査ログ）：誰が、いつ、どの記録を操作したか</li>
        </ul>
        <p>写真の位置情報（EXIF）はお使いの端末で取り除いてから送信するため、保存しません。</p>
      </section>
      <section>
        <h2>2. 利用目的</h2>
        <ul>
          <li>肌の見た目の記録・比較の表示、サロンでのカウンセリングの補助</li>
          <li>不正利用の防止と、安全な運用のための記録</li>
        </ul>
      </section>
      <section>
        <h2>3. 保存先と第三者への提供</h2>
        <ul>
          <li>データは Supabase（クラウドサービス）に保存します。【保存地域を記入】</li>
          <li>AIによる説明文の作成では、同意をいただいた場合に限り、縮小した顔写真を Anthropic 社の Claude API に送信します。</li>
        </ul>
      </section>
      <section>
        <h2>4. 削除</h2>
        <p>写真はいつでも削除できます。削除したデータも、バックアップに一定期間残る場合があります。【期間を記入】</p>
      </section>
      <section>
        <h2>5. お問い合わせ</h2>
        <p>【窓口を記入】</p>
      </section>
    </LegalPage>
  );
}
