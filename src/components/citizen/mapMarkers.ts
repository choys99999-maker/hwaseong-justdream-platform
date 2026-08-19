import type { DistrictId } from '../../types';
import type { CitizenPlace } from '../../data/citizenDirectory';
import { districtBoundaries } from '../../data/districtBoundaries';
import { resolvePlaceStatus, STATUS_SHORT_LABEL, type StatusTone } from '../../utils/citizenPlace';

/**
 * 시민 지도의 거점 마커 · 구역 묶음 카드를 만드는 곳.
 *
 * 왜 이 파일이 따로 있는가 —
 * 카카오 지도(`CitizenMap`)는 CustomOverlay 에 넣을 **DOM 요소**가 필요하고,
 * 대체 지도(`StaticCitizenMap`)는 같은 모양을 **JSX** 로 그린다. 두 곳이 각자 마크업을
 * 들고 있으면 한쪽만 커지거나 상태 색이 어긋난다. 그래서 클래스 이름·데이터 속성·문구를
 * 여기 한 곳에서 정하고, 카카오 쪽만 DOM 생성 함수를 가져다 쓴다.
 *
 * 마커는 "점" 이 아니라 **이름표가 붙은 캡슐 버튼**이다. 멀리서도 무엇인지 읽히고,
 * 캡슐 전체(아이콘 + 이름 + 상태말)가 하나의 터치 목표가 된다.
 */

/**
 * 상태 아이콘 자리에 넣는 글리프.
 * 색만으로 상태를 말하지 않는다는 규칙(StatusLine)을 지도에서도 지킨다 — 모양이 서로 다르다.
 */
export const TONE_GLYPH: Record<StatusTone, string> = {
  open: '✓',
  warn: '!',
  unknown: '?',
  closed: '휴',
};

export interface MarkerView {
  tone: StatusTone;
  /** 아이콘 원 안의 글자. 추천 순위가 있으면 호출자가 숫자로 덮어쓴다. */
  glyph: string;
  /** 캡슐 두 번째 줄. "물품 부족" 처럼 짧게. */
  statusText: string;
  /** 지도에서 먼저 눈에 띄어야 하는 순서(0 이 가장 강함). CSS 가 아니라 여기서 정한다. */
  priority: number;
}

/** 물품 부족 > 확인 필요 > 정상 > 운영 종료. 중요한 거점이 배경에 묻히지 않게 하는 기준. */
const TONE_PRIORITY: Record<StatusTone, number> = { warn: 0, unknown: 1, open: 2, closed: 3 };

export function markerViewOf(place: CitizenPlace, now?: Date): MarkerView {
  const status = resolvePlaceStatus(place, now);
  return {
    tone: status.tone,
    glyph: TONE_GLYPH[status.tone],
    statusText: STATUS_SHORT_LABEL[status.tone],
    priority: TONE_PRIORITY[status.tone],
  };
}

/** 마커 하나의 접근성 이름. 스크린리더도 "무엇 · 지금 어떤 상태" 를 같이 듣는다. */
export function markerAriaLabel(place: CitizenPlace, view: MarkerView, rank: number | null): string {
  const prefix = rank !== null ? `추천 ${rank}순위 ` : '';
  return `${prefix}${place.displayName} — ${view.statusText}`;
}

// ── 카카오 지도용 DOM ────────────────────────────────────────────────────────

export interface MarkerElement {
  root: HTMLButtonElement;
  /** 순위가 정해지면 글리프를 숫자로 바꿔야 해서 따로 들고 있는다. */
  icon: HTMLSpanElement;
}

/**
 * 거점 마커 하나.
 *
 * 구조는 `캡슐(아이콘 + 이름 + 상태말) + 꼬리` 다. 꼬리 끝이 실제 좌표를 가리키므로
 * CustomOverlay 는 `yAnchor: 1` 로 붙인다. 클릭 판정은 캡슐 겉넓이가 아니라
 * CSS `::before` 로 사방 12px 더 넓힌 영역이 맡는다(`.cj-marker::before`).
 */
