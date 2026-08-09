export type PlatformColumnKey =
  // 주별/누계 실적 보고
  | 'institution'
  | 'userCount'
  | 'basicConsultation'
  | 'referralTotal'
  | 'linkageCompleted'
  | 'basicLivelihood'
  | 'nearPoverty'
  | 'emergencyWelfare'
  | 'otherLinkage'
  | 'underReview'
  | 'noLinkageNeeded'
  // 2차 의뢰 연계
  | 'serialNo'
  | 'visitType'
  | 'clientName'
  | 'birthDate'
  | 'address'
  | 'consultDate'
  | 'referralTarget'
  | 'consultationDone'
  | 'linkageType'
  | 'serviceDetails'
  // 일반 물품 배분
  | 'region'
  | 'organization'
  | 'itemName'
  | 'inboundQuantity'
  | 'outboundQuantity'
  | 'stock'
  | 'inboundDate'
  | 'expirationDate';

export type SheetType = 'performance' | 'referral' | 'generic';

export interface PlatformColumnDef {
  key: PlatformColumnKey;
  label: string;
  required: boolean;
  aliases: string[];
}

// ── v2 해석 엔진 ──────────────────────────────────────────

/**
 * 시트의 역할.
 *  data    실제 업무 자료
 *  guide   안내·설명·표지 시트 (읽을 내용이 없다)
 *  unknown 표를 찾긴 했지만 어떤 자료인지 판정하지 못함 → 사용자 확인 필요
 */
export type SheetRole = 'data' | 'guide' | 'unknown';

/**
 * 열 하나의 인식 상태.
 *  auto        확신을 갖고 자동 연결했다
 *  suggested   비슷해 보여 제안했다 — 사용자 확인 필요
 *  unmapped    무슨 열인지 모른다 — 사용자 확인 필요
 *  ignored     저장 대상이 아니라고 미리 정해둔 열 (사유를 함께 보여준다)
 *  duplicate   같은 표준 항목에 이미 다른 열이 연결되어 있다 — 사용자 확인 필요
 */
export type ColumnStatus = 'auto' | 'suggested' | 'unmapped' | 'ignored' | 'duplicate';

export interface ColumnDiagnosis {
  /** 시트 안에서의 0-based 열 번호 */
  index: number;
  /** 엑셀 열 문자 (A, B, ...) */
  letter: string;
  /** 미리보기·매핑의 키로 쓰는 이름. 같은 이름이 겹치면 뒤에 번호가 붙는다. */
  name: string;
  /** 엑셀에 적힌 그대로의 이름 */
  rawName: string;
  mapped: PlatformColumnKey | null;
  /** 0~1. 자동 확정 여부를 가르는 값. */
  confidence: number;
  status: ColumnStatus;
  /** 왜 이렇게 판단했는지. 화면에 그대로 보여준다. */
  reason: string;
}

/** 데이터 행이 아니라고 판단한 행. 조용히 버리지 않고 전부 여기에 남긴다. */
export type SkippedRowKind = 'aggregate' | 'note' | 'uncertain';

export interface SkippedRow {
  /** 1-based 엑셀 행 번호 */
  rowNumber: number;
  kind: SkippedRowKind;
  message: string;
  /** 그 행에 무엇이 적혀 있었는지 (앞부분만) */
  preview: string;
}

export interface SheetParseResult {
  sheetName: string;
  sheetType: SheetType;
  role: SheetRole;
  /** 누계 시트는 집계에서 제외된다. (주별 실적과 이중 계산 방지) */
  isCumulative: boolean;
  /** 주별 자료로 보이는 시트인지. 누계와 함께 왔을 때 안내에 쓴다. */
  isWeekly: boolean;
  columns: string[];
  previewRows: Record<string, string>[];
  totalRows: number;

  /** 1-based 헤더 시작 행 / 헤더가 차지한 행 수 / 데이터 시작 행 */
  headerRow: number;
  headerRowCount: number;
  dataStartRow: number;
  /** 헤더 위에 있던 제목·설명 줄 */
  titleLines: string[];
  /** 제목 줄이나 병합 셀에서 찾아낸 읍면동. 지역 열이 없을 때 채움값 후보로 쓴다. */
  detectedRegion: string | null;

  columnDiagnostics: ColumnDiagnosis[];
  /** 시트 유형 판정 확신도 (0~1). 낮으면 사용자에게 확인을 받는다. */
  typeConfidence: number;
  /** 사용자에게 알려야 할 안내 문구. */
  notes: string[];
}

/** 미리보기 전용. 원본 셀 값을 가공하지 않고 그대로 넘긴다. */
export type RawCell = string | number | boolean;

/** 미리보기 화면이 요청한 만큼만 잘라 받은 원본 행. */
export interface SheetRowsPage {
  sheetName: string;
  columns: string[];
  rows: RawCell[][];
  /** 각 행의 실제 엑셀 행 번호 */
  rowNumbers: number[];
  start: number;
  /** 빈 줄을 뺀 전체 행 수 */
  totalRows: number;
}

export interface MappedRecord {
  [key: string]: string | number | undefined;
}

export interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
  cellAddress?: string;
}

/**
 * 파일이 스스로 적어둔 합계와, 우리가 읽은 값의 합을 맞춰본 결과.
 *
 * 정답 파일을 따로 두지 않고도 "제대로 읽었는가"를 파일 자신에게 물어보는 장치다.
 * 어긋나면 어딘가를 잘못 읽었거나 행을 빠뜨렸다는 뜻이므로 사용자에게 알린다.
 */
export interface TotalsCheck {
  field: string;
  /** 파일의 합계 행에 적힌 값 */
  declared: number;
  /** 우리가 읽은 레코드들의 합 */
  computed: number;
  matches: boolean;
  /** 합계 행의 엑셀 행 번호 */
  rowNumber: number;
}

export interface SheetConvertResult {
  sheetName: string;
  sheetType: SheetType;
  records: MappedRecord[];
  errors: ValidationError[];
  /** 각 record 가 원본 엑셀 몇 행에서 나왔는지. 화면에서 되짚을 때 쓴다. */
  sourceRowNumbers: number[];
  /** 데이터 행이 아니라고 보고 뺀 행들. 사용자에게 전부 보여준다. */
  skippedRows: SkippedRow[];
  /** 완전히 빈 줄 (알릴 필요 없는 정상 스킵) */
  emptyRowCount: number;
  /** 지역 열이 없어 시트 정보로 채운 값. 채웠다는 사실을 반드시 보여준다. */
  filledRegion: string | null;
  /** 파일의 합계 행과 대조한 결과. 합계 행이 없으면 빈 배열이다. */
  totalsChecks: TotalsCheck[];
}
