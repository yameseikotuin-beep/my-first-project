import { describe, expect, it } from 'vitest';
import { getReservationTarget } from '@/lib/reservation';

describe('getReservationTarget', () => {
  it('空なら未設定', () => {
    expect(getReservationTarget('')).toEqual({ status: 'unset' });
    expect(getReservationTarget('   ')).toEqual({ status: 'unset' });
  });
  it('https の URL は使う', () => {
    expect(getReservationTarget('https://example.com/reserve')).toEqual({ status: 'ok', url: 'https://example.com/reserve' });
  });
  it.each(['http://example.com', 'javascript:alert(1)', 'example.com/reserve', '/pelvis/reserve/'])('%s は使わない', (raw) => {
    expect(getReservationTarget(raw).status).toBe('invalid');
  });
});
