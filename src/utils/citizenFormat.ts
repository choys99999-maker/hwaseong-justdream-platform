/** 오늘 날짜(YYYY-MM-DD)를 현지 시간 기준으로. `toISOString()` 은 UTC 라 한국에서 오전에 하루가 밀린다. */
export function todayLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 시민 화면 전용 갱신 시각 표시. "재고 데이터 갱신" 같은 용어 대신 "오늘 18:42 확인" 식으로 쓴다. */
export function formatCheckedAt(isoDateTime: string): string {
  const [datePart, timePart] = isoDateTime.split('T');
  if (!timePart) return `${datePart} 확인`;
  const time = timePart.slice(0, 5);
  if (datePart === todayLocal()) return `오늘 ${time} 확인`;
  const [, month, day] = datePart.split('-');
  return `${month}.${day} ${time} 확인`;
}
