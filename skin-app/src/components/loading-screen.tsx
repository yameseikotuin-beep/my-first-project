/** 画面の読み込み中の表示（次の画面の準備ができるまで表示される） */
export function LoadingScreen() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-muted">
      <span
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-[3px] border-sage border-r-transparent motion-reduce:animate-none"
      />
      <span>読み込み中…</span>
    </div>
  );
}
