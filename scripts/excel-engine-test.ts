// 엑셀 해석 엔진 v2 회귀 테스트.
//
// 형태가 서로 다른 합성 Excel을 만들어 실제로 해석시키고, 기대값과 비교한다.
// 통과 기준은 "오류가 없다"가 아니라 "조용히 소실되거나 잘못 변환되는 값이 없다"이다.
// 자동 인식이 안 되는 것은 실패해도 되지만, 반드시 사용자에게 알려야 한다.
//
//   npm run test:excel
import * as XLSX from 'xlsx';
import type { MappedRecord, PlatformColumnKey } from '../src/types/upload';
import { analyzeWorkbook, convertSheet, defaultMapping } from '../src/utils/excel/engine';
import { isRowEmpty } from '../src/utils/excel/sheet';
import { colLetter } from '../src/utils/excel/text';

// ── 합성 파일 만들기 ──────────────────────────────────────

interface SheetSpec {
  name: string;
  aoa: unknown[][];
  merges?: XLSX.Range[];
  /**
   * 표가 시작하는 셀. 기본은 A1.
   * 실제 제출 파일 중에는 '!ref' 가 A3 부터 시작하는 시트가 있다. 그런 시트는
   * '!merges'(절대 좌표)와 행 번호가 어긋나기 쉬워 따로 검증한다.
   */
  origin?: string;
}

function buildWorkbook(sheets: SheetSpec[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const spec of sheets) {
    let ws: XLSX.WorkSheet;
    if (spec.origin) {
      ws = XLSX.utils.aoa_to_sheet([]);
      XLSX.utils.sheet_add_aoa(ws, spec.aoa, { origin: spec.origin });
    } else {
      ws = XLSX.utils.aoa_to_sheet(spec.aoa);
    }
    if (spec.merges) ws['!merges'] = spec.merges;
    XLSX.utils.book_append_sheet(wb, ws, spec.name);
  }
  // SheetJS 는 버전에 따라 ArrayBuffer 또는 Uint8Array 를 돌려준다.
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer | Uint8Array;
  if (out instanceof Uint8Array) {
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
  }
  return out;
}

/** 병합 범위 (0-based) */
function merge(r1: number, c1: number, r2: number, c2: number): XLSX.Range {
  return { s: { r: r1, c: c1 }, e: { r: r2, c: c2 } };
}

/** 엑셀 날짜 일련번호 */
function serial(y: number, m: number, d: number): number {
  return Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569;
}

// ── 기대값 ────────────────────────────────────────────────

interface SheetExpect {
  sheetName: string;
  type?: string;
  role?: string;
  /** 1-based 헤더 행 */
  headerRow?: number;
  headerRowCount?: number;
  isCumulative?: boolean;
  recordCount?: number;
  /** 표준 항목 → 연결되어야 할 원본 열 이름 */
  mapped?: Partial<Record<PlatformColumnKey, string>>;
  /** 이 원본 열들은 "확인 필요"(미인식/중복)로 표시되어야 한다 */
  needsAttention?: string[];
  /** 이 원본 열들은 "저장 대상 아님"으로 표시되어야 한다 */
  ignoredColumns?: string[];
  /** 첫 레코드부터 순서대로 부분 비교 */
  records?: Array<Partial<MappedRecord>>;
  /** 값 오류가 있어야 할 셀 주소 */
  errorCells?: string[];
  /** 데이터 행이 아니라고 뺀 행 번호 */
  skippedRowNumbers?: number[];
  filledRegion?: string | null;
  /** 파일의 합계와 읽은 값이 다를 것으로 기대하는 항목 수. 기본 0. */
  totalsMismatchCount?: number;
}

interface Case {
  id: string;
  title: string;
  sheets: SheetSpec[];
  expect: SheetExpect[];
}

const ITEM_HEADER = ['품목명', '입고수량', '출고수량', '현재재고', '유통기한'];

