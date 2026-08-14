/**
 * 자연어 재고 문장 해석기 (규칙 기반).
 *
 * "우유 3개 남았고 즉석밥은 다 나갔어요" → [우유 3, 즉석밥 0]
 *
 * 원칙
 *  1. **없는 값을 지어내지 않는다.** 수량을 못 읽으면 `stock = null` 로 두고 사유를 남긴다.
 *     확인 화면이 그 줄을 빨갛게 띄우고, 담당자가 직접 채우기 전에는 반영하지 않는다.
 *  2. **입고·출고 표현을 현재재고로 단정하지 않는다.** "3개 들어왔어요"는 입고지 잔량이 아니다.
 *     ("다 나갔어요" 처럼 잔량이 0 이라는 뜻이 분명한 표현만 0 으로 읽는다)
 *  3. **이미 등록된 품목명을 먼저 맞춰 본다.** 중앙 DB 품목은 '쌀 10kg', '라면 1박스'처럼
 *     이름 안에 숫자가 들어 있다. 사전 없이 숫자만 보면 '쌀'을 10개로 잘못 읽는다.
 *
 * 이 해석기는 AI 호출이 실패해도 항상 동작하는 기본 경로다. (store/inventoryUpdates 참고)
 */

/** 해석한 한 줄. */
export interface ParsedInventoryLine {
  itemName: string;
  /** 읽어낸 현재재고. null 이면 못 읽었다는 뜻이다. */
  stock: number | null;
  /** 이 줄이 문장의 어느 부분에서 나왔는지 */
  sourceText: string;
  /** 이미 등록된 품목명과 그대로 맞았는지 */
  matchedKnownItem: boolean;
  /** 담당자가 확인해야 할 사유 */
  issue?: string;
}

export interface InventoryTextParseResult {
  lines: ParsedInventoryLine[];
  /** 품목으로 읽지 못하고 남은 조각. 조용히 버리지 않고 화면에 돌려준다. */
  leftovers: string[];
}

// ── 표현 사전 ──────────────────────────────────────────────

/** 잔량이 0 이라는 뜻이 분명한 표현만 넣는다. */
const ZERO_RE =
  /다\s*(?:나갔|나감|나가|떨어졌|떨어짐|떨어져|소진|썼|쓴|비웠|비움)|소진(?:됐|되었|했)|품절|바닥(?:났|이야|입니다)|동났|하나도\s*없|남은\s*(?:것|게|거)?\s*없|재고\s*(?:가)?\s*없|없어요|없습니다|없네|없음|없다|끝났/;

/** 입고(들어온 양) 표현. 잔량과 다르다. */
const INBOUND_RE = /들어왔|들어옴|들어온|입고|받았|받음|보충|채웠|채움/;

/** 출고(나간 양) 표현. 잔량과 다르다. */
const OUTBOUND_RE = /나갔|나감|나간|배부|출고|줬|나눠|나눔|불출|지급|지원했/;

/** 잔량 표현. 숫자가 현재재고라는 근거가 된다. */
const REMAIN_RE = /남았|남아|남은|남습|보유|재고|있어요|있습니다|있음|있네|가지고\s*있/;

/** 수량 뒤에 붙는 단위. 이름 일부와 수량을 가르는 데 쓴다. */
const UNIT = '개|박스|봉지|봉|팩|포|병|캔|장|매|세트|셋트|통|줄|묶음|입|인분|kg|g|ml|l|킬로|리터|ea';

/** "한 개", "두 박스" 같은 우리말 수 표현. 흔한 것만 받는다. */
const KOREAN_NUMBERS: Record<string, number> = {
  영: 0, 공: 0,
  한: 1, 하나: 1, 일: 1,
  두: 2, 둘: 2, 이: 2,
  세: 3, 셋: 3, 서: 3,
  네: 4, 넷: 4, 너: 4,
  다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10,
};

/** 한 글자짜리 품목명. 조사를 떼면 한 글자가 남는 이름이 실제로 있다. */
const ONE_CHAR_ITEMS = new Set([
  '쌀', '김', '물', '밥', '빵', '죽', '콩', '떡', '잼', '국', '면', '술', '옷', '약', '차', '유',
]);

