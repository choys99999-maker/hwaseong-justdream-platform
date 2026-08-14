// 관리자 재고 빠른 입력 — 자연어 문장을 품목별 현재재고로 읽는다.
//
// `analyze-donation-image` 와 같은 구조다. (Supabase Edge Function + Gemini + responseSchema)
// 새 외부 서비스를 붙이지 않고 이미 쓰고 있는 AI 경로를 그대로 재사용한다.
//
// 이 함수가 죽거나 배포되어 있지 않아도 화면은 그대로 동작한다.
// 프런트(`src/store/inventoryUpdates.readInventoryText`)가 실패를 감지하면
// 규칙 기반 해석기(`src/utils/inventoryText.ts`)로 되돌아간다.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT = `당신은 지역 복지 물품 창고의 재고 담당자를 돕는 문장 해석기입니다.

담당자가 말하듯 적은 문장에서 "품목별로 지금 남아 있는 수량(현재재고)"만 뽑아내세요.

규칙
- 반드시 문장에 실제로 적힌 것만 반환하세요. 없는 품목이나 수량을 지어내지 마세요.
- "다 나갔다", "떨어졌다", "없다", "소진" 처럼 남은 것이 없다는 뜻이면 stock 을 0 으로 하세요.
- "3개 들어왔다"(입고), "3개 나갔다"(출고) 처럼 들어오거나 나간 양만 말한 경우에는
  남은 수량을 알 수 없으므로 stock 을 null 로 두세요.
- 수량을 알 수 없거나 애매하면 stock 을 null 로 두세요. 추측하지 마세요.
- knownItems 목록에 있는 이름과 같은 물건이면 그 목록의 이름을 그대로 쓰세요.
  ('쌀 10kg' 처럼 이름 안에 숫자가 들어 있는 품목이 있습니다. 그 숫자는 수량이 아닙니다.)
- note 에는 그 판단의 근거가 된 문장 조각을 그대로 넣으세요.
- 재고와 무관한 문장은 무시하세요.`;

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_name: { type: 'string' },
          stock: { type: 'integer', nullable: true },
          note: { type: 'string', nullable: true },
        },
        required: ['item_name'],
      },
    },
  },
  required: ['items'],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { text, knownItems } = await req.json();
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return json({ error: 'text required' }, 400);
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) return json({ error: 'GEMINI_API_KEY not configured' }, 500);

    const known = Array.isArray(knownItems)
      ? knownItems.filter((v: unknown): v is string => typeof v === 'string').slice(0, 200)
      : [];

    const userText =
      `knownItems: ${known.length > 0 ? JSON.stringify(known) : '(없음)'}\n` +
      `문장: ${text.trim()}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${PROMPT}\n\n${userText}` }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
        }),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const out = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!out) throw new Error('Empty Gemini response');

    return json(JSON.parse(out));
  } catch (err) {
    console.error('parse-inventory-text:', err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
