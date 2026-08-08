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

export interface SheetParseResult {
  sheetName: string;
  sheetType: SheetType;
  columns: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
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

export interface SheetConvertResult {
  sheetName: string;
  records: MappedRecord[];
  errors: ValidationError[];
}
