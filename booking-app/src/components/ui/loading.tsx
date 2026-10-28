/** 次の画面の準備ができるまでの表示（画面を切り替えたときにすぐ出る） */
export function Loading({ label = '読み込み中…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-muted">
      <span
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-r-transparent motion-reduce:animate-none"
      />
      <span>{label}</span>
    </div>
  );
}
