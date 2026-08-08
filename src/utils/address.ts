// 한국 주소에서 읍·면·동 추출
// 예: "경기도 화성시 봉담읍 봉담로 12 행복아파트 101동" → "봉담읍"
//     "경기도 화성시 동탄1동 xyz" → "동탄1동"
export function extractEupMyeonDong(address: string): string | null {
  if (!address?.trim()) return null;
  const parts = address.trim().split(/\s+/);
  for (const part of parts) {
    // 한글 2글자 이상 + 선택적 숫자 + 읍|면|동 으로 끝나는 토큰
    // "봉담읍", "동탄1동", "팔탄면" 등 매칭
    // "101동" 같은 건물 동 번호는 앞에 한글이 없으므로 미매칭
    if (/^[가-힣]{2,}\d*(?:읍|면|동)$/.test(part)) {
      return part;
    }
  }
  return null;
}
