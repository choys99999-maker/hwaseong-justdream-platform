import type { Visit, VisitStage, WelfareReferral } from '../types';

/** 방문 횟수 → 차수 라벨. 3회 이상은 모두 '3차+' 로 묶는다. */
export function toVisitStage(visitNo: number): VisitStage {
  if (visitNo <= 1) return '1차';
  if (visitNo === 2) return '2차';
  return '3차+';
}

/** 오늘 날짜(YYYY-MM-DD). 로컬 기준이라 UTC 변환으로 하루가 밀리지 않는다. */
export function todayISO(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** 'YYYY-MM-DD' → 'YYYY-MM'. 이번 달 집계 기준값이다. */
export function monthPrefix(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * 이름 마스킹. 저장 시점에 한 번 적용해서 평문 이름이 남지 않게 한다.
 * 이미 ○ 가 들어 있으면 그대로 둔다.
 */
export function maskKoreanName(raw: string): string {
  const name = raw.trim();
  if (name.length <= 1 || name.includes('○')) return name;
  if (name.length === 2) return `${name[0]}○`;
  return `${name[0]}${'○'.repeat(name.length - 2)}${name[name.length - 1]}`;
}

const DONG_PATTERN = /([가-힣]+[0-9]*(?:읍|면|동))/;

/** 상세주소에서 거주 읍면동만 뽑는다. 목록에는 이 값까지만 노출한다. */
export function extractDong(address: string): string {
  const tail = address.replace(/^.*?화성시\s*/, '');
  const matched = DONG_PATTERN.exec(tail);
  return matched ? matched[1] : '';
}

/** 'YYYY-MM-DD' → 출생연도. 파싱 실패 시 0 을 돌려준다. */
export function birthYearOf(birthDate: string): number {
  const year = Number.parseInt(birthDate.slice(0, 4), 10);
  return Number.isNaN(year) ? 0 : year;
}

let idCounter = 0;

/** 화면 내에서만 유일하면 되는 임시 id. 중앙 저장소 연동 시 서버 id 로 대체된다. */
export function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** RFC 4180 기준 CSV 셀. 콤마·따옴표·줄바꿈이 있으면 감싸고 따옴표는 이중화한다. */
export function csvCell(value: string | number | undefined): string {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// ─────────────────────────────────────────────────────────────────────────────
// 다음 조치 · 진행 단계
//
// 담당자가 목록에서 "지금 뭘 해야 하는지" 를 바로 읽을 수 있게, 방문 이력과
// 연계 상태로부터 다음 할 일 한 줄을 계산한다. 표시 문구가 흩어지지 않도록
// 목록·CSV·상세 화면이 모두 이 함수를 쓴다.
// ─────────────────────────────────────────────────────────────────────────────

/** todo=담당자 조치 필요, waiting=읍면동 회신 대기, done=종결 */
export type NextActionTone = 'todo' | 'waiting' | 'done';

export interface NextAction {
  label: string;
  tone: NextActionTone;
}

export function resolveNextAction(visits: Visit[], referral: WelfareReferral | undefined): NextAction {
  const last = visits[visits.length - 1];
  const status = referral?.status ?? '미연계';

  if (status === '연계불요') return { label: '처리 완료', tone: 'done' };

  if (status === '연계완료') {
    return referral && referral.continuedSupport === '미판정'
      ? { label: '지속지원 판정 필요', tone: 'todo' }
      : { label: '처리 완료', tone: 'done' };
  }

  // 읍면동으로 넘어간 뒤에는 회신을 기다리는 상태다.
  if (status === '연계요청' || status === '읍면동상담중') {
    return { label: '읍면동 결과 확인 필요', tone: 'waiting' };
  }

  // 아직 연계 전 — 기본상담에서 추가지원이 필요하다고 봤으면 연계를 올려야 한다.
  if (last?.basicCounseling?.needsAdditionalSupport) {
    return { label: '복지연계 요청 필요', tone: 'todo' };
  }
  if (!last || last.visitNo === 1 || !last.basicCounseling?.conducted) {
    return { label: '2차 상담 필요', tone: 'todo' };
  }
  return { label: '처리 완료', tone: 'done' };
}

/** done=완료, current=진행 중, todo=대기, skipped=해당 없음 */
export type StepState = 'done' | 'current' | 'todo' | 'skipped';

export interface ProgressStep {
  key: string;
  label: string;
  state: StepState;
}

/** 상세 화면 상단 스텝퍼. 1차 이용 → 2차 상담 → 복지연계 → 읍면동 상담 → 지속지원 판정 */
export function resolveProgressSteps(visits: Visit[], referral: WelfareReferral | undefined): ProgressStep[] {
  const status = referral?.status ?? '미연계';
  const hasSecond = visits.some((visit) => visit.visitNo >= 2);
  const counseled = visits.some((visit) => visit.visitNo >= 2 && visit.basicCounseling?.conducted);
  const noLinkage = status === '연계불요';

  const firstUse: StepState = visits.length > 0 ? 'done' : 'todo';

  const secondCounseling: StepState = counseled ? 'done' : hasSecond ? 'current' : 'todo';

  const linkage: StepState = noLinkage
    ? 'done'
    : status === '연계완료'
      ? 'done'
      : status === '연계요청' || status === '읍면동상담중'
        ? 'current'
        : 'todo';

  const dongCounseling: StepState = noLinkage
    ? 'skipped'
    : referral?.dongCounselingDoneAt
      ? 'done'
      : status === '읍면동상담중' || status === '연계요청'
        ? 'current'
        : 'todo';

  const continued: StepState = noLinkage
    ? 'skipped'
    : referral && referral.continuedSupport !== '미판정'
      ? 'done'
      : status === '연계완료'
        ? 'current'
        : 'todo';

  return [
    { key: 'first', label: '1차 이용', state: firstUse },
    { key: 'counseling', label: '2차 상담', state: secondCounseling },
    { key: 'linkage', label: '복지연계', state: linkage },
    { key: 'dong', label: '읍면동 상담', state: dongCounseling },
    { key: 'continued', label: '지속지원 판정', state: continued },
  ];
}

/** BOM 을 붙여서 엑셀에서 한글이 깨지지 않게 한다. */
export function downloadCsv(fileName: string, headers: string[], rows: (string | number | undefined)[][]): void {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
