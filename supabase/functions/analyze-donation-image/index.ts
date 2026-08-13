import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT = `당신은 지역 복지 물품 기부 등록을 도와주는 이미지 분석 도우미입니다.

사진에 보이는 실제 기부 물품만 식별하세요.
시민이 직접 입력하지 않아도 되도록 일반적인 한국어 품목명을 반환하세요.
브랜드보다 품목 종류를 우선하세요. 예: "신라면 농심 봉지라면" → "라면"
사진에서 명확하게 셀 수 있을 때만 수량을 추정하세요.
수량이 불명확하면 null을 반환하세요.
사진만으로 알 수 없는 상태, 안전성, 유통기한, 기부 가능 여부를 추측하지 마세요.
여러 종류가 있다면 items 배열에 각각 반환하세요.
판단하기 어렵다면 needs_review를 true로 반환하세요.`;

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          category: { type: 'string', enum: ['식품', '생활용품', '위생용품', '유아용품', '기타'] },
          quantity: { type: 'integer', nullable: true },
        },
        required: ['name', 'category'],
      },
    },
    needs_review: { type: 'boolean' },
    message: { type: 'string', nullable: true },
  },
  required: ['items', 'needs_review'],
};

function uint8ToBase64(arr: Uint8Array): string {
  let s = '';
  const chunk = 8192;
  for (let i = 0; i < arr.length; i += chunk) {
    s += String.fromCharCode(...arr.subarray(i, Math.min(i + chunk, arr.length)));
  }
  return btoa(s);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { imagePath } = await req.json();
    if (!imagePath || typeof imagePath !== 'string') {
      return json({ error: 'imagePath required' }, 400);
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) return json({ error: 'GEMINI_API_KEY not configured' }, 500);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: blob, error: dlErr } = await sb.storage
      .from('donation-photos')
      .download(imagePath);
    if (dlErr || !blob) throw new Error(`Storage download failed: ${dlErr?.message ?? 'no data'}`);

    const imageBase64 = uint8ToBase64(new Uint8Array(await blob.arrayBuffer()));

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      throw new Error(`Gemini ${geminiRes.status}: ${errBody.slice(0, 200)}`);
    }

    const geminiData = await geminiRes.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');

    return json(JSON.parse(text));
  } catch (err) {
    console.error('analyze-donation-image:', err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
