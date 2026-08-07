# 화성특례시 행정구역 경계 데이터

`hwaseongDistricts.geo.json` 은 지도 폴리곤 렌더링에 사용하는 화성특례시 4개 구
(만세구·효행구·병점구·동탄구)의 행정동 경계 데이터입니다.

## 출처

- 원자료: 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr) 행정동 경계
  - 공공누리 제1유형(출처표시)
- 가공: [vuski/admdongkor](https://github.com/vuski/admdongkor) `ver20260701`
  - `HangJeongDong_ver20260701.geojson`, CC BY 4.0
- 좌표계: WGS84 (EPSG:4326)

> 본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로
> 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor),
> CC BY 4.0으로 배포됩니다.

## 가공 내용

`scripts/build-hwaseong-districts.mjs` 로 생성합니다.

```bash
curl -L -o /tmp/HangJeongDong.geojson \
  https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260701/HangJeongDong_ver20260701.geojson
node scripts/build-hwaseong-districts.mjs /tmp/HangJeongDong.geojson
```

- 원본 전국 파일(약 35MB)은 저장소에 포함하지 않습니다. 화성시 행정동 29개만 추출했습니다.
- 구 소속은 원본 `sggnm` 값(`화성시만세구 / 화성시효행구 / 화성시병점구 / 화성시동탄구`)을
  그대로 따릅니다. 행정동 경계 자체는 union 하지 않고 소속 구로 그룹핑만 합니다.
- 구 외곽선(`outline`)은 **단순화 전 원본 좌표에서 dissolve** 해 별도로 담습니다. 원본은 인접
  행정동끼리 정점을 공유하므로, 같은 구 안에서 무향 간선을 세면 내부 경계는 2번·구 외곽은 1번
  나타납니다. 1번만 나온 간선을 이어 붙여 외곽선을 얻습니다(폴리곤 클리핑 라이브러리 불필요).
  런타임 union 계산은 하지 않습니다.
- Douglas-Peucker 단순화(허용오차 0.0001도, 위도 37도 기준 약 8~9m)와 좌표 소수점 5자리
  반올림을 적용했습니다. 좌표 수 5,931 → 2,949 (구 외곽선 1,516 별도).
- 대각선 길이 0.004도(약 400m) 미만인 아주 작은 섬 링은 제외했습니다. 서해안 소규모 도서
  일부가 지도에 표시되지 않습니다.
- 구마다 `center`(클러스터 대표점)와 `focusBBox`(확대 범위)를 함께 생성합니다.
  - `center`: 구 전체의 면적 가중 중심점. 구 폴리곤 밖으로 나가면 최대 폴리곤의 내부점으로
    대체하고, 빌드 시 구 내부인지 검증합니다(밖이면 빌드 실패).
  - `focusBBox`: 면적 상위 폴리곤 98.5%까지만 담은 경계 상자. 제부도 등 서해 도서는 **폴리곤
    데이터에는 그대로 남고** 화면 확대 범위에서만 빠집니다.
- 좌표를 임의로 이동하거나 사각형·원형으로 대체한 부분은 없습니다.

## 정확도 한계

- 행정동(행정 운영 단위) 경계이며 법정동 경계와 다릅니다.
- 단순화 오차(원본 좌표 대비, 유지된 링 기준)는 평균 1.75m·최대 11.3m 입니다.
  허용오차 0.0003도였을 때는 평균 6.46m·최대 33.5m 였습니다.
  지적·행정 목적에는 사용할 수 없고, 대시보드 시각화 용도입니다.
- 단순화는 행정동마다 독립 적용하므로 인접 행정동의 공유 경계가 완전히 포개지지는 않습니다.
- `outline` 은 원본 좌표에서 dissolve 한 뒤 따로 단순화하므로, 읍면동 폴리곤의 바깥 변과
  평균 0.2m·최대 10.5m 어긋납니다.
- 구 소속 정보는 `ver20260701` 시점 기준입니다.

## 구조

```jsonc
{
  "meta": { "source": "...", "attribution": "...", "simplification": "..." },
  "bbox": [minLng, minLat, maxLng, maxLat],
  // 서해 도서를 뺀 본토 중심 확대 범위
  "focusBBox": [minLng, minLat, maxLng, maxLat],
  "districts": [
    {
      "id": "manse",
      "name": "만세구",
      "bbox": [minLng, minLat, maxLng, maxLat],
      "focusBBox": [minLng, minLat, maxLng, maxLat],
      // 구 폴리곤 내부가 보장된 클러스터 대표점
      "center": [lng, lat],
      // 읍면동 경계를 dissolve 한 구 외곽선. 링마다 폴리라인 1개로 그린다.
      "outline": [[[lng, lat], ...]],
      "areas": [
        {
          "name": "향남읍",
          "code": "4159125300",
          // polygons[i] = 폴리곤 1개, polygons[i][0] = 외곽 링, 이후는 구멍(hole)
          "polygons": [[[[lng, lat], ...]]]
        }
      ]
    }
  ]
}
```
