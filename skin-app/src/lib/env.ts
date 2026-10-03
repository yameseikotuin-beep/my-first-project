// Supabase の接続先（サーバー側で読む）。
// URL と公開用キーはブラウザに渡してよい値だが、Vercel の画面で `NEXT_PUBLIC_` 付きの名前を
// 保存できない場合があるため、付かない名前でも読めるようにしている。
// ブラウザ側へは、サーバーの画面から受け取って渡す（ビルド時に埋め込まない）。

export type SupabaseConfig = { url: string; anonKey: string };

function first(...values: (string | undefined)[]): string {
  return values.find((v) => v && v.trim().length > 0)?.trim() ?? '';
}

export function getSupabaseConfig(): SupabaseConfig {
  return {
    url: first(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: first(
      process.env.SUPABASE_ANON_KEY,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

export function isSupabaseConfigured(config: SupabaseConfig = getSupabaseConfig()): boolean {
  return /^https?:\/\//.test(config.url) && config.anonKey.length > 0;
}
