// 자연어 재고 문장 해석기 회귀 테스트.
//
// 통과 기준은 "그럴듯하게 읽는다"가 아니라
//   (1) 확실한 문장은 정확히 읽고
//   (2) 애매한 문장은 값을 지어내지 않고 stock=null 로 남긴다
// 이다. AI 없이도 이 경로만으로 기능이 동작해야 하므로 여기서 막는다.
//
//   npm run test:inventory-text
import { parseInventoryText } from '../src/utils/inventoryText';

interface Expected {
  itemName: string;
  stock: number | null;
}

interface Case {
  name: string;
  text: string;
  knownItems?: string[];
  expect: Expected[];
}

const CASES: Case[] = [
  {
    name: '요구사항 예시 — 잔량과 소진이 한 문장에',
    text: '우유 3개 남았고 즉석밥은 다 나갔어요',
    expect: [
      { itemName: '우유', stock: 3 },
      { itemName: '즉석밥', stock: 0 },
    ],
  },
  {
    name: '등록된 품목명 안에 숫자가 있어도 수량과 헷갈리지 않는다',
    text: '쌀 10kg 40개 남았어요',
    knownItems: ['쌀 10kg', '라면 1박스', '담요 1매'],
    expect: [{ itemName: '쌀 10kg', stock: 40 }],
  },
  {
    name: '사전 없이는 이름 속 숫자를 수량으로 읽는다 (사전이 필요한 이유)',
    text: '쌀 10kg 40개 남았어요',
    expect: [{ itemName: '쌀', stock: 10 }],
  },
  {
    name: '쉼표로 나눈 여러 품목',
    text: '라면 1박스 20개, 담요 1매 없어요',
    knownItems: ['쌀 10kg', '라면 1박스', '담요 1매'],
    expect: [
      { itemName: '라면 1박스', stock: 20 },
      { itemName: '담요 1매', stock: 0 },
    ],
  },
  {
    name: '우리말 수 표현',
    text: '우유 두 개 남았어요',
    expect: [{ itemName: '우유', stock: 2 }],
  },
  {
    name: '입고 표현은 잔량으로 단정하지 않는다',
    text: '분유 3개 들어왔어요',
    expect: [{ itemName: '분유', stock: null }],
  },
  {
    name: '출고 수량도 잔량으로 단정하지 않는다',
    text: '기저귀 5개 배부했어요',
    expect: [{ itemName: '기저귀', stock: null }],
  },
  {
    name: '수량이 아예 없으면 비워 둔다',
    text: '휴지 확인 부탁해요',
    expect: [{ itemName: '휴지 확인 부탁해요', stock: null }],
  },
  {
    name: '수량만 말해도 재고 화면이므로 잔량으로 읽는다',
    text: '고구마 7개',
    expect: [{ itemName: '고구마', stock: 7 }],
  },
  {
    name: '조사를 떼도 두 글자 이름은 살아 있어야 한다',
    text: '오이 5개 남았어요',
    expect: [{ itemName: '오이', stock: 5 }],
  },
  {
    name: '한 글자 이름 + 조사',
    text: '쌀은 다 나갔어요',
    expect: [{ itemName: '쌀', stock: 0 }],
  },
  {
    name: '같은 품목을 두 번 말하면 나중 값이 이긴다',
    text: '우유 3개 남았어요. 아 우유는 5개예요',
    expect: [{ itemName: '우유', stock: 5 }],
  },
  {
    name: '0 은 정상적인 값이다',
    text: '분유 0개 남았어요',
    expect: [{ itemName: '분유', stock: 0 }],
  },
  {
    name: '재고 없음 표현',
    text: '담요 재고 없어요',
    knownItems: ['담요 1매'],
    expect: [{ itemName: '담요', stock: 0 }],
  },
  {
    name: '빈 문장',
    text: '   ',
    expect: [],
  },
];

let failed = 0;

for (const testCase of CASES) {
  const result = parseInventoryText(testCase.text, testCase.knownItems ?? []);
  const actual: Expected[] = result.lines.map((l) => ({ itemName: l.itemName, stock: l.stock }));

  const ok =
    actual.length === testCase.expect.length &&
    actual.every(
      (a, i) => a.itemName === testCase.expect[i].itemName && a.stock === testCase.expect[i].stock,
    );

  if (ok) {
    console.log(`  ok  ${testCase.name}`);
  } else {
    failed++;
    console.log(`FAIL  ${testCase.name}`);
    console.log(`      입력   : ${testCase.text}`);
    console.log(`      기대   : ${JSON.stringify(testCase.expect)}`);
    console.log(`      실제   : ${JSON.stringify(actual)}`);
    if (result.leftovers.length > 0) {
      console.log(`      남은 것: ${JSON.stringify(result.leftovers)}`);
    }
  }
}

console.log('');
if (failed > 0) {
  console.log(`${CASES.length}건 중 ${failed}건 실패`);
  process.exit(1);
}
console.log(`${CASES.length}건 모두 통과`);
