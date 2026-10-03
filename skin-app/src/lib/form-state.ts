/** Server Action からフォームに返す結果 */
export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};

/** FormData から文字列の値だけを取り出す（パスワードは含めない） */
export function formValues(formData: FormData, keys: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of keys) {
    const v = formData.get(key);
    if (typeof v === 'string') values[key] = v;
  }
  return values;
}
