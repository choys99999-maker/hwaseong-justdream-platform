/**
 * 플랫폼이 실제로 사용하는 항목들.
 *
 * 대시보드·지역별 현황·재고 화면은 업로드된 엑셀의 열 이름을 이 규칙으로 찾아 쓴다.
 * 자동으로 찾지 못한 필수 항목만 업로드 화면에서 사용자에게 물어본다.
 */
export interface PlatformField {
  id: string;
  /** 사용자에게 보여줄 이름. */
  label: string;
  /** 엑셀 열 이름을 자동으로 찾을 때 쓰는 규칙. */
  pattern: RegExp;
  /**
   * 이 항목이 없으면 가져오기 자체를 막을지 여부.
   *
   * 현재는 모두 false다. 지역별 현황·품목 현황 화면은 해당 열이 없을 때
   * 각자 안내 화면을 이미 갖고 있고, 대시보드도 이용자 열이 없으면
   * 전체 건수로 대신 계산한다. 즉 어떤 항목이 없어도 시스템은 동작한다.
   * 업무상 반드시 받아야 하는 항목이 정해지면 그때 true로 바꾼다.
   */
  required: boolean;
  /** 어떤 값인지 알려주는 짧은 설명. */
  example: string;
}

export const PLATFORM_FIELDS: PlatformField[] = [
  {
    id: 'region',
    label: '지역',
    pattern: /읍면동|지역|권역/,
    required: false,
    example: '동탄1동, 남양읍처럼 읍면동 이름이 들어간 항목',
  },
  {
    id: 'name',
    label: '이용자',
    pattern: /이용자|수혜자|이름|성명/,
    required: false,
    example: '이용자 이름이 들어간 항목',
  },
  {
    id: 'date',
    label: '지원일',
    pattern: /지원일|날짜/,
    required: false,
    example: '2026-08-01처럼 지원한 날짜',
  },
  {
    id: 'item',
    label: '지원품목',
    pattern: /지원품목|품목|물품/,
    required: false,
    example: '쌀, 라면처럼 지원한 물품 이름',
  },
  {
    id: 'quantity',
    label: '수량',
    pattern: /수량/,
    required: false,
    example: '지원한 개수',
  },
];

export type FieldId = (typeof PLATFORM_FIELDS)[number]['id'];

/** 엑셀 열 이름 목록에서 각 항목에 해당하는 열을 자동으로 찾는다. */
export function autoMatchFields(columns: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const field of PLATFORM_FIELDS) {
    result[field.id] = columns.find((c) => field.pattern.test(c)) ?? null;
  }
  return result;
}
