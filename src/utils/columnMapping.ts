import type { PlatformColumnDef, PlatformColumnKey, SheetType } from '../types/upload';

export const PERFORMANCE_COLUMNS: PlatformColumnDef[] = [
  { key: 'institution', label: '구분 (기관명)', required: true, aliases: ['구분', '기관명', '기관'] },
  { key: 'userCount', label: '이용자', required: false, aliases: ['이용자 수'] },
  { key: 'basicConsultation', label: '기본 상담 (2차 이용)', required: false, aliases: ['기본 상담', '(2차 이용)', '2차 이용'] },
  { key: 'referralTotal', label: '상담 연계 의뢰 (D)', required: false, aliases: ['상담 연계', '의뢰', '(D)', '상담 연계 '] },
  { key: 'linkageCompleted', label: '연계완료 계(A)', required: false, aliases: ['연계완료', '계(A)', '계'] },
  { key: 'basicLivelihood', label: '기초생활', required: false, aliases: ['기초 생활'] },
  { key: 'nearPoverty', label: '차상위', required: false, aliases: [] },
  { key: 'emergencyWelfare', label: '긴급복지', required: false, aliases: ['긴급 복지'] },
  { key: 'otherLinkage', label: '기타', required: false, aliases: [] },
  { key: 'underReview', label: '검토중 (B)', required: false, aliases: ['검토중', '(B)', '검토중 (B)', '검토중\n(B)'] },
  { key: 'noLinkageNeeded', label: '연계불요 (C)', required: false, aliases: ['연계불요', '(C)'] },
];

export const REFERRAL_COLUMNS: PlatformColumnDef[] = [
  { key: 'serialNo', label: '연번', required: false, aliases: [] },
  { key: 'institution', label: '기관명', required: false, aliases: [] },
  { key: 'visitType', label: '방문구분', required: false, aliases: ['방문 구분'] },
  { key: 'clientName', label: '대상자 이름', required: true, aliases: ['이름', '성명', '대상자', '대상자이름'] },
  { key: 'birthDate', label: '생년월일', required: false, aliases: ['생년 월일'] },
  { key: 'address', label: '주소', required: false, aliases: [] },
  { key: 'consultDate', label: '상담(방문)일자', required: false, aliases: ['방문일자', '상담일', '상담(방문)일자', '상담 일자', '방문 일자'] },
  { key: 'referralTarget', label: '2차 연계처(읍면동)', required: false, aliases: ['연계처', '읍면동', '2차 연계처(읍면동)', '2차 연계처'] },
  { key: 'consultationDone', label: '연계 상담 실시 여부', required: false, aliases: ['실시 여부', '연계 상담 실시 여부', '연계 상담'] },
  { key: 'linkageType', label: '연계완료', required: false, aliases: ['연계 완료'] },
  { key: 'serviceDetails', label: '기타 내역', required: false, aliases: ['기타내역', '기타 내역'] },
  { key: 'underReview', label: '검토중', required: false, aliases: [] },
  { key: 'noLinkageNeeded', label: '연계불요', required: false, aliases: [] },
];

export const GENERIC_COLUMNS: PlatformColumnDef[] = [
  { key: 'region', label: '지역', required: false, aliases: [] },
  { key: 'organization', label: '기관명', required: false, aliases: [] },
  { key: 'itemName', label: '품목명', required: true, aliases: ['품목', '물품명', '상품명'] },
  { key: 'inboundQuantity', label: '입고수량', required: false, aliases: ['입고량'] },
  { key: 'outboundQuantity', label: '출고수량', required: false, aliases: ['출고량'] },
  { key: 'stock', label: '현재재고', required: false, aliases: ['재고', '재고량', '현재고', '잔량'] },
  { key: 'inboundDate', label: '입고일', required: false, aliases: [] },
  { key: 'expirationDate', label: '유통기한', required: false, aliases: ['소비기한', '유효기간', '기한'] },
];

// 하위 호환
export const PLATFORM_COLUMNS = GENERIC_COLUMNS;

export function detectSheetType(sheetName: string): SheetType {
  const n = sheetName.trim();
  if (n.includes('주별 실적') || n.includes('실적 보고') || n.includes('누계')) return 'performance';
  if (n.includes('의뢰') || n.includes('연계') || n.includes('대상자')) return 'referral';
  return 'generic';
}

/**
 * 누계 시트인지. 주별 실적과 누계 실적을 함께 더하면 같은 값을 두 번 세게 되므로
 * 집계에서 빼려면 이 판정이 필요하다. (DB의 create_submission도 같은 규칙을 갖고 있다)
 */
export function isCumulativeSheet(sheetName: string): boolean {
  return sheetName.includes('누계');
}

export function getColumnsForType(type: SheetType): PlatformColumnDef[] {
  if (type === 'performance') return PERFORMANCE_COLUMNS;
  if (type === 'referral') return REFERRAL_COLUMNS;
  return GENERIC_COLUMNS;
}

export function autoMapColumns(
  excelColumns: string[],
  type: SheetType = 'generic',
): Record<string, PlatformColumnKey | null> {
  const defs = getColumnsForType(type);
  const mapping: Record<string, PlatformColumnKey | null> = {};
  const usedTargets = new Set<PlatformColumnKey>();

  for (const col of excelColumns) {
    const normalized = col.trim().replace(/\n/g, ' ');
    let matched: PlatformColumnKey | null = null;

    for (const def of defs) {
      if (usedTargets.has(def.key)) continue;
      if (
        normalized === def.label ||
        def.aliases.includes(normalized) ||
        def.aliases.includes(col.trim())
      ) {
        matched = def.key;
        break;
      }
    }

    if (matched) usedTargets.add(matched);
    mapping[col] = matched;
  }

  return mapping;
}
