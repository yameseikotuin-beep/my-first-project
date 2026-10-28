/** 数字だけの電話番号を、ハイフン区切りで表示する */
export function formatPhone(digits: string): string {
  if (/^0[5789]0\d{8}$/.test(digits)) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (/^0\d{9}$/.test(digits)) return digits.startsWith('03') || digits.startsWith('06')
    ? `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
    : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}