const CASES: Case[] = [
  {
    id: 'A',
    title: '표준형',
    sheets: [
      {
        name: '물품현황',
        aoa: [
          ITEM_HEADER,
          ['쌀', 100, 30, 70, '2026-12-31'],
          ['라면', 50, 20, 30, '2026-09-30'],
          ['김치', 40, 40, 0, '2026-08-20'],
        ],
      },
    ],
    expect: [
      {
        sheetName: '물품현황',
        type: 'generic',
        role: 'data',
        headerRow: 1,
        headerRowCount: 1,
        recordCount: 3,
        mapped: {
          itemName: '품목명',
          inboundQuantity: '입고수량',
          outboundQuantity: '출고수량',
          stock: '현재재고',
          expirationDate: '유통기한',
        },
        needsAttention: [],
        records: [
          { itemName: '쌀', inboundQuantity: 100, outboundQuantity: 30, stock: 70, expirationDate: '2026-12-31' },
          { itemName: '라면', inboundQuantity: 50, outboundQuantity: 20, stock: 30, expirationDate: '2026-09-30' },
          { itemName: '김치', inboundQuantity: 40, outboundQuantity: 40, stock: 0, expirationDate: '2026-08-20' },
        ],
      },
    ],
  },

  {
    id: 'B',
    title: '제목 1행',
    sheets: [
      {
        name: '현황',
        aoa: [
          ['2026년 8월 그냥드림 물품 현황'],
          ITEM_HEADER,
          ['쌀', 100, 30, 70, '2026-12-31'],
        ],
      },
    ],
    expect: [
      {
        sheetName: '현황',
        type: 'generic',
        headerRow: 2,
        recordCount: 1,
        mapped: { itemName: '품목명', inboundQuantity: '입고수량' },
        records: [{ itemName: '쌀', inboundQuantity: 100 }],
      },
    ],
  },

  {
    id: 'C',
    title: '제목 3행 (제목·기관·공백)',
    sheets: [
      {
        name: '현황',
        aoa: [
          ['2026년 8월 그냥드림 물품 현황'],
          ['봉담읍'],
          [],
          ['품목', '입고량', '출고량', '재고'],
          ['쌀', 100, 30, 70],
          ['라면', 50, 20, 30],
        ],
      },
    ],
    expect: [
      {
        sheetName: '현황',
        type: 'generic',
        headerRow: 4,
        recordCount: 2,
        mapped: { itemName: '품목', inboundQuantity: '입고량', outboundQuantity: '출고량', stock: '재고' },
        // 지역 열이 없으므로 제목에서 찾은 읍면동을 채운다 (채웠다는 사실을 화면에 표시)
        filledRegion: '봉담읍',
        records: [{ itemName: '쌀', inboundQuantity: 100, region: '봉담읍' }],
      },
    ],
  },

  {
    id: 'D',
    title: '시트명 임의 — 이름이 아니라 내용으로 판별',
    sheets: [
      {
        name: '8월 최종본(수정)',
        aoa: [ITEM_HEADER, ['쌀', 10, 5, 5, '2026-12-31']],
      },
      {
        name: 'Sheet1',
        aoa: [['품목', '입고량', '재고'], ['라면', 3, 3]],
      },
    ],
    expect: [
      { sheetName: '8월 최종본(수정)', type: 'generic', role: 'data', recordCount: 1 },
      { sheetName: 'Sheet1', type: 'generic', role: 'data', recordCount: 1 },
    ],
  },

  {
    id: 'E',
    title: '컬럼 alias 변경',
    sheets: [
      {
        name: '자료',
        aoa: [
          ['물품', '입고 수량', '배부수량', '소비기한'],
          ['쌀', '1,000', 300, '2026.12.31'],
        ],
      },
    ],
    expect: [
      {
        sheetName: '자료',
        type: 'generic',
        recordCount: 1,
        mapped: {
          itemName: '물품',
          inboundQuantity: '입고 수량',
          outboundQuantity: '배부수량',
          expirationDate: '소비기한',
        },
        needsAttention: [],
        records: [{ itemName: '쌀', inboundQuantity: 1000, outboundQuantity: 300, expirationDate: '2026-12-31' }],
      },
    ],
  },

  {
    id: 'F',
    title: '컬럼 순서 변경',
    sheets: [
      {
        name: '자료',
        aoa: [
          ['유통기한', '현재재고', '품목명', '출고수량', '입고수량'],
          ['2026-12-31', 70, '쌀', 30, 100],
        ],
      },
    ],
    expect: [
      {
        sheetName: '자료',
        recordCount: 1,
        mapped: {
          itemName: '품목명',
          inboundQuantity: '입고수량',
          outboundQuantity: '출고수량',
          stock: '현재재고',
          expirationDate: '유통기한',
        },
        records: [{ itemName: '쌀', inboundQuantity: 100, outboundQuantity: 30, stock: 70, expirationDate: '2026-12-31' }],
      },
    ],
  },

  {
    id: 'G',
    title: '불필요 컬럼 추가 (비고·담당자)',
    sheets: [
      {
        name: '자료',
        aoa: [
          ['품목명', '입고수량', '비고', '담당자'],
          ['쌀', 100, '기부받음', '홍길동'],
        ],
      },
    ],
    expect: [
      {
        sheetName: '자료',
        recordCount: 1,
        mapped: { itemName: '품목명', inboundQuantity: '입고수량' },
        ignoredColumns: ['비고', '담당자'],
        needsAttention: [],
      },
    ],
  },

  {
    id: 'H',
    title: '현재재고 열 없음',
    sheets: [
      {
        name: '자료',
        aoa: [
          ['품목명', '입고수량', '출고수량'],
          ['쌀', 100, 30],
        ],
      },
    ],
    expect: [
      {
        sheetName: '자료',
        recordCount: 1,
        mapped: { itemName: '품목명', inboundQuantity: '입고수량', outboundQuantity: '출고수량' },
        needsAttention: [],
        records: [{ itemName: '쌀', inboundQuantity: 100, outboundQuantity: 30 }],
      },
    ],
  },

  {
    id: 'I',
    title: '여러 기관 포함',
    sheets: [
      {
        name: '자료',
        aoa: [
          ['기관명', '품목명', '입고수량'],
          ['봉담읍 행복나눔', '쌀', 100],
          ['향남읍 그냥드림', '라면', 50],
          ['동탄1동 나눔가게', '김치', 20],
        ],
      },
    ],
    expect: [
      {
        sheetName: '자료',
        recordCount: 3,
        mapped: { organization: '기관명', itemName: '품목명', inboundQuantity: '입고수량' },
        records: [
          { organization: '봉담읍 행복나눔', itemName: '쌀' },
          { organization: '향남읍 그냥드림', itemName: '라면' },
          { organization: '동탄1동 나눔가게', itemName: '김치' },
        ],
      },
    ],
  },

  {
    id: 'J',
    title: '세로 병합된 지역 셀',
    sheets: [
      {
        name: '자료',
        aoa: [
          ['지역', '품목명', '입고수량'],
          ['봉담읍', '쌀', 100],
          ['', '라면', 50],
          ['향남읍', '김치', 20],
          ['', '두부', 10],
        ],
        merges: [merge(1, 0, 2, 0), merge(3, 0, 4, 0)],
      },
    ],
    expect: [
      {
        sheetName: '자료',
        recordCount: 4,
        mapped: { region: '지역', itemName: '품목명' },
        records: [
          { region: '봉담읍', itemName: '쌀' },
          { region: '봉담읍', itemName: '라면' },
          { region: '향남읍', itemName: '김치' },
          { region: '향남읍', itemName: '두부' },
        ],
      },
    ],
  },

  {
    id: 'K',
    title: '합계·소계 행 포함',
    sheets: [
      {
        name: '자료',
        aoa: [
          ['품목명', '입고수량', '출고수량'],
          ['쌀', 100, 30],
          ['라면', 50, 20],
          ['소계', 150, 50],
          ['김치', 40, 10],
          ['합계', 190, 60],
        ],
      },
    ],
    expect: [
      {
        sheetName: '자료',
        recordCount: 3,
        skippedRowNumbers: [4, 6],
        records: [{ itemName: '쌀' }, { itemName: '라면' }, { itemName: '김치' }],
      },
    ],
  },

  {
    id: 'L',
    title: '날짜 형식 혼합 — 읽을 수 있는 것만 읽고 나머지는 알린다',
    sheets: [
      {
        name: '자료',
        aoa: [
          ['품목명', '유통기한'],
          ['가', '2026-08-03'],
          ['나', '2026.08.03'],
          ['다', '2026/08/03'],
          ['라', '2026년 8월 3일'],
          ['마', serial(2026, 8, 3)],
          ['바', '20260803'],
          ['사', '8/3'],
          ['아', '2026'],
          ['자', '미정'],
          ['차', ''],
        ],
      },
    ],
    expect: [
      {
        sheetName: '자료',
        recordCount: 10,
        records: [
          { itemName: '가', expirationDate: '2026-08-03' },
          { itemName: '나', expirationDate: '2026-08-03' },
          { itemName: '다', expirationDate: '2026-08-03' },
          { itemName: '라', expirationDate: '2026-08-03' },
          { itemName: '마', expirationDate: '2026-08-03' },
          { itemName: '바', expirationDate: '2026-08-03' },
          { itemName: '사' },
          { itemName: '아' },
          { itemName: '자' },
          { itemName: '차' },
        ],
        // 8/3, 2026, 미정 → 추측하지 않고 오류로 알린다. 빈칸은 오류가 아니다.
        errorCells: ['B8', 'B9', 'B10'],
      },
    ],
  },

  {
    id: 'M',
    title: '누계 + 주별 (이중 집계 방지)',
    sheets: [
      {
        name: '주별 실적',
        aoa: [
          ['구분', '이용자', '기본 상담', '상담 연계 의뢰', '연계완료'],
          ['봉담읍', 100, 40, 12, 8],
        ],
      },
      {
        name: '누계 실적',
        aoa: [
          ['구분', '이용자', '기본 상담', '상담 연계 의뢰', '연계완료'],
          ['봉담읍', 850, 320, 96, 71],
        ],
      },
    ],
    expect: [
      { sheetName: '주별 실적', type: 'performance', isCumulative: false, recordCount: 1 },
      { sheetName: '누계 실적', type: 'performance', isCumulative: true, recordCount: 1 },
    ],
  },

  {
    id: 'N',
    title: '미인식 컬럼 포함 — 조용히 버리지 않는다',
    sheets: [
      {
        name: '자료',
        aoa: [
          ['품목명', '입고수량', '특수관리코드', '보관위치'],
          ['쌀', 100, 'A-102', '창고1'],
        ],
      },
    ],
    expect: [
      {
        sheetName: '자료',
        recordCount: 1,
        mapped: { itemName: '품목명', inboundQuantity: '입고수량' },
        needsAttention: ['특수관리코드', '보관위치'],
      },
    ],
  },

  {
    id: 'O',
    title: '다중 시트 + 안내 시트',
    sheets: [
      {
        name: '작성 안내',
        aoa: [
          ['그냥드림 자료 작성 안내'],
          ['1. 품목명은 정확히 적어주세요.'],
          ['2. 수량은 숫자만 적어주세요.'],
        ],
      },
      {
        name: '물품',
        aoa: [ITEM_HEADER, ['쌀', 100, 30, 70, '2026-12-31']],
      },
      {
        name: '연계',
        aoa: [
          ['연번', '대상자 이름', '생년월일', '주소', '상담일자', '2차 연계처'],
          [1, '홍길동', '850101', '경기도 화성시 봉담읍 봉담로 12', '2026-08-03', '봉담읍'],
        ],
      },
    ],
    expect: [
      { sheetName: '작성 안내', role: 'guide' },
      { sheetName: '물품', type: 'generic', role: 'data', recordCount: 1 },
      {
        sheetName: '연계',
        type: 'referral',
        role: 'data',
        recordCount: 1,
        records: [{ clientName: '홍길동', birthDate: '1985-01-01', consultDate: '2026-08-03' }],
      },
    ],
  },

  {
    id: 'P',
    title: '시트명은 "연계"인데 내용은 물품 — 내용이 이긴다',
    sheets: [
      {
        name: '연계 현황(8월)',
        aoa: [ITEM_HEADER, ['쌀', 100, 30, 70, '2026-12-31']],
      },
    ],
    expect: [{ sheetName: '연계 현황(8월)', type: 'generic', role: 'data', recordCount: 1 }],
  },

  {
    id: 'Q',
    title: '2줄 머리글 (가로 병합만, 세로 병합 없음)',
    sheets: [
      {
        name: '실적',
        aoa: [
          ['구분', '연계완료', '', '', '검토중'],
          ['', '기초생활', '차상위', '긴급복지', ''],
          ['봉담읍', 3, 2, 1, 4],
          ['향남읍', 1, 0, 2, 1],
        ],
        // '연계완료'만 가로로 묶여 있고, '구분'·'검토중'은 아랫줄이 비어 있다.
        // 한 줄만 읽으면 두 열이 통째로 사라지므로 2줄을 합쳐 읽어야 한다.
        merges: [merge(0, 1, 0, 3)],
      },
    ],
    expect: [
      {
        sheetName: '실적',
        type: 'performance',
        headerRow: 1,
        headerRowCount: 2,
        recordCount: 2,
        mapped: {
          institution: '구분',
          basicLivelihood: '기초생활',
          nearPoverty: '차상위',
          emergencyWelfare: '긴급복지',
          underReview: '검토중',
        },
        needsAttention: [],
        records: [{ institution: '봉담읍', basicLivelihood: 3, nearPoverty: 2, emergencyWelfare: 1, underReview: 4 }],
      },
    ],
  },

  {
    id: 'S',
    title: '세로까지 병합된 2줄 머리글',
    sheets: [
      {
        name: '실적',
        aoa: [
          ['구분', '연계완료', '', '', '검토중'],
          ['', '기초생활', '차상위', '긴급복지', ''],
          ['봉담읍', 3, 2, 1, 4],
          ['향남읍', 1, 0, 2, 1],
        ],
        merges: [merge(0, 1, 0, 3), merge(0, 0, 1, 0), merge(0, 4, 1, 4)],
      },
    ],
    expect: [
      {
        sheetName: '실적',
        type: 'performance',
        // 세로 병합이 풀리면 둘째 줄만으로 완전한 머리글이 된다.
        headerRow: 2,
        headerRowCount: 1,
        recordCount: 2,
        mapped: {
          institution: '구분',
          basicLivelihood: '기초생활',
          nearPoverty: '차상위',
          emergencyWelfare: '긴급복지',
          underReview: '검토중',
        },
        needsAttention: [],
        records: [{ institution: '봉담읍', basicLivelihood: 3, nearPoverty: 2, emergencyWelfare: 1, underReview: 4 }],
      },
    ],
  },

  {
    id: 'T',
    title: '누계 표시가 시트명 괄호 안에만 있음 (실제 제출 양식)',
    sheets: [
      {
        name: '주별 실적 보고(주별)',
        aoa: [['구분', '이용자', '기본 상담'], ['봉담읍', 38, 11]],
      },
      {
        name: '주별 실적 보고(누계)',
        aoa: [['구분', '이용자', '기본 상담'], ['봉담읍', 550, 159]],
      },
    ],
    expect: [
      // 괄호를 지우면 "주별실적보고"가 되어 둘이 구분되지 않는다.
      // 누계를 놓치면 주별과 함께 더해져 같은 값을 두 번 센다.
      { sheetName: '주별 실적 보고(주별)', isCumulative: false, recordCount: 1 },
      { sheetName: '주별 실적 보고(누계)', isCumulative: true, recordCount: 1 },
    ],
  },

  {
    id: 'U',
    title: "'!ref' 가 A3부터 시작하는 시트 (병합·행 번호 어긋남 방지)",
    sheets: [
      {
        name: '실적',
        origin: 'A3',
        aoa: [
          ['구분', '연계완료', '', '', '검토중'],
          ['', '기초생활', '차상위', '긴급복지', ''],
          ['봉담읍', 3, 2, 1, 4],
          ['합계', 3, 2, 1, 4],
        ],
        // 절대 좌표. 표가 3행부터 시작하므로 머리글은 3~4행이다.
        merges: [merge(2, 1, 2, 3), merge(2, 0, 3, 0), merge(2, 4, 3, 4)],
      },
    ],
    expect: [
      {
        sheetName: '실적',
        type: 'performance',
        // 표가 3행에서 시작한다는 사실이 행 번호에 그대로 나와야 한다.
        headerRow: 4,
        headerRowCount: 1,
        recordCount: 1,
        mapped: {
          institution: '구분',
          basicLivelihood: '기초생활',
          nearPoverty: '차상위',
          emergencyWelfare: '긴급복지',
          underReview: '검토중',
        },
        needsAttention: [],
        records: [{ institution: '봉담읍', basicLivelihood: 3, nearPoverty: 2, emergencyWelfare: 1, underReview: 4 }],
        skippedRowNumbers: [6],
      },
    ],
  },

  {
    id: 'V',
    title: '머리글이 빈 열에 값이 들어 있음 — 조용히 사라지면 안 된다',
    sheets: [
      {
        name: '자료',
        aoa: [
          // D열 머리글만 비어 있다. 아래에는 값이 있다.
          ['품목명', '입고수량', '출고수량', ''],
          ['쌀', 100, 30, 'X-1'],
          ['라면', 50, 20, 'X-2'],
          // 이 행은 머리글 없는 열에만 값이 있다. 행째로 사라지면 안 된다.
          ['', '', '', 'X-3'],
        ],
      },
    ],
    expect: [
      {
        sheetName: '자료',
        mapped: { itemName: '품목명', inboundQuantity: '입고수량', outboundQuantity: '출고수량' },
        needsAttention: ['(머리글 없는 D열)'],
        recordCount: 2,
        // 값이 그 열에만 있는 행은 버리지 않고 확인 대상으로 올린다.
        skippedRowNumbers: [4],
      },
    ],
  },

  {
    id: 'W',
    title: '표가 끝난 한참 뒤에 잡음이 흩어져 있음',
    sheets: [
      {
        name: '실적',
        aoa: [
          ['구분', '이용자', '기본 상담'],
          ['합계', 30, 12],
          ['봉담읍', 10, 4],
          ['향남읍', 20, 8],
          ['*이용자 수는 중복을 뺀 실인원입니다.'],
          [],
          [],
          [],
          // 표와 한참 떨어진 잡음. 연결된 열에 숫자가 들어 있어도 표의 데이터가 아니다.
          ['', 54641354846, 54641354846],
          ['ㅇㄱㄺㄹ', 34654364445, 34654364445],
        ],
      },
    ],
    expect: [
      {
        sheetName: '실적',
        type: 'performance',
        recordCount: 2,
        records: [
          { institution: '봉담읍', userCount: 10, basicConsultation: 4 },
          { institution: '향남읍', userCount: 20, basicConsultation: 8 },
        ],
        // 각주 · 필수 항목 없는 줄 · 표 밖의 줄이 전부 확인 대상으로 올라온다.
        skippedRowNumbers: [2, 5, 9, 10],
      },
    ],
  },

  {
    id: 'X',
    title: 'O/X 로 적는 칸 — X 를 빈 값으로 지우면 안 된다',
    sheets: [
      {
        name: '연계',
        aoa: [
          ['연번', '대상자 이름', '연계 상담 실시 여부', '검토중', '연계불요'],
          [1, '홍길동', 'O', 'X', 'X'],
          [2, '홍길일', 'X', 'O', '-'],
        ],
      },
    ],
    expect: [
      {
        sheetName: '연계',
        type: 'referral',
        recordCount: 2,
        records: [
          { clientName: '홍길동', consultationDone: 'O', underReview: 'X', noLinkageNeeded: 'X' },
          // '-' 도 사용자가 적은 내용이다. 문자 칸에서는 무엇도 임의로 지우지 않는다.
          { clientName: '홍길일', consultationDone: 'X', underReview: 'O', noLinkageNeeded: '-' },
        ],
      },
    ],
  },

  {
    id: 'Y',
    title: '파일의 합계가 실제와 다름 — 조용히 넘기지 말고 알려야 한다',
    sheets: [
      {
        name: '실적',
        aoa: [
          ['구분', '이용자'],
          // 파일에 적힌 합계(999)가 실제 합(30)과 다르다.
          ['합계', 999],
          ['봉담읍', 10],
          ['향남읍', 20],
        ],
      },
    ],
    expect: [
      {
        sheetName: '실적',
        type: 'performance',
        recordCount: 2,
        // 검산이 어긋난 것을 잡아내야 한다. (사용자에게 그대로 보여준다)
        totalsMismatchCount: 1,
      },
    ],
  },

  {
    id: 'R',
    title: '숫자에 단위·쉼표·각주 행 섞임',
    sheets: [
      {
        name: '자료',
        aoa: [
          ['품목명', '입고수량', '출고수량'],
          ['쌀', '1,000개', '300 개'],
          ['라면', '50박스', '20박스'],
          ['김치', '열 박스', 5],
          ['※ 수량은 박스 단위로 기재합니다.'],
        ],
      },
    ],
    expect: [
      {
        sheetName: '자료',
        recordCount: 3,
        records: [
          { itemName: '쌀', inboundQuantity: 1000, outboundQuantity: 300 },
          { itemName: '라면', inboundQuantity: 50, outboundQuantity: 20 },
          { itemName: '김치', outboundQuantity: 5 },
        ],
        errorCells: ['B4'],
        skippedRowNumbers: [5],
      },
    ],
  },

  {
    id: 'Z',
    title: '단위·기준일 등 짧은 헤더가 그대로 열 이름일 때 — 어노테이션으로 오인해 지우면 안 된다',
    sheets: [
      {
        name: '물품재고',
        aoa: [
          ['기관명', '품목명', '수량', '단위', '유통기한', '기준일'],
          ['동탄6동', '쌀 10kg', 18, '포', '2027-05-31', '2026-08-18'],
          ['동탄6동', '즉석밥 세트', 7, '세트', '2027-02-28', '2026-08-18'],
        ],
      },
    ],
    expect: [
      {
        sheetName: '물품재고',
        type: 'generic',
        recordCount: 2,
        mapped: {
          organization: '기관명',
          itemName: '품목명',
          stock: '수량',
          expirationDate: '유통기한',
          inboundDate: '기준일',
        },
        // "단위"는 저장 대상이 아니라고 미리 정해둔 열이다 — 미인식이 아니라 "저장 안 함"이어야 한다.
        ignoredColumns: ['단위'],
        needsAttention: [],
        records: [
          { organization: '동탄6동', itemName: '쌀 10kg', stock: 18, expirationDate: '2027-05-31', inboundDate: '2026-08-18' },
          { organization: '동탄6동', itemName: '즉석밥 세트', stock: 7, expirationDate: '2027-02-28', inboundDate: '2026-08-18' },
        ],
      },
    ],
  },
];

