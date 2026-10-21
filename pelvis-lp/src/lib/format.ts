export function formatYen(value: number): string {
  return `${value.toLocaleString('ja-JP')}円`;
}
