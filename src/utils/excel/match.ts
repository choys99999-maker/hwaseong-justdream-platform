// 엑셀 해석 엔진 v2 — 열 이름 → 표준 필드 매칭.
//
// 완전일치만 보면 "입고 수량", "입고량(개)" 같은 흔한 변형을 전부 놓친다.
// 반대로 부분일치를 무제한 허용하면 "출고일"을 출고수량으로 붙여버린다.
// 그래서 일치 강도를 확신도(0~1)로 매기고, 낮으면 확정하지 않고 사용자에게 넘긴다.
import type { PlatformColumnKey, SheetType } from '../../types/upload';
import { getColumnsForType, IGNORED_COLUMNS } from './schema';
import { headerKeyLoose, headerKeyStrict } from './text';

/** 이 값 이상이면 자동 확정. */
export const AUTO_THRESHOLD = 0.9;
/** 이 값 이상이면 "추천"으로 보여주되 사용자 확인을 받는다. */
export const SUGGEST_THRESHOLD = 0.6;

export interface FieldMatch {
  key: PlatformColumnKey;
  confidence: number;
  /** 어떤 표현과 맞췄는지. 화면에 근거로 보여준다. */
  matchedAlias: string;
  reason: string;
}

interface AliasIndexEntry {
  key: PlatformColumnKey;
  /** 원본 표현 (화면 표시용) */
  alias: string;
  strict: string;
  loose: string;
}

const indexCache = new Map<SheetType, AliasIndexEntry[]>();

function buildIndex(type: SheetType): AliasIndexEntry[] {
  const cached = indexCache.get(type);
  if (cached) return cached;

  const entries: AliasIndexEntry[] = [];
  for (const def of getColumnsForType(type)) {
    for (const alias of [def.label, ...def.aliases]) {
      const strict = headerKeyStrict(alias);
      const loose = headerKeyLoose(alias);
      if (!strict && !loose) continue;
      entries.push({ key: def.key, alias, strict, loose });
    }
  }
  // 긴 표현을 먼저 본다. "연계완료계"가 "계"보다 먼저 맞아야 한다.
  entries.sort((a, b) => b.loose.length - a.loose.length);
  indexCache.set(type, entries);
  return entries;
}

/** 부분일치를 허용할 최소 길이. 한 글자("계")가 아무 데나 붙는 것을 막는다. */
const MIN_PARTIAL_LEN = 2;
const MIN_CONTAINS_LEN = 3;

/**
 * 열 이름 하나를 표준 필드에 맞춰본다.
 * candidates 에는 병합 헤더의 각 줄(예: ["입고", "수량"])과 그것을 이어붙인 이름을
 * 모두 넣는다. 어떤 줄이 진짜 의미를 담고 있는지 미리 알 수 없기 때문이다.
 */
export function matchColumn(candidates: string[], type: SheetType): FieldMatch | null {
  const index = buildIndex(type);
  let best: FieldMatch | null = null;

  const seen = new Set<string>();
  const uniq = candidates.filter((c) => {
    const k = headerKeyLoose(c);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  for (const candidate of uniq) {
    const strict = headerKeyStrict(candidate);
    const loose = headerKeyLoose(candidate);
    if (!loose) continue;

    for (const entry of index) {
      let confidence = 0;
      let reason = '';

      if (entry.strict && strict === entry.strict) {
        confidence = 1;
        reason = '열 이름이 그대로 일치';
      } else if (loose === entry.loose) {
        confidence = 0.95;
        reason = '공백·괄호·단위를 뺀 이름이 일치';
      } else if (
        entry.loose.length >= MIN_PARTIAL_LEN &&
        (loose.startsWith(entry.loose) || loose.endsWith(entry.loose))
      ) {
        // "기말재고" ← "재고" 처럼 앞뒤에 수식어만 붙은 경우
        confidence = 0.8 - Math.min(0.15, (loose.length - entry.loose.length) * 0.02);
        reason = `"${entry.alias}"에 수식어가 붙은 이름`;
      } else if (entry.loose.length >= MIN_CONTAINS_LEN && loose.includes(entry.loose)) {
        confidence = 0.65;
        reason = `"${entry.alias}"를 포함하는 이름`;
      } else {
        continue;
      }

      // 병합 헤더의 일부(예: 두 줄 중 윗줄)로 맞춘 것은 조금 덜 믿는다.
      if (candidate !== candidates[0]) confidence -= 0.03;

      if (!best || confidence > best.confidence) {
        best = { key: entry.key, confidence: Math.max(0, Math.min(1, confidence)), matchedAlias: entry.alias, reason };
      }
    }
  }

  return best && best.confidence >= SUGGEST_THRESHOLD ? best : null;
}

/** 저장 대상이 아니라고 미리 정해둔 열인지. 맞으면 사유를 돌려준다. */
export function matchIgnored(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const loose = headerKeyLoose(candidate);
    if (!loose) continue;
    for (const group of IGNORED_COLUMNS) {
      for (const keyword of group.keys) {
        if (loose === headerKeyLoose(keyword)) return group.reason;
      }
    }
  }
  return null;
}

/**
 * 시트 유형 판정용 점수. 헤더 이름들이 각 유형의 표준 필드와 얼마나 맞는지 잰다.
 * 같은 필드에 여러 열이 맞으면 가장 잘 맞는 하나만 센다. (중복 열로 점수가 부풀지 않게)
 */
export function scoreHeadersForType(headerCandidates: string[][], type: SheetType): number {
  const bestByKey = new Map<PlatformColumnKey, number>();
  for (const candidates of headerCandidates) {
    const match = matchColumn(candidates, type);
    if (!match) continue;
    const prev = bestByKey.get(match.key) ?? 0;
    if (match.confidence > prev) bestByKey.set(match.key, match.confidence);
  }
  let score = 0;
  for (const value of bestByKey.values()) score += value;
  return score;
}