// ── 자체 감사 ─────────────────────────────────────────────
// 기대값과의 비교와 별개로, "파일 하나만 보고" 판정할 수 있는 것들을 늘 확인한다.
// 정답 파일을 옆에 두지 않아도 성립해야 하는 성질이라 실제 제출 파일에도 그대로 쓴다.

function selfAudit(
  caseId: string,
  sheet: ReturnType<typeof analyzeWorkbook>[number],
  converted: ReturnType<typeof convertSheet>,
  expectedTotalsMismatch = 0,
) {
  const parsed = sheet.result;
  if (parsed.role === 'guide') return;
  const id = `${caseId}/${parsed.sheetName}`;
  const { matrix, columns, dataStartIndex } = sheet;

  // 1) 행 보존 — 비어있지 않은 모든 행이 레코드나 제외 목록 중 하나로 설명되어야 한다.
  let nonEmptyRows = 0;
  for (let r = dataStartIndex; r < matrix.rowCount; r++) {
    if (!isRowEmpty(matrix.rows[r])) nonEmptyRows++;
  }
  check(id, '행 보존(레코드+제외 = 비어있지 않은 행)',
    converted.records.length + converted.skippedRows.length, nonEmptyRows);

  // 2) 셀 보존 — 레코드 행의 값은 저장되거나, 오류로 보고되거나,
  //    화면에 "연결 안 됨"으로 보이는 열에 속해야 한다. 그 밖은 조용한 소실이다.
  const visibleUnstored = new Set(parsed.columnDiagnostics.filter((d) => !d.mapped).map((d) => d.index));
  const mappedByIndex = new Map(
    parsed.columnDiagnostics.filter((d) => d.mapped).map((d) => [d.index, d.mapped!]),
  );
  const errorCells = new Set(converted.errors.map((e) => e.cellAddress));
  const lost: string[] = [];
  converted.sourceRowNumbers.forEach((rowNumber, i) => {
    const row = matrix.rows[rowNumber - 1];
    const record = converted.records[i];
    for (const col of columns) {
      if (String(row[col.index] ?? '').trim() === '') continue;
      if (visibleUnstored.has(col.index)) continue;
      const key = mappedByIndex.get(col.index);
      if (key && record[key] !== undefined) continue;
      if (errorCells.has(`${colLetter(col.index)}${rowNumber}`)) continue;
      lost.push(`${colLetter(col.index)}${rowNumber}`);
    }
  });
  check(id, `셀 보존(조용히 사라진 값 ${lost.slice(0, 5).join(',')})`, lost.length, 0);

  // 3) 자체 검산 — 파일이 스스로 적어둔 합계와 우리가 읽은 값의 합이 맞아야 한다.
  const mismatched = converted.totalsChecks.filter((c) => !c.matches);
  check(
    id,
    `자체 검산(${mismatched.map((m) => `${m.field}: 파일=${m.declared} 읽음=${m.computed}`).join(', ')})`,
    mismatched.length,
    expectedTotalsMismatch,
  );
}

