import type { ReactNode } from 'react';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const tones: Record<Tone, string> = {
  info: 'border-line bg-surface-muted text-ink',
  warning: 'border-warning/40 bg-warning-soft text-warning',
  danger: 'border-danger/40 bg-danger-soft text-danger',
  success: 'border-sage/40 bg-sage-soft text-sage-strong',
};

const icons: Record<Tone, string> = { info: 'ℹ︎', warning: '⚠︎', danger: '⚠︎', success: '✓' };

/** 注意書き・エラー・完了の表示。色だけでなく記号と文で伝える */
export function Notice({
  tone = 'info',
  title,
  children,
  live = false,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  live?: boolean;
}) {
  return (
    <div
      role={live ? (tone === 'danger' ? 'alert' : 'status') : undefined}
      className={`flex gap-3 rounded-xl border px-4 py-3 text-[0.95rem] ${tones[tone]}`}
    >
      <span aria-hidden className="mt-0.5 font-bold">
        {icons[tone]}
      </span>
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
      </div>
    </div>
  );
}
