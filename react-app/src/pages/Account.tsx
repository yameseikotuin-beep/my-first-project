import { useState } from 'react'
import { cloudConfigured } from '../cloud/supabase'
import { signIn, signOut, signUp, useAuth } from '../cloud/auth'
import { syncNow, useSyncStatus } from '../sync/engine'
import { Field } from '../ui/common'
import { formatDate } from '../ui/helpers'

export function Account() {
  const auth = useAuth()
  const sync = useSyncStatus()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  if (!cloudConfigured) {
    return (
      <div>
        <h1>アカウント・同期</h1>
        <div className="banner info">
          <b>クラウド機能は設定されていません</b>
          <p className="small" style={{ marginTop: 6 }}>
            このアプリは端末内だけで動作しています。複数の端末でのデータ同期、AIによるレシピ考案、料理画像の生成を使うには、
            Supabase の設定（環境変数 <code>VITE_SUPABASE_URL</code> と <code>VITE_SUPABASE_ANON_KEY</code>）が必要です。
            手順は <code>react-app/README.md</code> の「クラウド機能のセットアップ」を参照してください。
          </p>
        </div>
      </div>
    )
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const passOk = password.length >= 8

  async function submit() {
    if (!emailOk || !passOk) return
    setBusy(true)
    setMessage(null)
    if (mode === 'signin') {
      const err = await signIn(email, password)
      if (err) setMessage({ kind: 'error', text: err })
    } else {
      const r = await signUp(email, password)
      if (r.error) setMessage({ kind: 'error', text: r.error })
      else if (r.needsConfirm) setMessage({ kind: 'info', text: '確認メールを送信しました。メールのリンクを開いてから、ログインしてください。' })
    }
    setBusy(false)
  }

  if (!auth.ready) return <p className="muted">読み込み中…</p>

  if (auth.session) {
    return (
      <div>
        <h1>アカウント・同期</h1>
        <div className="card">
          <div className="small muted">ログイン中</div>
          <div><b>{auth.session.user.email}</b></div>
          <div style={{ marginTop: 12 }}>
            <SyncBadge />
            <div className="small muted" style={{ marginTop: 4 }}>
              {sync.lastSyncedAt ? `最終同期: ${formatDate(sync.lastSyncedAt)}` : 'まだ同期していません'}
              {sync.pending > 0 && ` ・ 未送信 ${sync.pending}件`}
            </div>
            {sync.error && <div className="banner error small" style={{ marginTop: 8 }}>{sync.error}</div>}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={sync.state === 'syncing'} onClick={() => void syncNow()}>今すぐ同期</button>
            <button className="btn" onClick={() => { if (confirm('ログアウトしますか？この端末のデータは残ります。')) void signOut() }}>ログアウト</button>
          </div>
        </div>
        <div className="card small">
          <h2>同期について</h2>
          <ul>
            <li>レシピ・お気に入り・履歴・利用者・栄養設定・食事プラン・買い物リスト・在庫・登録した食材が、同じアカウントでログインした端末どうしで同期されます。</li>
            <li>同じデータを複数の端末で編集した場合は、後から編集した内容が残ります。</li>
            <li>オフライン中の変更は端末に保存され、接続が戻ると自動で送信されます。</li>
            <li>データはあなたのアカウントだけが読み書きできるように保護されています（Supabase の行レベルセキュリティ）。</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1>アカウント・同期</h1>
      <p className="small muted">ログインすると、複数の端末でデータを同期でき、AIによるレシピ考案と料理画像の生成が使えます。ログインしなくても、この端末内ですべての基本機能を使えます。</p>
      <div className="card">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')}>ログイン</button>
          <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>新規登録</button>
        </div>
        <Field label="メールアドレス" error={email && !emailOk ? 'メールアドレスの形式が正しくありません' : null}>
          <input type="text" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="パスワード（8文字以上）" error={password && !passOk ? '8文字以上で入力してください' : null}>
          <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit() }} />
        </Field>
        {message && <div className={`banner ${message.kind === 'error' ? 'error' : 'info'} small`}>{message.text}</div>}
        <button className="btn primary block" disabled={busy || !emailOk || !passOk} onClick={() => void submit()}>
          {busy ? '処理中…' : mode === 'signin' ? 'ログイン' : '登録する'}
        </button>
        {mode === 'signup' && <p className="tiny muted" style={{ marginTop: 8 }}>登録すると、この端末に保存されているデータもアカウントに送信され、ほかの端末と同期されます。</p>}
      </div>
    </div>
  )
}

export function SyncBadge() {
  const s = useSyncStatus()
  const auth = useAuth()
  if (!cloudConfigured || !auth.session) return null
  const label = s.state === 'syncing' ? '同期中…' : s.state === 'error' ? '同期エラー' : s.pending > 0 ? `未送信 ${s.pending}件` : '同期済み'
  const cls = s.state === 'error' ? 'failed' : s.state === 'syncing' || s.pending > 0 ? 'partial' : 'ok'
  return <span className={`badge ${cls}`} title={label} role="status" aria-label={`同期: ${label}`}>{label}</span>
}
