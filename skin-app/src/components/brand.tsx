import Link from 'next/link';

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-serif text-lg font-semibold tracking-wider text-ink">
      <span aria-hidden className="inline-block h-6 w-6 rounded-full border-[3px] border-gold bg-sage" />
      Skin Note
    </Link>
  );
}

export function LegalFooter() {
  return (
    <footer className="mt-auto border-t border-line px-4 py-6 text-sm text-ink-muted">
      <nav aria-label="規約とポリシー" className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-2">
        <Link href="/legal/terms" className="hover:underline">
          利用規約
        </Link>
        <Link href="/legal/privacy" className="hover:underline">
          プライバシーポリシー
        </Link>
        <Link href="/legal/ai-and-photos" className="hover:underline">
          写真とAIの利用について
        </Link>
      </nav>
      <p className="mx-auto mt-3 max-w-5xl">
        本アプリは美容目的の見た目の記録・カウンセリング補助です。皮膚の病気の診断や治療の判断は行いません。
      </p>
    </footer>
  );
}
