// 画面の自動テスト（E2E）専用：Supabase の API のうち、このアプリが使う部分だけを再現する小さなサーバー。
// 本番では使わない。Docker が使えない環境でも、本物の PostgreSQL（マイグレーション・RLS・関数）に対して
// アプリを動かして確認するためのもの。
//
//   - /rest/v1/<table|view>  … PostgREST の一部（select・絞り込み・並べ替え・件数制限・insert・update・delete）
//   - /rest/v1/rpc/<関数>     … データベース関数の呼び出し
//   - /auth/v1/token, /auth/v1/user, /auth/v1/logout … メールアドレスとパスワードのログイン
//   - /__fault               … 障害の再現（テスト用）
//
// 要求ごとに、JWT の role（anon / authenticated）と claims をデータベースのセッションに設定するため、
// RLS・権限は本物の Supabase と同じように働く。
//
// 環境変数：PGHOST, PGPORT（接続先）, FAKE_SUPABASE_PORT, FAKE_JWT_SECRET, FAKE_USERS（JSON: [{id,email,password}]）

import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54400);
const SECRET = process.env.FAKE_JWT_SECRET ?? 'e2e-only-secret-not-for-production-use';
const USERS = JSON.parse(process.env.FAKE_USERS ?? '[]');

const pool = new pg.Pool({ host: process.env.PGHOST, port: Number(process.env.PGPORT), user: 'postgres', database: 'postgres', max: 20 });

// ---------------------------------------------------------------------
// JWT（HS256）
// ---------------------------------------------------------------------
const b64url = (buf) => Buffer.from(buf).toString('base64url');
export function signJwt(payload) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [head, body, sig] = String(token ?? '').split('.');
  if (!head || !body || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (claims.exp && claims.exp < Date.now() / 1000) return null;
  return claims;
}

const refreshTokens = new Map();
function session(user) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = signJwt({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 });
  const refresh_token = crypto.randomBytes(16).toString('hex');
  refreshTokens.set(refresh_token, user.id);
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token, user: userJson(user) };
}
function userJson(user) {
  return {
    id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email,
    email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {},
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  };
}

// ---------------------------------------------------------------------
// 障害の再現
// ---------------------------------------------------------------------
let fault = 'none'; // none | rpc-error | rpc-reset

// ---------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------
function send(res, status, body, headers = {}) {
  const text = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(text);
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : {};
}
function pgErrorStatus(code, role) {
  if (code === '42501') return role === 'anon' ? 401 : 403;
  if (['23505', '23503', '23P01'].includes(code)) return 409;
  if (code === 'PGRST116') return 406;
  return 400;
}
function sendPgError(res, e, role) {
  send(res, pgErrorStatus(e.code, role), { code: e.code ?? null, message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
}

/** 要求者の権限でトランザクションを実行する */
async function asRole(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await client.query(`set local role ${claims.role === 'authenticated' ? 'authenticated' : 'anon'}`);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

const ident = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw Object.assign(new Error(`bad identifier ${name}`), { code: 'PGRST100' });
  return `"${name}"`;
};

/** PostgREST の絞り込み（col=op.value）を SQL にする */
function buildWhere(params, values) {
  const conds = [];
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.*)$/s.exec(raw);
    if (!m) throw Object.assign(new Error(`unsupported filter ${key}=${raw}`), { code: 'PGRST100' });
    const [, not, op, val] = m;
    const col = ident(key);
    let cond;
    if (op === 'is') {
      cond = `${col} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`;
    } else if (op === 'in') {
      const items = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
      values.push(items);
      cond = `${col}::text = any($${values.length}::text[])`;
    } else {
      const sqlOp = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }[op];
      values.push(op === 'like' || op === 'ilike' ? val.replace(/\*/g, '%') : val);
      cond = `${col} ${sqlOp} $${values.length}`;
    }
    conds.push(not ? `not (${cond})` : cond);
  }
  return conds.length ? ` where ${conds.join(' and ')}` : '';
}

function buildSelect(params) {
  const sel = params.get('select') ?? '*';
  if (sel === '*') return '*';
  return sel.split(',').map((c) => ident(c.trim())).join(', ');
}

function buildOrder(params) {
  const order = params.get('order');
  if (!order) return '';
  return ' order by ' + order.split(',').map((part) => {
    const [col, dir, nulls] = part.split('.');
    return `${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullsfirst' ? ' nulls first' : nulls === 'nullslast' ? ' nulls last' : ''}`;
  }).join(', ');
}

