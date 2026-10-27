import { ActionForm, FormSubmit } from '@/components/ui/action-form';
import { CheckboxField, TextAreaField, TextField } from '@/components/ui/field';
import { saveService } from './settings-actions';
import type { RoomRow, ServiceRow } from '@/lib/supabase/database.types';

export function ServiceForm({ service, rooms, roomIds }: { service?: ServiceRow; rooms: RoomRow[]; roomIds: string[] }) {
  return (
    <ActionForm action={saveService} className="space-y-4 rounded-xl border border-line bg-surface p-4">
      {service ? <input type="hidden" name="id" value={service.id} /> : null}
      <TextField label="メニュー名" name="name" required maxLength={60} defaultValue={service?.name} />
      <TextAreaField label="説明" name="description" maxLength={500} defaultValue={service?.description} hint="予約画面に表示されます。" />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="施術時間（分）" name="durationMinutes" type="number" inputMode="numeric" min={5} max={480} step={5} required defaultValue={service?.duration_minutes ?? 60} />
        <TextField label="料金（円・税込）" name="price" type="number" inputMode="numeric" min={0} required defaultValue={service?.price ?? 0} />
        <TextField label="表示順" name="sortOrder" type="number" inputMode="numeric" defaultValue={service?.sort_order ?? 0} hint="小さいほど上に表示" />
      </div>
      <CheckboxField label="WEB予約を受け付ける" name="isActive" defaultChecked={service?.is_active ?? true} hint="オフにすると予約画面に表示されません（管理画面からは登録できます）。" />
      <fieldset>
        <legend className="text-sm font-medium">使用できる施術スペース</legend>
        <p className="mb-2 text-sm text-ink-muted">何も選ばない場合は、すべてのスペースで施術できます。</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {rooms.map((r) => (
            <CheckboxField key={r.id} label={`${r.name}${r.is_active ? '' : '（利用停止中）'}`} name="roomIds" value={r.id} defaultChecked={roomIds.includes(r.id)} />
          ))}
        </div>
      </fieldset>
      <FormSubmit>保存する</FormSubmit>
    </ActionForm>
  );
}
