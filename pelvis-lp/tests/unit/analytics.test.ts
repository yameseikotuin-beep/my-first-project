import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetAnalyticsForTest,
  trackOnce,
  trackReserveClick,
  trackReserveComplete,
  validGa4Id,
  validMetaPixelId,
} from '@/lib/analytics';

describe('analytics', () => {
  const gtag = vi.fn();
  const fbq = vi.fn();

  beforeEach(() => {
    resetAnalyticsForTest();
    window.sessionStorage.clear();
    gtag.mockClear();
    fbq.mockClear();
    window.gtag = gtag;
    window.fbq = fbq;
  });
  afterEach(() => {
    delete window.gtag;
    delete window.fbq;
  });

  it('表示系イベントは何度呼んでも 1 回だけ送る', () => {
    trackOnce('article_view');
    trackOnce('article_view');
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'article_view', {});
    expect(fbq).toHaveBeenCalledWith('trackCustom', 'ArticleView', {});
  });

  it('予約クリックは設置場所だけを送り、連打は 1 回にまとめる', () => {
    trackReserveClick('service', 1000);
    trackReserveClick('service', 1500);
    trackReserveClick('article_end', 1600);
    trackReserveClick('service', 3000);
    expect(gtag.mock.calls).toEqual([
      ['event', 'reserve_click', { placement: 'service' }],
      ['event', 'reserve_click', { placement: 'article_end' }],
      ['event', 'reserve_click', { placement: 'service' }],
    ]);
    expect(fbq).toHaveBeenCalledWith('trackCustom', 'ReserveClick', { placement: 'service' });
  });

  it('予約クリックは予約完了として送らない', () => {
    trackReserveClick('service');
    const names = gtag.mock.calls.map((c) => c[1]);
    expect(names).not.toContain('reserve_complete');
    expect(fbq.mock.calls.map((c) => c[1])).not.toContain('Schedule');
  });

  it('予約完了はタブ内で 1 回だけ送る（再読み込みしても二重計上しない）', () => {
    trackReserveComplete();
    resetAnalyticsForTest(); // ページ再読み込み相当
    trackReserveComplete();
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledWith('track', 'Schedule', {});
  });

  it('gtag / fbq が無い（ID 未設定）ときは何もしない', () => {
    delete window.gtag;
    delete window.fbq;
    expect(() => trackOnce('lp_view')).not.toThrow();
  });

  it('ID の形式を確認する', () => {
    expect(validGa4Id(' G-ABC123XYZ ')).toBe('G-ABC123XYZ');
    expect(validGa4Id("G-1');alert(1)//")).toBeNull();
    expect(validGa4Id('')).toBeNull();
    expect(validMetaPixelId('123456789012345')).toBe('123456789012345');
    expect(validMetaPixelId('12ab')).toBeNull();
  });
});
