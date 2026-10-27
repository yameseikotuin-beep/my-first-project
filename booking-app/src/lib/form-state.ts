/** サーバー処理からフォームに返す結果 */
export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

/** データベースの一般的なエラーを管理者向けの文にする（内部の詳細は出さない） */
export function dbErrorState(error: { code?: string; message?: string } | null | undefined): FormState {
  switch (error?.code) {
    case '23503':
      return { message: 'この項目は予約などで使われているため削除できません。「利用停止」にしてください。' };
    case '23505':
      return { message: '同じ内容がすでに登録されています。' };
    case '23514':
    case '22007':
    case '22008':
    case '22P02':
      return { message: '入力内容を確認してください。' };
    case '42501':
      return { message: 'この操作を行う権限がありません。' };
    default:
      return { message: '保存できませんでした。時間をおいてもう一度お試しください。' };
  }
}
