import { describe, expect, it } from 'vitest';
import { addDays, addMonths, formatDate, formatTimeRange, isDateString, jstDate, jstIso, jstTime, monthGrid, startOfWeek, todayJst } from '@/lib/time';

describe('日本時間の扱い', () => {
  it('UTC の深夜でも日本時間の日付になる', () => {
    expect(todayJst(new Date('2026-11-02T15:30:00Z'))).toBe('2026-11-03'); // 日本時間 0:30
    expect(todayJst(new Date('2026-11-02T14:59:00Z'))).toBe('2026-11-02');
  });
  it('timestamptz を日本時間の日付・時刻で表示する', () => {
    expect(jstDate('2026-11-03T01:00:00+00:00')).toBe('2026-11-03');
    expect(jstTime('2026-11-03T01:00:00+00:00')).toBe('10:00');
    expect(jstTime('2026-11-02T15:00:00Z')).toBe('00:00');
    expect(formatTimeRange('2026-11-03T01:00:00Z', '2026-11-03T02:00:00Z')).toBe('10:00〜11:00');
  });
  it('日本時間の日付・時刻から ISO 文字列を作る', () => {
    expect(jstIso('2026-11-03', '10:00')).toBe('2026-11-03T10:00:00+09:00');
    expect(new Date(jstIso('2026-11-03', '10:00')).toISOString()).toBe('2026-11-03T01:00:00.000Z');
  });
  it('日付の計算', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02'); // 日曜 → その週の月曜
    expect(startOfWeek('2026-11-02')).toBe('2026-11-02');
    expect(formatDate('2026-11-03', true)).toBe('2026年11月3日(火)');
  });
  it('日付の形式を検証する', () => {
    expect(isDateString('2026-11-03')).toBe(true);
    expect(isDateString('2026-02-30')).toBe(false);
    expect(isDateString('2026-1-3')).toBe(false);
    expect(isDateString(undefined)).toBe(false);
  });
  it('月のカレンダーは月曜始まりで、前後は空欄', () => {
    const weeks = monthGrid('2026-11'); // 11/1 は日曜
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});