// ── 실행 ──────────────────────────────────────────────────

const failures: string[] = [];
let checks = 0;

function check(caseId: string, label: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`[${caseId}] ${label}\n      기대: ${e}\n      실제: ${a}`);
}

function pad(s: string, n: number): string {
  const width = [...s].reduce((sum, ch) => sum + (/[가-힣ㄱ-ㅎ]/.test(ch) ? 2 : 1), 0);
  return s + ' '.repeat(Math.max(0, n - width));
}

for (const testCase of CASES) {
  const buffer = buildWorkbook(testCase.sheets);
  const analyzed = analyzeWorkbook(buffer);

  console.log(`\n━━ ${testCase.id}. ${testCase.title}`);

  for (const sheet of analyzed) {
    const parsed = sheet.result;
    const mapping = defaultMapping(parsed);
    const converted = convertSheet(sheet, mapping);

    const mappedPairs: Record<string, string> = {};
    for (const diag of parsed.columnDiagnostics) {
      if (diag.mapped) mappedPairs[diag.mapped] = diag.name;
    }
    const attention = parsed.columnDiagnostics
      .filter((d) => d.status === 'unmapped' || d.status === 'duplicate')
      .map((d) => d.name);
    const ignored = parsed.columnDiagnostics.filter((d) => d.status === 'ignored').map((d) => d.name);
    const suggested = parsed.columnDiagnostics.filter((d) => d.status === 'suggested').map((d) => d.name);

    console.log(
      `   ${pad(parsed.sheetName, 18)} 유형=${pad(parsed.sheetType, 12)} 역할=${pad(parsed.role, 8)}` +
        ` 헤더=${parsed.headerRow}행(${parsed.headerRowCount}줄) 열=${parsed.columns.length}` +
        ` 인식=${Object.keys(mappedPairs).length} 확인필요=${attention.length}` +
        ` 저장제외열=${ignored.length} 레코드=${converted.records.length}` +
        ` 오류=${converted.errors.length} 제외행=${converted.skippedRows.length}`,
    );
    if (suggested.length) console.log(`      추천(확인 필요): ${suggested.join(', ')}`);
    if (attention.length) console.log(`      미인식: ${attention.join(', ')}`);
    if (converted.filledRegion) console.log(`      지역 채움: ${converted.filledRegion}`);
    for (const skipped of converted.skippedRows) {
      console.log(`      제외 ${skipped.rowNumber}행 [${skipped.kind}] ${skipped.message}`);
    }
    for (const err of converted.errors.slice(0, 5)) {
      console.log(`      오류 ${err.cellAddress} ${err.message}`);
    }

    const expectation = testCase.expect.find((e) => e.sheetName === parsed.sheetName);
    selfAudit(testCase.id, sheet, converted, expectation?.totalsMismatchCount ?? 0);

    const expected = expectation;
    if (!expected) continue;

    const id = `${testCase.id}/${parsed.sheetName}`;
    if (expected.type !== undefined) check(id, '시트 유형', parsed.sheetType, expected.type);
    if (expected.role !== undefined) check(id, '시트 역할', parsed.role, expected.role);
    if (expected.headerRow !== undefined) check(id, '헤더 행', parsed.headerRow, expected.headerRow);
    if (expected.headerRowCount !== undefined) {
      check(id, '헤더 줄 수', parsed.headerRowCount, expected.headerRowCount);
    }
    if (expected.isCumulative !== undefined) {
      check(id, '누계 여부', parsed.isCumulative, expected.isCumulative);
    }
    if (expected.recordCount !== undefined) {
      check(id, '레코드 수', converted.records.length, expected.recordCount);
    }
    if (expected.mapped) {
      for (const [key, column] of Object.entries(expected.mapped)) {
        check(id, `매핑 ${key}`, mappedPairs[key] ?? null, column);
      }
    }
    if (expected.needsAttention) {
      check(id, '확인 필요 열', attention.sort(), [...expected.needsAttention].sort());
    }
    if (expected.ignoredColumns) {
      check(id, '저장 제외 열', ignored.sort(), [...expected.ignoredColumns].sort());
    }
    if (expected.records) {
      expected.records.forEach((want, i) => {
        const got = converted.records[i] ?? {};
        for (const [key, value] of Object.entries(want)) {
          check(id, `${i + 1}번째 레코드 ${key}`, got[key] ?? null, value);
        }
      });
    }
    if (expected.errorCells) {
      check(id, '오류 셀', converted.errors.map((e) => e.cellAddress).sort(), [...expected.errorCells].sort());
    }
    if (expected.skippedRowNumbers) {
      check(id, '제외 행', converted.skippedRows.map((s) => s.rowNumber).sort((a, b) => a - b), expected.skippedRowNumbers);
    }
    if (expected.filledRegion !== undefined) {
      check(id, '지역 채움', converted.filledRegion, expected.filledRegion);
    }
  }
}

console.log(`\n${'─'.repeat(70)}`);
if (failures.length === 0) {
  console.log(`✅ ${CASES.length}개 파일 / ${checks}개 검사 모두 통과`);
  process.exit(0);
} else {
  console.log(`❌ ${checks}개 검사 중 ${failures.length}건 실패\n`);
  for (const failure of failures) console.log(`   ${failure}\n`);
  process.exit(1);
}
