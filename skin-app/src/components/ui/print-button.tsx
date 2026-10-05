'use client';

import { Button } from './button';

/** ブラウザの印刷画面を開く（「PDF に保存」も選べる） */
export function PrintButton({ label = '印刷・PDF 保存' }: { label?: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
