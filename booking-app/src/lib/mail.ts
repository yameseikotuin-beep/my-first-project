import 'server-only';

import nodemailer from 'nodemailer';

// メールの送信（Gmail のアプリパスワードで送る）。
// 環境変数が未設定ならメールは送らない（予約などの機能はそのまま動く）。
//   GMAIL_ADDRESS       送信元の Gmail アドレス
//   GMAIL_APP_PASSWORD  Google アカウントで発行した「アプリパスワード」（16文字）。サーバー専用の秘密情報
//   SMTP_HOST / SMTP_PORT  通常は不要（自動テストで別の送信先を使うときだけ指定する）

export type MailMessage = { to: string[]; subject: string; text: string; replyTo?: string; fromName?: string };

function config() {
  const user = process.env.GMAIL_ADDRESS?.trim() ?? '';
  const pass = (process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s/g, '');
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  return { user, pass, host, port };
}

export function isMailConfigured(): boolean {
  const { user, pass } = config();
  return user.length > 0 && pass.length > 0;
}

const SEND_TIMEOUT_MS = 10_000;

/**
 * メールを送る。失敗しても例外を投げず、メールごとに送れたかどうかを返す（予約の確定を妨げないため）。
 * エラーの記録には宛先や本文（個人情報）を含めない。
 */
export async function sendMails(messages: MailMessage[]): Promise<boolean[]> {
  if (!isMailConfigured() || messages.every((m) => m.to.length === 0)) return messages.map(() => false);
  const { user, pass, host, port } = config();
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
  });
  const results = await Promise.allSettled(
    messages.map((m) =>
      m.to.length === 0
        ? Promise.reject(new Error('no recipients'))
        : transport.sendMail({
        from: { name: m.fromName ?? '', address: user },
        to: m.to,
        replyTo: m.replyTo,
        subject: m.subject,
        text: m.text,
      }),
    ),
  );
  transport.close();
  const failed = results.filter(
    (r, i) => r.status === 'rejected' && messages[i].to.length > 0,
  );
  if (failed.length) {
    const reason = (failed[0] as PromiseRejectedResult).reason as { code?: string; responseCode?: number };
    console.error('mail send failed', { count: failed.length, code: reason?.code, responseCode: reason?.responseCode });
  }
  return results.map((r) => r.status === 'fulfilled');
}
