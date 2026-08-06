export interface SampleUploadFile {
  id: string;
  name: string;
  region: string;
  size: string;
}

export const SAMPLE_UPLOAD_FILES: SampleUploadFile[] = [
  { id: 'file-1', name: '서부동_그냥드림_2026년8월.xlsx', region: '서부권역', size: '128KB' },
  { id: 'file-2', name: '동탄2동_지원현황_2026년8월.xlsx', region: '동탄권역', size: '156KB' },
  { id: 'file-3', name: '남양읍_재고현황_2026년8월.xlsx', region: '남부권역', size: '94KB' },
];

export interface ColumnMapping {
  source: string;
  target: string;
}

export const COLUMN_MAPPINGS: ColumnMapping[] = [
  { source: '읍면동', target: '지역' },
  { source: '이용자명', target: '이용자' },
  { source: '지원일자', target: '지원일' },
  { source: '품목명', target: '지원 물품' },
  { source: '지급수량', target: '수량' },
];

export type ValidationFindingType = '누락' | '중복' | '오류';

export interface ValidationFinding {
  id: string;
  type: ValidationFindingType;
  message: string;
}

export const VALIDATION_FINDINGS: ValidationFinding[] = [
  { id: 'vf-1', type: '중복', message: '동일 이용자·지원일 데이터 3건이 중복 등록되어 있습니다.' },
  { id: 'vf-2', type: '누락', message: '지원일자가 비어있는 행이 2건 있습니다.' },
  { id: 'vf-3', type: '오류', message: '읍면동 값이 지역 목록과 일치하지 않는 행이 1건 있습니다. (반월동 → 서부권역 자동 매핑)' },
];
