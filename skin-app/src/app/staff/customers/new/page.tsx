import type { Metadata } from 'next';
import { Card, PageTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { CustomerForm } from '@/features/customers/customer-form';
import { createCustomer } from '@/features/customers/actions';

export const metadata: Metadata = { title: '顧客の登録' };

export default async function NewCustomerPage() {
  const user = await requireRole(['staff', 'admin']);
  return (
    <div className="max-w-3xl">
      <PageTitle
        lead={
          user.profile.role === 'staff'
            ? '登録したお客さまは、あなたの担当として自動で割り当てられます。必要最小限の情報だけを入力してください。'
            : '必要最小限の情報だけを入力してください。担当スタッフは「担当の割当」から設定します。'
        }
      >
        顧客の登録
      </PageTitle>
      <Card>
        <CustomerForm action={createCustomer} submitLabel="登録する" />
      </Card>
    </div>
  );
}
