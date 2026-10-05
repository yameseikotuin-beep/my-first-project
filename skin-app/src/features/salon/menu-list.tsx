import Link from 'next/link';
import type { TreatmentMenuRow } from '@/lib/supabase/database.types';

const yen = new Intl.NumberFormat('ja-JP');

/** メニューの一覧。hrefFor があれば各行が編集画面へのリンクになる */
export function MenuList({ menus, hrefFor }: { menus: TreatmentMenuRow[]; hrefFor?: (id: string) => string }) {
  if (menus.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-muted">
        まだメニューがありません。{hrefFor ? '「メニューを追加する」から登録してください。' : '管理者が登録すると表示されます。'}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {menus.map((m) => {
        const body = (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                {m.name}
                {m.category ? <span className="ml-2 text-sm font-normal text-ink-muted">{m.category}</span> : null}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-sm">
                {!m.is_active ? <span className="rounded-full bg-surface-muted px-3 py-1">休止中</span> : null}
                <span className="font-medium">{yen.format(m.price_yen)}円</span>
                {m.duration_min ? <span className="text-ink-muted">約{m.duration_min}分</span> : null}
              </span>
            </div>
            {m.description ? <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{m.description}</p> : null}
            {m.cautions ? <p className="mt-1 text-sm text-warning">注意：{m.cautions}</p> : null}
          </>
        );
        return (
          <li key={m.id}>
            {hrefFor ? (
              <Link href={hrefFor(m.id)} className="block px-4 py-3 hover:bg-surface-muted active:bg-sage-soft">
                {body}
              </Link>
            ) : (
              <div className="px-4 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
