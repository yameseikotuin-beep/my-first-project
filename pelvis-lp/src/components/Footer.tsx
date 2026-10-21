import { lpConfig } from '@/config/lp.config';
import { DevNotice } from './DevNotice';

export function Footer() {
  const { store, service, privacyPolicyUrl } = lpConfig;
  return (
    <footer className="mt-16 bg-navy-900 pt-10 pb-28 text-sm text-navy-100">
      <div className="mx-auto max-w-3xl space-y-3 px-4">
        <p className="font-bold text-white">{store.name || service.name}</p>
        <p>このページのアンケート結果は、選択した内容を整理して表示するもので、医学的な診断ではありません。</p>
        {privacyPolicyUrl ? (
          <p>
            <a href={privacyPolicyUrl} rel="noopener" className="underline underline-offset-4">
              個人情報保護方針
            </a>
          </p>
        ) : (
          <DevNotice>個人情報保護方針の URL（privacyPolicyUrl）が未設定です。公開前に掲載の要否を確認してください。</DevNotice>
        )}
      </div>
    </footer>
  );
}