const TRAILING_PARTICLE_RE = /(?:은|는|이|가|을|를|도|만|의|에서|에게|에|와|과|이랑|랑|부터|까지)$/;
const LEADING_FILLER_RE = /^(?:그리고|그리구|그리고요|또|또는|근데|그런데|그럼|이제|아|음|어|저|일단)\s+/;
const TRAILING_NOUN_RE = /\s*(?:현재\s*재고|현재고|재고|수량|잔량|남은\s*수량)$/;

// ── 도우미 ────────────────────────────────────────────────

/** 비교용으로 공백·대소문자를 지운 형태와, 그 위치가 원문 어디였는지의 표. */
function squeeze(text: string): { squeezed: string; positions: number[] } {
  let squeezed = '';
  const positions: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) continue;
    squeezed += ch.toLowerCase();
    positions.push(i);
  }
  return { squeezed, positions };
}

/**
 * 품목명에서 조사·군더더기를 뗀다.
 * 조사를 떼서 한 글자만 남으면(예: '오이' → '오') 원래 이름을 그대로 둔다.
 * 다만 '쌀', '김'처럼 실제로 쓰는 한 글자 이름은 예외로 허용한다.
 */
export function cleanItemName(raw: string, knownItems: readonly string[] = []): string {
  let s = raw.trim().replace(LEADING_FILLER_RE, '').trim();
  s = s.replace(TRAILING_NOUN_RE, '').trim();
  if (!s) return '';

  const known = new Set(knownItems.map((k) => squeeze(k).squeezed));
  const stripped = s.replace(TRAILING_PARTICLE_RE, '').trim();
  if (stripped && stripped !== s) {
    if (known.has(squeeze(stripped).squeezed)) return stripped;
    if (stripped.length >= 2 || ONE_CHAR_ITEMS.has(stripped)) return stripped;
  }
  return s;
}

interface QuantityHit {
  value: number;
  /** 원문에서 이 수량 표현이 시작한 위치 */
  index: number;
}

