import { distanceKm, type LatLng } from '../lib/geo';
import type { CitizenPlace, ItemGroup, PlaceItem } from '../data/citizenDirectory';

export interface RankedPlace extends CitizenPlace {
  /** 기준점이 없으면 null. 없는 거리를 0 으로 채우지 않는다. */
  distanceKm: number | null;
}

// ── 지금 이용할 수 있는가 ────────────────────────────────────────────────────

export type StatusTone = 'open' | 'warn' | 'closed' | 'unknown';

export interface PlaceStatus {
  tone: StatusTone;
  /** 사용자에게 그대로 보여주는 한 문장. 화면마다 다시 쓰지 않는다. */
  label: string;
  /** 운영시간처럼 문장 아래 한 줄로 덧붙일 사실. 확인된 자료가 없으면 null. */
  detail: string | null;
  /** 지금 문을 닫았는가. 물품 목록 제목을 "지금" / "최근" 으로 가르는 데 쓴다. */
  closed: boolean;
}

function parseHours(hours: string): { open: number; close: number } | null {
  const m = hours.match(/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return {
    open: Number(m[1]) * 60 + Number(m[2]),
    close: Number(m[3]) * 60 + Number(m[4]),
  };
}

/**
 * 거점 하나의 "현재 이용 상태" 를 한 곳에서만 판정한다.
 *
 * 화면마다 따로 계산하면 `운영 종료` 와 `지금 받을 수 있어요` 가 같이 뜨는 모순이 생긴다.
 * 그래서 규칙을 하나로 못 박는다 — **문을 닫았으면 물품 이야기를 먼저 하지 않는다.**
 * 운영시간이 확인되지 않은 거점은 문 여닫힘을 주장하지 않고 물품 상태만 말한다.
 */
export function resolvePlaceStatus(place: CitizenPlace, now: Date = new Date()): PlaceStatus {
  const hours = place.openHours ? parseHours(place.openHours) : null;
  const weekdayOnly = place.openDays === '평일';
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const detail = place.openHours ? `${place.openDays ?? ''} ${place.openHours} 운영`.trim() : null;

  if (hours) {
    if (weekdayOnly && isWeekend) {
      return { tone: 'closed', label: '주말에는 쉬어요', detail, closed: true };
    }
    const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes < hours.open) {
      const at = place.openHours!.split('~')[0].trim();
      return { tone: 'closed', label: `아직 열지 않았어요`, detail: `오늘 ${at}에 열어요`, closed: true };
    }
    if (minutes >= hours.close) {
      return { tone: 'closed', label: '오늘 운영이 끝났어요', detail, closed: true };
    }
  }

  if (place.availability === 'available') {
    return { tone: 'open', label: '지금 이용할 수 있어요', detail, closed: false };
  }
  if (place.availability === 'low') {
    return { tone: 'warn', label: '물품이 얼마 남지 않았어요', detail, closed: false };
  }
  return { tone: 'unknown', label: '가기 전에 전화로 확인해 주세요', detail, closed: false };
}

// ── 추천 순서 ────────────────────────────────────────────────────────────────

const AVAILABILITY_RANK = { available: 0, low: 1, unknown: 2 } as const;

/**
 * 추천 정렬. 기준은 순서대로 —
 *   1. 지금 문을 열었는가          (닫힌 곳은 지금 갈 수 없다)
 *   2. 받을 수 있는 물품이 있는가
 *   3. 가까운가                    (기준점이 있을 때만)
 *   4. 최근에 확인된 정보인가
 * 소진 확률·시간대 예측 같은 건 쓰지 않는다 — 그런 데이터가 없다.
 */
export function rankPlaces(places: CitizenPlace[], origin: LatLng | null, now: Date = new Date()): RankedPlace[] {
  return places
    .map((place) => ({
      ...place,
      distanceKm: origin ? distanceKm(origin, { lat: place.lat, lng: place.lng }) : null,
    }))
    .sort((a, b) => {
      const closedDiff = Number(resolvePlaceStatus(a, now).closed) - Number(resolvePlaceStatus(b, now).closed);
      if (closedDiff !== 0) return closedDiff;

      const availDiff = AVAILABILITY_RANK[a.availability] - AVAILABILITY_RANK[b.availability];
      if (availDiff !== 0) return availDiff;

      if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

/** 홈이 지도 위에 세우는 추천. 3곳을 넘기지 않는다 — 고를 것이 많으면 고르지 못한다. */
export function recommendPlaces(
  places: CitizenPlace[],
  origin: LatLng | null,
  limit = 3,
  now: Date = new Date(),
): RankedPlace[] {
  return rankPlaces(places, origin, now).slice(0, limit);
}

/**
 * 거리 숫자만. "2.5km" · "700m".
 * 100m 단위로 반올림한다 — GPS 오차와 동네 근사 중심좌표 둘 다 미터 단위 정밀도를
 * 보장하지 못하므로 "1,247m" 같은 거짓 정밀도를 보여주지 않는다.
 */
export function distanceText(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 100) * 100)}m`;
  return `${km.toFixed(1)}km`;
}

/** 지금 확인된 물품을 한 줄로. "즉석밥 · 라면 · 분유" 처럼 이름만 이어 붙인다. */
export function itemSummary(place: CitizenPlace, max = 4): string | null {
  if (place.items.length > 0) {
    const names = place.items.slice(0, max).map((i) => i.name);
    const rest = place.items.length - names.length;
    return rest > 0 ? `${names.join(' · ')} 외 ${rest}가지` : names.join(' · ');
  }
  return place.focusItem;
}

// ── 물품으로 찾기 ────────────────────────────────────────────────────────────

export interface ItemMatch {
  place: RankedPlace;
  /** 검색어·분류에 걸린 물품들. 거점 전체 재고가 아니라 "찾던 것" 만 보여주기 위한 값이다. */
  matched: PlaceItem[];
}

/**
 * 물품명 또는 분류로 거점을 찾는다.
 *
 * 결과 순서는 이미 정해 둔 추천 규칙(rankPlaces)을 그대로 따른다 —
 * 검색 화면이라고 해서 "이름순" 같은 다른 기준을 새로 만들지 않는다.
 * 지금 문을 닫았거나 물품이 없는 곳이 위로 올라오면 검색이 도움이 되지 않는다.
 */
export function findPlacesWithItem(
  places: CitizenPlace[],
  origin: LatLng | null,
  filter: { query?: string; group?: ItemGroup },
  now: Date = new Date(),
): ItemMatch[] {
  const query = filter.query?.trim().toLowerCase() ?? '';
  if (!query && !filter.group) return [];

  return rankPlaces(places, origin, now)
    .map((place) => ({
      place,
      matched: place.items.filter((item) =>
        query ? item.name.toLowerCase().includes(query) : item.category === filter.group,
      ),
    }))
    .filter((entry) => entry.matched.length > 0);
}
