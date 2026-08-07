/**
 * 지도 라벨용 기관명 축약 규칙.
 *
 * 정식 기관명(`name`)은 상세 패널·표·업로드 매칭에서 그대로 쓰고,
 * 지도 라벨에는 축약형(`displayName`)만 노출한다. 이름을 숨기지 않고
 * 길이만 줄이는 것이 목적이라 지역명·기관 성격은 남긴다.
 *
 * 규칙
 * 1. 앞머리 광역 접두어(화성특례시/화성시)를 제거한다.
 *    화성시동탄치동천종합사회복지관 → 동탄치동천종합사회복지관
 *    화성시서부종합사회복지관       → 서부종합사회복지관
 * 2. `지역사회보장협의체` 는 `협의체` 로 줄이고 앞에 공백을 넣어 2줄 줄바꿈 지점을 만든다.
 *    우정읍지역사회보장협의체 → 우정읍 협의체
 *    향남읍지역사회보장협의체 → 향남읍 협의체
 * 3. `행정복지센터` 앞에 공백을 넣는다. (표기는 유지하고 줄바꿈 지점만 확보)
 *    우정읍행정복지센터 → 우정읍 행정복지센터
 * 4. 규칙으로 처리되지 않는 예외는 시드에서 `displayName` 을 직접 지정해 덮어쓴다.
 *
 * `종합사회복지관`·`푸드뱅크`·`푸드마켓` 등 기관 성격 표기는 줄이지 않는다.
 * 임의 축약보다 라벨 최대 2줄 + 배치 오프셋으로 겹침을 먼저 해결한다.
 */

/** 제거 대상 광역 접두어. 긴 것부터 검사한다. */
const CITY_PREFIXES = ['화성특례시', '화성시'];

/** 접두어를 떼고 남는 이름이 이 길이 미만이면 원본을 유지한다. */
const MIN_REMAINDER = 3;

/** [찾을 문자열, 바꿀 문자열] 순서대로 1회씩 적용한다. */
const REPLACEMENTS: [string, string][] = [
  ['지역사회보장협의체', ' 협의체'],
  ['행정복지센터', ' 행정복지센터'],
];

export function toSiteDisplayName(name: string): string {
  let result = name.trim();

  for (const prefix of CITY_PREFIXES) {
    if (result.startsWith(prefix) && result.length - prefix.length >= MIN_REMAINDER) {
      result = result.slice(prefix.length);
      break;
    }
  }

  for (const [from, to] of REPLACEMENTS) {
    result = result.replace(from, to);
  }

  return result.replace(/\s+/g, ' ').trim();
}