export function createMarkerElement(place: CitizenPlace): MarkerElement {
  const view = markerViewOf(place);

  const root = document.createElement('button');
  root.type = 'button';
  root.className = 'cj-marker';
  root.dataset.tone = view.tone;
  root.dataset.priority = String(view.priority);
  root.dataset.selected = 'false';
  root.dataset.zoomed = 'false';
  root.dataset.clustered = 'false';
  root.dataset.dim = 'false';
  root.setAttribute('aria-label', markerAriaLabel(place, view, null));

  const body = document.createElement('span');
  body.className = 'cj-marker-body';

  const icon = document.createElement('span');
  icon.className = 'cj-marker-icon';
  icon.textContent = view.glyph;
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'cj-marker-text';

  const name = document.createElement('span');
  name.className = 'cj-marker-name';
  name.textContent = place.displayName;

  const status = document.createElement('span');
  status.className = 'cj-marker-status';
  status.textContent = view.statusText;

  text.append(name, status);
  body.append(icon, text);

  const tail = document.createElement('span');
  tail.className = 'cj-marker-tail';
  tail.setAttribute('aria-hidden', 'true');

  root.append(body, tail);
  return { root, icon };
}

// ── 구역 묶음(클러스터) ──────────────────────────────────────────────────────

export interface ClusterSummary {
  districtId: DistrictId;
  districtName: string;
  count: number;
  /** 이 구역에서 물품이 부족한 거점 수. 0 이면 부제에 쓰지 않는다. */
  alertCount: number;
  lat: number;
  lng: number;
  placeIds: string[];
}

const DISTRICT_NAME = new Map(districtBoundaries.map((d) => [d.id, d.name]));

/**
 * 멀리서 볼 때 쓸 구역 단위 요약.
 *
 * 개별 좌표를 격자로 묶으면 "왜 이 셋이 한 덩어리인지" 를 설명할 수 없다. 구(區)로 묶으면
 * 카드에 `효행구 3곳` 처럼 사용자가 아는 말을 쓸 수 있고, 눌렀을 때 갈 곳도 분명해진다.
 */
export function summarizeByDistrict(places: CitizenPlace[], now?: Date): ClusterSummary[] {
  const groups = new Map<DistrictId, CitizenPlace[]>();
  places.forEach((place) => {
    const bucket = groups.get(place.district);
    if (bucket) bucket.push(place);
    else groups.set(place.district, [place]);
  });

  return [...groups.entries()].map(([districtId, members]) => ({
    districtId,
    districtName: DISTRICT_NAME.get(districtId) ?? '화성시',
    count: members.length,
    alertCount: members.filter((p) => resolvePlaceStatus(p, now).tone === 'warn').length,
    lat: members.reduce((sum, p) => sum + p.lat, 0) / members.length,
    lng: members.reduce((sum, p) => sum + p.lng, 0) / members.length,
    placeIds: members.map((p) => p.id),
  }));
}

export function clusterSubText(summary: ClusterSummary): string {
  return summary.alertCount > 0 ? `물품 부족 ${summary.alertCount}곳` : `거점 ${summary.count}곳`;
}

/** 구역 묶음 카드. 숫자 하나만 떠 있는 배지가 아니라 "어디에 몇 곳" 이 읽히는 카드다. */
export function createClusterElement(summary: ClusterSummary): HTMLButtonElement {
  const root = document.createElement('button');
  root.type = 'button';
  root.className = 'cj-cluster-card';
  root.dataset.alert = String(summary.alertCount > 0);
  root.setAttribute(
    'aria-label',
    `${summary.districtName} 거점 ${summary.count}곳${
      summary.alertCount > 0 ? `, 물품 부족 ${summary.alertCount}곳` : ''
    } — 눌러서 이 구역 거점 보기`,
  );

  const count = document.createElement('span');
  count.className = 'cj-cluster-count';
  count.textContent = String(summary.count);
  count.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'cj-cluster-text';

  const name = document.createElement('span');
  name.className = 'cj-cluster-name';
  name.textContent = summary.districtName;

  const sub = document.createElement('span');
  sub.className = 'cj-cluster-sub';
  sub.textContent = clusterSubText(summary);

  text.append(name, sub);
  root.append(count, text);
  return root;
}

/** 내 위치 표시. 거점 마커와 헷갈리지 않게 주황 점 하나로만 둔다. */
export function createMyLocElement(): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'cj-my-loc';
  const dot = document.createElement('div');
  dot.className = 'cj-my-loc-dot';
  wrap.appendChild(dot);
  return wrap;
}
