import { mockInventoryItems } from './mockInventory';

/**
 * 지원 물품 카탈로그.
 *
 * `mockInventory.ts` 는 "거점 × 품목" 단위 재고 레코드라 `id`(inv-001 …)가 품목이 아니라
 * 재고 행의 식별자다. (쌀 10kg 이 inv-001 / inv-011 / inv-018 로 세 번 나온다)
 * 이용자 물품지원에는 품목 자체의 고유 식별자가 필요하므로, 재고 데이터의 품목명을
 * 유일 키로 접어서 별도 카탈로그를 만든다.
 *
 * - itemId   : 품목 고유 식별자. 재고·출고 연동 시 조인 키가 된다.
 * - itemName : 화면 표시명. 둘을 같은 값으로 쓰지 않는다.
 *
 * 아래 표에 없는 품목명이 재고에 새로 생기면 모듈 로딩 시점에 바로 터뜨린다.
 * (조용히 넘어가면 이용자 지원 이력이 재고와 어긋난 채 쌓인다)
 */
export interface SupportItemCatalogEntry {
  itemId: string;
  itemName: string;
  unit: string;
}

const ITEM_ID_BY_NAME: Record<string, { itemId: string; unit: string }> = {
  '쌀 10kg': { itemId: 'item-rice-10kg', unit: '포' },
  '생리대 세트': { itemId: 'item-sanitary-pad-set', unit: '세트' },
  '즉석밥 세트': { itemId: 'item-instant-rice-set', unit: '세트' },
  '통조림 세트': { itemId: 'item-canned-set', unit: '세트' },
  '밑반찬 세트': { itemId: 'item-side-dish-set', unit: '세트' },
  '라면 1박스': { itemId: 'item-ramen-box', unit: '박스' },
  '기저귀 대형': { itemId: 'item-diaper-large', unit: '팩' },
  '위생용품 세트': { itemId: 'item-hygiene-set', unit: '세트' },
  '분유 800g': { itemId: 'item-formula-800g', unit: '캔' },
  '담요 1매': { itemId: 'item-blanket', unit: '매' },
  '부탄가스 8입': { itemId: 'item-butane-8', unit: '팩' },
  '생필품 꾸러미': { itemId: 'item-daily-kit', unit: '꾸러미' },
};

function buildCatalog(): SupportItemCatalogEntry[] {
  const seen = new Set<string>();
  const catalog: SupportItemCatalogEntry[] = [];

  for (const item of mockInventoryItems) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);

    const mapped = ITEM_ID_BY_NAME[item.name];
    if (!mapped) {
      throw new Error(
        `supportItemCatalog: 품목 '${item.name}' 의 itemId 가 없습니다. ITEM_ID_BY_NAME 에 추가하세요.`,
      );
    }
    catalog.push({ itemId: mapped.itemId, itemName: item.name, unit: mapped.unit });
  }

  return catalog.sort((a, b) => a.itemName.localeCompare(b.itemName, 'ko'));
}

export const SUPPORT_ITEM_CATALOG: SupportItemCatalogEntry[] = buildCatalog();

export function findCatalogEntry(itemId: string): SupportItemCatalogEntry | undefined {
  return SUPPORT_ITEM_CATALOG.find((entry) => entry.itemId === itemId);
}
