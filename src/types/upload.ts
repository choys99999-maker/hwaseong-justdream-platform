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

export interface MappedRecord {
  [key: string]: string | number | undefined;
}

export interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

export interface SheetConvertResult {
  sheetName: string;
  records: MappedRecord[];
  errors: ValidationError[];
}
