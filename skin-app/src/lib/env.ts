// 端末にも渡る公開用の設定値。未設定のときは「未接続」として画面に案内を出す。
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
};

export function isSupabaseConfigured(): boolean {
  return publicEnv.supabaseUrl.startsWith('https://') || publicEnv.supabaseUrl.startsWith('http://')
    ? publicEnv.supabaseAnonKey.length > 0
    : false;
}
