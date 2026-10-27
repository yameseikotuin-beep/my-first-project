// 日付・時刻の扱い。日本時間（Asia/Tokyo、UTC+9・夏時間なし）に固定する。
// サーバー（Vercel は UTC）でも端末でも同じ結果になるよう、必ずこの関数を通す。

export const TIME_ZONE = 'Asia/Tokyo';
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;
export const WEEKDAY_LABELS = WEEKDAYS;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** YYYY-MM-DD として正しい日付か */
export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** HH:MM として正しい時刻か */
export function isTimeString(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

function parts(date: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
}

/** 日本時間の今日（YYYY-MM-DD） */
export function todayJst(now: Date = new Date()): string {
  const p = parts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** timestamptz（ISO 文字列）→ 日本時間の日付 YYYY-MM-DD */
export function jstDate(iso: string): string {
  return todayJst(new Date(iso));
}

/** timestamptz（ISO 文字列）→ 日本時間の時刻 HH:MM */
export function jstTime(iso: string): string {
  const p = parts(new Date(iso));
  return `${p.hour}:${p.minute}`;
}

/** 日本時間の日付と時刻 → ISO 文字列（+09:00 付き） */
export function jstIso(date: string, time: string): string {
  return `${date}T${time}:00+09:00`;
}

/** 日付に日数を足す（YYYY-MM-DD） */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 曜日（0=日曜 … 6=土曜） */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** その週の月曜日 */
export function startOfWeek(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** 「11月3日(月)」 */
export function formatDate(date: string, withYear = false): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${withYear ? `${y}年` : ''}${m}月${d}日(${WEEKDAYS[weekdayOf(date)]})`;
}

/** 「11月3日(月) 10:00」 */
export function formatDateTime(iso: string, withYear = false): string {
  return `${formatDate(jstDate(iso), withYear)} ${jstTime(iso)}`;
}

/** 「10:00〜11:00」 */
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${jstTime(startIso)}〜${jstTime(endIso)}`;
}

/** DB の time 型（"09:00:00"）→ "09:00" */
export function shortTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '';
}

/** "YYYY-MM" の月のカレンダー（月曜始まり、前後の月の日は null） */
export function monthGrid(month: string): (string | null)[][] {
  const first = `${month}-01`;
  const lead = (weekdayOf(first) + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "YYYY-MM" に月数を足す */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** 金額「4,400円」 */
export function formatPrice(yen: number): string {
  return `${yen.toLocaleString('ja-JP')}円`;
}
