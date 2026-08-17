# hwaseong-justdream-platform

AI-powered integrated operations platform for Hwaseong Just Dream

## 실행

```bash
npm install
cp .env.example .env   # 필요한 값을 채운다 (비워 둬도 실행된다)
npm run dev
```

## 환경변수

`.env.example` 의 주석이 각 값의 의미와 없을 때의 동작을 설명한다. 요약:

| 변수 | 없을 때 |
| --- | --- |
| `VITE_KAKAO_MAP_JAVASCRIPT_KEY` | 지도가 **기본 경계 지도**(SVG)로 자동 전환된다. 구·거점 선택·필터·검색은 그대로 동작하고 도로·지명 배경만 없다. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | 자료 관리·집계 화면이 "중앙 저장소가 설정되지 않았습니다" 안내를 띄운다. |

## 지도가 안 보일 때

지도는 두 가지 구현을 갖고 있고, 카카오맵을 쓸 수 없으면 자동으로 두 번째로 내려간다.

1. **카카오맵** (`src/components/map/KakaoDistrictMap.tsx`) — 도로·지명 배경이 있는 정식 지도
2. **기본 경계 지도** (`src/components/map/StaticDistrictMap.tsx`) — 저장소에 포함된 화성시 행정동
   경계 GeoJSON(`src/data/geo/hwaseongDistricts.geo.json`)과 거점 좌표만으로 그리는 SVG 지도.
   외부 네트워크가 전혀 필요 없다. 시민 화면에는 `StaticCitizenMap.tsx` 가 같은 역할을 한다.

기본 경계 지도가 떴다면 지도 위에 이유가 한 줄로 표시된다. 확인 순서:

- **"카카오맵 키가 없어…"** → `.env` 의 `VITE_KAKAO_MAP_JAVASCRIPT_KEY` 를 채우고 개발 서버 재시작
- **"카카오맵을 불러오지 못해…"** → 대부분 **도메인 미등록**이다. 카카오 개발자 사이트
  [내 애플리케이션 > 플랫폼 > Web] 의 사이트 도메인에 지금 접속 중인 origin 을 추가한다.
  키가 유효해도 도메인이 없으면 SDK 초기화가 **에러 없이 멈추기** 때문에, 로더는 8초
  watchdog(`src/lib/kakaoMap.ts`)으로 이를 실패로 판정한다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 + 프로덕션 빌드 |
| `npm run lint` | oxlint |
| `npm run test:unit` | 엑셀 파싱 엔진 단위 테스트 |
