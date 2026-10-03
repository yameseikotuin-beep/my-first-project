import type { ConsentKind, ConsentRow } from '@/lib/supabase/database.types';
import { consentKinds, consentLabels } from '@/lib/consent';
import { ConfirmSubmit } from '@/components/ui/confirm-submit';
import { revokeConsent } from './actions';

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' });

/** 同意の状況の一覧と撤回ボタン */
export function ConsentStatus({
  active,
  customerId,
}: {
  active: Partial<Record<ConsentKind, ConsentRow>>;
  customerId?: string;
}) {
  return (
    <ul className="divide-y divide-line">
      {consentKinds.map((kind) => {
        const row = active[kind];
        return (
          <li key={kind} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium">{consentLabels[kind]}</p>
              <p className={`text-sm ${row ? 'text-sage-strong' : 'text-ink-muted'}`}>
                {row
                  ? `✓ 同意済み（${dateFormat.format(new Date(row.granted_at))}・${row.method === 'salon_tablet' ? 'サロンで取得' : 'アプリで同意'}）`
                  : '－ 同意していません'}
              </p>
            </div>
            {row ? (
              <form action={revokeConsent}>
                <input type="hidden" name="consentId" value={row.id} />
                {customerId ? <input type="hidden" name="customerId" value={customerId} /> : null}
                <ConfirmSubmit
                  variant="secondary"
                  confirmMessage={`「${consentLabels[kind]}」の同意を撤回します。撤回後は新しい${kind === 'ai_processing' ? 'AIへの送信' : '撮影・保存'}ができなくなります。保存済みの写真は削除されないため、必要に応じて別途削除してください。よろしいですか？`}
                >
                  撤回する
                </ConfirmSubmit>
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
