import { isDevelopment } from '@/lib/reservation';

/** 未設定の項目を開発環境（npm run dev）でだけ知らせる。本番ページには何も表示しない */
export function DevNotice({ children }: { children: React.ReactNode }) {
  if (!isDevelopment) return null;
  return (
    <p
      data-testid="dev-notice"
      className="my-3 rounded-md border-2 border-dashed border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      【開発環境のみ表示】{children}
    </p>
  );
}