/** 조각에서 첫 수량 표현을 찾는다. 아라비아 숫자를 우리말 수보다 먼저 본다. */
function findQuantity(text: string): QuantityHit | null {
  const digit = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${UNIT})?`, 'i').exec(text);
  if (digit) {
    const value = Number(digit[1]);
    if (Number.isFinite(value)) return { value, index: digit.index };
  }

  const words = Object.keys(KOREAN_NUMBERS).sort((a, b) => b.length - a.length).join('|');
  const korean = new RegExp(`(?:^|\\s)(${words})\\s*(?:${UNIT})`, 'i').exec(text);
  if (korean) {
    return { value: KOREAN_NUMBERS[korean[1]], index: korean.index + korean[0].indexOf(korean[1]) };
  }
  return null;
}

/** 문장을 "품목 하나"씩의 조각으로 나눈다. */
function splitClauses(text: string): string[] {
  const marked = text
    .replace(/[,;·、\n\r]+/g, '|')
    .replace(/\s*(?:그리고|그리구|및|이고요|이구요)\s*/g, '|')
    // "~남았고 " 처럼 연결어미 '고'로 이어 붙인 문장을 끊는다.
    .replace(/(았|었|있|없|남|왔|감|짐|났)고\s+/g, '$1|')
    .replace(/(?:요|다|음)\.\s*/g, '|');
  return marked
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
}

/** 조각 안에서 이미 등록된 품목명을 찾는다. 긴 이름을 먼저 본다. */
function matchKnownItem(
  clause: string,
  knownItems: readonly string[],
): { name: string; start: number; end: number } | null {
  const { squeezed, positions } = squeeze(clause);
  const sorted = [...knownItems].filter(Boolean).sort((a, b) => b.length - a.length);

  for (const item of sorted) {
    const target = squeeze(item).squeezed;
    if (!target) continue;
    const at = squeezed.indexOf(target);
    if (at < 0) continue;
    return {
      name: item,
      start: positions[at],
      end: positions[at + target.length - 1] + 1,
    };
  }
  return null;
}

function readStock(
  context: string,
  itemNameForMessage: string,
): { stock: number | null; issue?: string } {
  if (ZERO_RE.test(context)) return { stock: 0 };

  const qty = findQuantity(context);
  if (qty === null) {
    return {
      stock: null,
      issue: `${itemNameForMessage}의 수량을 읽지 못했습니다. 직접 입력해 주세요.`,
    };
  }

  // 잔량이라는 근거가 있으면 그대로 쓴다.
  if (REMAIN_RE.test(context)) return { stock: qty.value };

  // 근거 없이 입고·출고 표현만 있으면 현재재고로 단정하지 않는다.
  if (INBOUND_RE.test(context)) {
    return {
      stock: null,
      issue: '들어온 수량(입고) 표현이라 남은 재고로 단정하지 않았습니다. 지금 남은 수량을 입력해 주세요.',
    };
  }
  if (OUTBOUND_RE.test(context)) {
    return {
      stock: null,
      issue: '나간 수량(출고) 표현이라 남은 재고로 단정하지 않았습니다. 지금 남은 수량을 입력해 주세요.',
    };
  }

  // "우유 3개" 처럼 수량만 말한 경우 — 재고 입력 화면이므로 남은 수량으로 읽는다.
  return { stock: qty.value };
}

// ── 본체 ──────────────────────────────────────────────────

/**
 * 재고 문장을 품목별 현재재고로 해석한다.
 *
 * @param text       담당자가 말하듯 쓴 문장
 * @param knownItems 그 읍면동에 이미 등록된 품목명. 있으면 정확도가 크게 오른다.
 */
export function parseInventoryText(
  text: string,
  knownItems: readonly string[] = [],
): InventoryTextParseResult {
  const normalized = (text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!normalized) return { lines: [], leftovers: [] };

  const lines: ParsedInventoryLine[] = [];
  const leftovers: string[] = [];

  for (const clause of splitClauses(normalized)) {
    const known = matchKnownItem(clause, knownItems);

    if (known) {
      const tail = clause.slice(known.end);
      const tailHasValue = findQuantity(tail) !== null || ZERO_RE.test(tail);
      // 이름 뒤쪽에 수량 표현이 없으면, 이름만 지운 조각 전체를 다시 본다. ("40개 남은 건 쌀 10kg")
      const context = tailHasValue
        ? tail
        : `${clause.slice(0, known.start)} ${clause.slice(known.end)}`;
      const { stock, issue } = readStock(context, known.name);
      lines.push({ itemName: known.name, stock, sourceText: clause, matchedKnownItem: true, issue });
      continue;
    }

    // 처음 보는 품목 — 수량(또는 소진 표현)이 시작하는 지점 앞을 이름으로 본다.
    const zero = ZERO_RE.exec(clause);
    const qty = findQuantity(clause);
    let cut: number;
    if (zero && qty) cut = Math.min(zero.index, qty.index);
    else if (zero) cut = zero.index;
    else if (qty) cut = qty.index;
    else cut = clause.length;

    const rawName = clause.slice(0, cut);
    const itemName = cleanItemName(rawName, knownItems);
    if (!itemName) {
      leftovers.push(clause);
      continue;
    }

    const { stock, issue } = readStock(clause.slice(cut) || clause, itemName);
    lines.push({ itemName, stock, sourceText: clause, matchedKnownItem: false, issue });
  }

  return { lines: dedupe(lines), leftovers };
}

/** 같은 품목을 두 번 말하면 나중 값이 이긴다. 자리는 처음 나온 곳을 지킨다. */
function dedupe(lines: ParsedInventoryLine[]): ParsedInventoryLine[] {
  const byKey = new Map<string, number>();
  const out: ParsedInventoryLine[] = [];
  for (const line of lines) {
    const key = squeeze(line.itemName).squeezed;
    const at = byKey.get(key);
    if (at === undefined) {
      byKey.set(key, out.length);
      out.push(line);
    } else {
      out[at] = { ...line, sourceText: `${out[at].sourceText} / ${line.sourceText}` };
    }
  }
  return out;
}
