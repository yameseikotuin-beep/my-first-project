import { Notice } from '@/components/ui/notice';

/** 問診で「通院中の皮膚の病気がある」と答えた場合の案内 */
export function DoctorNotice() {
  return (
    <Notice tone="warning" title="施術の前に、医師への確認をおすすめしてください">
      問診で、皮膚科などに通院・治療中と回答されています。施術を受けてよいか、かかりつけの医師に確認していただくようご案内してください。このアプリは医療的な判断をしません。
    </Notice>
  );
}
