import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({
  lpConfig: { reservationUrl: '', service: { name: '骨盤起こし整体', firstPriceYen: 1980, duration: '' } },
}));
vi.mock('@/config/lp.config', () => config);

import { ReserveButton } from '@/components/ReserveButton';
import { resetAnalyticsForTest } from '@/lib/analytics';

afterEach(() => {
  cleanup();
  resetAnalyticsForTest();
  delete window.gtag;
});

describe('ReserveButton', () => {
  it('予約URLが未設定ならリンクにせず、開発環境では未設定と表示する', () => {
    config.lpConfig.reservationUrl = '';
    render(<ReserveButton placement="service" />);
    expect(screen.queryByRole('link', { name: /予約する/ })).toBeNull();
    expect(document.querySelector('a')).toBeNull();
    expect(screen.getByTestId('reserve-unavailable').textContent).toContain('準備中');
    expect(screen.getByTestId('dev-notice').textContent).toContain('予約URLが未設定です');
  });

  it('不正な予約URLは使わない', () => {
    config.lpConfig.reservationUrl = 'javascript:alert(1)';
    render(<ReserveButton placement="service" />);
    expect(document.querySelector('a')).toBeNull();
    expect(screen.getByTestId('dev-notice').textContent).toContain('正しい URL ではない');
  });

  it('設定済みなら予約ページへのリンクになり、クリックを計測する', () => {
    config.lpConfig.reservationUrl = 'https://reserve.example.com/shop';
    const gtag = vi.fn();
    window.gtag = gtag;
    render(<ReserveButton placement="article_end" />);
    const link = screen.getByRole('link', { name: /初回1,980円（税込）で予約する/ });
    expect(link.getAttribute('href')).toBe('https://reserve.example.com/shop');
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link);
    expect(gtag).toHaveBeenCalledWith('event', 'reserve_click', { placement: 'article_end' });
  });
});
