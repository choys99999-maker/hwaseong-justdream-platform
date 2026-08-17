/**
 * 거점 라벨 겹침 완화.
 *
 * 카카오맵 오버레이와 SDK 없는 대체 지도가 같은 DOM 구조(`.gj-marker` + `.gj-marker-label`)를
 * 쓰므로 배치 계산도 한 곳에서 공유한다.
 */

/**
 * 라벨 배치 후보. 오른쪽을 기본으로 하고, 이미 놓인 라벨·마커와 겹치면 순서대로 옮긴다.
 * 후보를 다 써도 자리가 없으면 이름을 숨기지 않고 겹침 면적이 가장 작은 자리를 쓴다.
 */
export const LABEL_PLACES = [
  'right',
  'left',
  'bottom',
  'top',
  'bottom-right',
  'top-right',
  'bottom-left',
  'top-left',
] as const;
export type LabelPlace = (typeof LABEL_PLACES)[number];

/** 다른 거점의 원형 마커를 덮는 것이 라벨끼리 겹치는 것보다 나쁘므로 가중치를 준다. */
const DOT_OVERLAP_WEIGHT = 3;

/** 원형 마커 중심에서 라벨 변까지의 거리(px). CSS 의 calc(100% + 5px) 와 맞춘다. */
const LABEL_OFFSET = 11;
/** 대각선 배치의 중심-변 거리(px). CSS 의 calc(100% + 3px) 와 맞춘다. */
const DIAGONAL_OFFSET = 9;
/** 원형 마커가 차지하는 반경(px). 라벨이 다른 거점의 점을 덮지 않도록 장애물로 넣는다. */
const DOT_RADIUS = 8;
/** 겹침 판정 여유(px) */
const COLLISION_SLACK = 2;

/** 배치 대상. 지도 구현이 달라도 이 세 가지만 있으면 된다. */
export interface LabelTarget {
  element: HTMLElement;
  label: HTMLElement;
  /** 현재 화면에 붙어 있는지. false 면 계산에서 제외한다. */
  visible: boolean;
}

interface LabelBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** true 면 다른 거점의 원형 마커 자리 */
  isDot?: boolean;
}

interface MeasuredMarker {
  target: LabelTarget;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

function labelBox(place: LabelPlace, m: MeasuredMarker): LabelBox {
  switch (place) {
    case 'right':
      return { left: m.cx + LABEL_OFFSET, top: m.cy - m.h / 2, right: m.cx + LABEL_OFFSET + m.w, bottom: m.cy + m.h / 2 };
    case 'left':
      return { left: m.cx - LABEL_OFFSET - m.w, top: m.cy - m.h / 2, right: m.cx - LABEL_OFFSET, bottom: m.cy + m.h / 2 };
    case 'bottom':
      return { left: m.cx - m.w / 2, top: m.cy + LABEL_OFFSET, right: m.cx + m.w / 2, bottom: m.cy + LABEL_OFFSET + m.h };
    case 'top':
      return { left: m.cx - m.w / 2, top: m.cy - LABEL_OFFSET - m.h, right: m.cx + m.w / 2, bottom: m.cy - LABEL_OFFSET };
    case 'bottom-right':
      return { left: m.cx + DIAGONAL_OFFSET, top: m.cy + DIAGONAL_OFFSET, right: m.cx + DIAGONAL_OFFSET + m.w, bottom: m.cy + DIAGONAL_OFFSET + m.h };
    case 'top-right':
      return { left: m.cx + DIAGONAL_OFFSET, top: m.cy - DIAGONAL_OFFSET - m.h, right: m.cx + DIAGONAL_OFFSET + m.w, bottom: m.cy - DIAGONAL_OFFSET };
    case 'bottom-left':
      return { left: m.cx - DIAGONAL_OFFSET - m.w, top: m.cy + DIAGONAL_OFFSET, right: m.cx - DIAGONAL_OFFSET, bottom: m.cy + DIAGONAL_OFFSET + m.h };
    case 'top-left':
      return { left: m.cx - DIAGONAL_OFFSET - m.w, top: m.cy - DIAGONAL_OFFSET - m.h, right: m.cx - DIAGONAL_OFFSET, bottom: m.cy - DIAGONAL_OFFSET };
  }
}

/** 두 사각형이 겹치는 넓이(px²). 여유(COLLISION_SLACK) 안쪽 스침은 0 으로 본다. */
function overlapArea(a: LabelBox, b: LabelBox): number {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left) - COLLISION_SLACK;
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) - COLLISION_SLACK;
  if (x <= 0 || y <= 0) return 0;
  return x * y * (b.isDot ? DOT_OVERLAP_WEIGHT : 1);
}

