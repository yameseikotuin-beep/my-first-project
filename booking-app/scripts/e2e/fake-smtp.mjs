// 画面の自動テスト（E2E）専用：受け取ったメールをファイルに保存するだけの SMTP サーバー。本番では使わない。
// 環境変数：FAKE_SMTP_PORT（既定 2525）、FAKE_SMTP_DIR（保存先）
// 保存先に "reject" というファイルがあると、すべての送信を拒否する（送信失敗の再現用）。
import fs from 'node:fs';
import path from 'node:path';
import { SMTPServer } from 'smtp-server';

const PORT = Number(process.env.FAKE_SMTP_PORT ?? 2525);
const DIR = process.env.FAKE_SMTP_DIR;
fs.mkdirSync(DIR, { recursive: true });
let seq = 0;

const server = new SMTPServer({
  disabledCommands: ['STARTTLS'],
  allowInsecureAuth: true,
  onAuth(auth, _session, callback) {
    callback(null, { user: auth.username });
  },
  onRcptTo(_address, _session, callback) {
    if (fs.existsSync(path.join(DIR, 'reject'))) return callback(new Error('rejected for test'));
    callback();
  },
  onData(stream, session, callback) {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => {
      const file = path.join(DIR, `${Date.now()}-${++seq}.json`);
      fs.writeFileSync(file, JSON.stringify({
        to: session.envelope.rcptTo.map((r) => r.address),
        raw: Buffer.concat(chunks).toString('utf8'),
      }));
      callback();
    });
  },
});
server.listen(PORT, '127.0.0.1', () => console.log(`fake smtp listening on ${PORT}`));
