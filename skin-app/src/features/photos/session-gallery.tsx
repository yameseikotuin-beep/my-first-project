import type { SessionWithPhotos } from '@/lib/photos';
import { ConfirmSubmit } from '@/components/ui/confirm-submit';
import { deletePhoto, deleteSession } from './actions';

const angleLabels = { front: '正面', left: '左側', right: '右側' } as const;
const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' });

type QualityJson = { passed?: boolean; issues?: string[]; brightness?: number; faceCheckAvailable?: boolean; source?: string };

export function SessionGallery({
  sessions,
  customerId,
  canDeleteSession,
  canDeletePhoto = true,
}: {
  sessions: SessionWithPhotos[];
  customerId?: string;
  canDeleteSession: boolean;
  canDeletePhoto?: boolean;
}) {
  if (sessions.length === 0) {
    return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-muted">まだ写真がありません。</p>;
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">
        写真を表示するためのリンクは約1分で無効になります。表示されない場合はページを再読み込みしてください。
      </p>
      {sessions.map((session) => (
        <section key={session.id} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-medium">{dateFormat.format(new Date(session.created_at))} の撮影</h3>
            {canDeleteSession ? (
              <form action={deleteSession}>
                <input type="hidden" name="sessionId" value={session.id} />
                {customerId ? <input type="hidden" name="customerId" value={customerId} /> : null}
                <ConfirmSubmit confirmMessage="この撮影の写真をすべて削除します。元に戻せません。よろしいですか？">
                  この撮影をすべて削除
                </ConfirmSubmit>
              </form>
            ) : null}
          </div>
          {session.photos.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">写真がありません（保存が途中で止まった可能性があります）。</p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {session.photos.map((photo) => {
                const q = (photo.quality ?? {}) as QualityJson;
                return (
                  <li key={photo.id} className="space-y-2">
                    {photo.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- 署名付き URL は短時間で失効するため最適化しない
                      <img
                        src={photo.url}
                        alt={`${angleLabels[photo.angle]}の写真`}
                        className="aspect-[3/4] w-full rounded-xl bg-surface-muted object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-surface-muted text-sm text-ink-muted">
                        表示できません
                      </div>
                    )}
                    <p className="text-sm">
                      {angleLabels[photo.angle]}
                      <span className={`ml-2 ${photo.quality_passed ? 'text-sage-strong' : 'text-warning'}`}>
                        {photo.quality_passed ? '○ 撮影条件OK' : '△ 条件外'}
                      </span>
                    </p>
                    {q.faceCheckAvailable === false ? (
                      <p className="text-xs text-ink-muted">顔の向き・距離は自動確認していません</p>
                    ) : null}
                    {canDeletePhoto ? (
                      <form action={deletePhoto}>
                        <input type="hidden" name="photoId" value={photo.id} />
                        {customerId ? <input type="hidden" name="customerId" value={customerId} /> : null}
                        <ConfirmSubmit confirmMessage="この写真を削除します。元に戻せません。よろしいですか？" className="w-full">
                          削除
                        </ConfirmSubmit>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