/**
 * 화면에 보이는 거점 라벨의 겹침을 배치 방향만 바꿔 줄인다.
 * 이름은 절대 숨기지 않는다. 8방향 어디에도 빈자리가 없으면 겹침 면적이 가장 작은 쪽을 쓴다.
 * (거점이 지나치게 몰린 구간은 확대하면 풀린다 — 확대 시 개별 거점이 우선이다)
 */
export function layoutLabels(targets: LabelTarget[]): void {
  const measured: MeasuredMarker[] = [];
  targets.forEach((target) => {
    if (!target.visible) return;
    const dot = target.element.getBoundingClientRect();
    const label = target.label.getBoundingClientRect();
    if (label.width === 0 || label.height === 0) return;
    measured.push({
      target,
      cx: dot.left + dot.width / 2,
      cy: dot.top + dot.height / 2,
      w: label.width,
      h: label.height,
    });
  });
  if (measured.length === 0) return;

  // 위 → 아래, 왼쪽 → 오른쪽 순으로 자리를 잡아 배치 결과가 재계산마다 흔들리지 않게 한다.
  measured.sort((a, b) => a.cy - b.cy || a.cx - b.cx);

  // 모든 거점의 원형 마커 자리를 먼저 장애물로 깔아 둔다.
  const occupied: LabelBox[] = measured.map((m) => ({
    left: m.cx - DOT_RADIUS,
    top: m.cy - DOT_RADIUS,
    right: m.cx + DOT_RADIUS,
    bottom: m.cy + DOT_RADIUS,
    isDot: true,
  }));

  measured.forEach((m) => {
    let best: LabelPlace = LABEL_PLACES[0];
    let bestCost = Number.POSITIVE_INFINITY;
    for (const candidate of LABEL_PLACES) {
      const box = labelBox(candidate, m);
      const cost = occupied.reduce((sum, other) => sum + overlapArea(box, other), 0);
      if (cost < bestCost) {
        best = candidate;
        bestCost = cost;
      }
      if (bestCost === 0) break; // 앞선 후보에서 자리를 찾으면 더 볼 필요가 없다
    }
    occupied.push(labelBox(best, m));
    m.target.element.dataset.place = best;
  });
}

/**
 * 좌표가 완전히 같은 거점들의 **표시 위치**만 좌우로 벌리는 오프셋(px)을 계산한다.
 *
 * 같은 건물에 두 기관이 들어 있는 경우(예: 동탄대로8길 36 — 동탄노인복지관 / 동탄7동 협의체)
 * 카카오가 두 기관에 같은 좌표를 주기 때문에 원형 마커가 정확히 포개진다.
 * 실제 lat/lng 는 손대지 않고, 화면에서만 좌우로 밀어 각각 클릭할 수 있게 한다.
 *
 * id 정렬 기준으로 자리를 배분하므로 렌더링할 때마다 같은 결과가 나온다.
 */
export const COINCIDENT_STEP = 14;

export function computeCoincidentShifts(
  sites: Array<{ id: string; latitude: number; longitude: number }>,
): Map<string, number> {
  const groups = new Map<string, typeof sites>();
  sites.forEach((site) => {
    const key = `${site.latitude.toFixed(6)},${site.longitude.toFixed(6)}`;
    groups.set(key, [...(groups.get(key) ?? []), site]);
  });

  const shifts = new Map<string, number>();
  groups.forEach((group) => {
    if (group.length < 2) return;
    [...group]
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((site, index) => {
        // 그룹 중앙을 기준으로 좌우 대칭 배치한다. 2개면 -14px / +14px.
        shifts.set(site.id, (index - (group.length - 1) / 2) * (COINCIDENT_STEP * 2));
      });
  });
  return shifts;
}