async function handleRest(req, res, url, claims) {
  const path = url.pathname.replace(/^\/rest\/v1\//, '');
  const params = url.searchParams;
  const wantsObject = (req.headers.accept ?? '').includes('application/vnd.pgrst.object+json');
  const prefer = req.headers.prefer ?? '';
  const returnRep = prefer.includes('return=representation');

  if (path.startsWith('rpc/')) {
    if (fault === 'rpc-reset' && path === 'rpc/create_booking') {
      req.socket.destroy();
      return;
    }
    if (fault === 'rpc-error' && path === 'rpc/create_booking') {
      return send(res, 503, { code: 'PGRST000', message: 'Could not connect to the database', details: null, hint: null });
    }
    const fn = path.slice(4);
    const args = req.method === 'GET' ? Object.fromEntries(params) : await readBody(req);
    const result = await asRole(claims, async (client) => {
      const info = await client.query(
        `select p.proretset, t.typname, t.typtype from pg_proc p join pg_type t on t.oid = p.prorettype
         join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1 limit 1`, [fn]);
      if (!info.rows.length) throw Object.assign(new Error(`function ${fn} not found`), { code: 'PGRST202' });
      const names = Object.keys(args);
      const call = `public.${ident(fn)}(${names.map((n, i) => `${ident(n)} => $${i + 1}`).join(', ')})`;
      const values = names.map((n) => args[n]);
      const { proretset, typname } = info.rows[0];
      if (proretset) {
        const r = await client.query(`select coalesce(json_agg(t), '[]'::json) as j from ${call} t`, values);
        return r.rows[0].j;
      }
      if (typname === 'void') {
        await client.query(`select ${call}`, values);
        return null;
      }
      const r = await client.query(`select to_json(${call}) as j`, values);
      return r.rows[0].j;
    });
    if (result === null) return send(res, 204);
    if (wantsObject && Array.isArray(result)) {
      if (result.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null });
      return send(res, 200, result[0]);
    }
    return send(res, 200, result);
  }

  const table = `public.${ident(path)}`;
  const values = [];
  let sql;
  if (req.method === 'GET' || req.method === 'HEAD') {
    const limit = params.get('limit') ? ` limit ${Number(params.get('limit'))}` : '';
    const offset = params.get('offset') ? ` offset ${Number(params.get('offset'))}` : '';
    sql = `select ${buildSelect(params)} from ${table}${buildWhere(params, values)}${buildOrder(params)}${limit}${offset}`;
  } else if (req.method === 'POST') {
    const body = await readBody(req);
    const rows = Array.isArray(body) ? body : [body];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const tuples = rows.map((r) => `(${cols.map((c) => {
      if (!(c in r)) return 'default';
      values.push(r[c]);
      return `$${values.length}`;
    }).join(', ')})`);
    sql = `insert into ${table} (${cols.map(ident).join(', ')}) values ${tuples.join(', ')} returning ${buildSelect(params)}`;
  } else if (req.method === 'PATCH') {
    const body = await readBody(req);
    const sets = Object.entries(body).map(([c, v]) => {
      values.push(v);
      return `${ident(c)} = $${values.length}`;
    });
    sql = `update ${table} set ${sets.join(', ')}${buildWhere(params, values)} returning ${buildSelect(params)}`;
  } else if (req.method === 'DELETE') {
    sql = `delete from ${table}${buildWhere(params, values)} returning ${buildSelect(params)}`;
  } else {
    return send(res, 405, { message: 'method not allowed' });
  }

  const rows = await asRole(claims, async (client) => {
    const r = await client.query(`with t as (${sql}) select coalesce(json_agg(t), '[]'::json) as j from t`, values);
    return r.rows[0].j;
  });
  if (req.method !== 'GET' && !returnRep) return send(res, req.method === 'POST' ? 201 : 204);
  if (wantsObject) {
    if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null });
    return send(res, req.method === 'POST' ? 201 : 200, rows[0]);
  }
  return send(res, req.method === 'POST' ? 201 : 200, rows);
}

async function handleAuth(req, res, url) {
  const path = url.pathname.replace(/^\/auth\/v1\//, '');
  if (path === 'token' && req.method === 'POST') {
    const body = await readBody(req);
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const user = USERS.find((u) => u.email === body.email && u.password === body.password);
      if (!user) return send(res, 400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials', message: 'Invalid login credentials' });
      return send(res, 200, session(user));
    }
    if (grant === 'refresh_token') {
      const id = refreshTokens.get(body.refresh_token);
      const user = USERS.find((u) => u.id === id);
      if (!user) return send(res, 400, { code: 'refresh_token_not_found', error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
      refreshTokens.delete(body.refresh_token);
      return send(res, 200, session(user));
    }
    return send(res, 400, { msg: 'unsupported grant type' });
  }
  const claims = verifyJwt((req.headers.authorization ?? '').replace(/^Bearer /, ''));
  if (path === 'user' && req.method === 'GET') {
    const user = claims?.role === 'authenticated' ? USERS.find((u) => u.id === claims.sub) : null;
    if (!user) return send(res, 401, { code: 'bad_jwt', error_code: 'bad_jwt', msg: 'invalid JWT' });
    return send(res, 200, userJson(user));
  }
  if (path === 'logout' && req.method === 'POST') return send(res, 204);
  return send(res, 404, { msg: 'not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let claims = { role: 'anon' };
  try {
    if (url.pathname === '/__fault') {
      fault = url.searchParams.get('mode') ?? 'none';
      return send(res, 200, { fault });
    }
    if (url.pathname.startsWith('/auth/v1/')) return await handleAuth(req, res, url);
    if (url.pathname.startsWith('/rest/v1/')) {
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, '') || req.headers.apikey;
      const verified = verifyJwt(token);
      if (!verified) return send(res, 401, { code: 'PGRST301', message: 'JWT invalid', details: null, hint: null });
      claims = verified;
      return await handleRest(req, res, url, claims);
    }
    send(res, 404, { message: 'not found' });
  } catch (e) {
    if (process.env.FAKE_SUPABASE_DEBUG) console.error(req.method, req.url, e.code, e.message);
    sendPgError(res, e, claims.role);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`fake supabase listening on http://127.0.0.1:${PORT}`);
});
