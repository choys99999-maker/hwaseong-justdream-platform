export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('T')[0].split('-');
  return `${year}.${month}.${day}`;
}

export function formatDateTime(isoDateTime: string): string {
  const [datePart, timePart] = isoDateTime.split('T');
  const [year, month, day] = datePart.split('-');
  const time = timePart ? timePart.slice(0, 5) : '';
  return `${year}.${month}.${day} ${time}`.trim();
}

export function formatNumber(value: number): string {
  return value.toLocaleString('ko-KR');
}

/**
 * 재고 표시. 값을 알 수 없으면(계산 근거 없음) 0 이 아니라 '—' 로 둔다.
 * 0 은 "실제로 소진됨", '—' 는 "모름"이라 뜻이 다르다.
 */
export function formatStock(value: number | null): string {
  return value === null ? '—' : formatNumber(value);
}
