/** 시민 화면 전용 갱신 시각 표시. "재고 데이터 갱신" 같은 용어 대신 "오늘 18:42 확인" 식으로 쓴다. */
export function formatCheckedAt(isoDateTime: string): string {
  const [datePart, timePart] = isoDateTime.split('T');
  if (!timePart) return `${datePart} 확인`;
  const time = timePart.slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);
  if (datePart === today) return `오늘 ${time} 확인`;
  const [, month, day] = datePart.split('-');
  return `${month}.${day} ${time} 확인`;
}
