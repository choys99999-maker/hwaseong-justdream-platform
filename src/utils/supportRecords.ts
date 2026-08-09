import type { VisitStage } from '../types';

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
