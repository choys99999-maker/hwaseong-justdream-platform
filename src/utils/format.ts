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
