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
- 구 단위 경계는 **폴리곤 union으로 합치지 않았습니다.** 원본에 이미 `sggnm` 값으로
  `화성시만세구 / 화성시효행구 / 화성시병점구 / 화성시동탄구` 소속이 들어 있어, 행정동 경계를
  그대로 두고 소속 구로 그룹핑만 했습니다. 런타임 union 계산도 하지 않습니다.
- Douglas-Peucker 단순화(허용오차 0.0003도, 위도 37도 기준 약 25~30m)와 좌표 소수점 5자리
  반올림을 적용했습니다. 좌표 수 5,931 → 2,013.
- 대각선 길이 0.004도(약 400m) 미만인 아주 작은 섬 링은 제외했습니다. 서해안 소규모 도서
  일부가 지도에 표시되지 않습니다.
- 좌표를 임의로 이동하거나 사각형·원형으로 대체한 부분은 없습니다.

## 정확도 한계

- 행정동(행정 운영 단위) 경계이며 법정동 경계와 다릅니다.
- 단순화로 인해 실제 경계선과 최대 수십 미터 차이가 날 수 있습니다. 지적·행정 목적에는
  사용할 수 없고, 대시보드 시각화 용도입니다.
- 구 소속 정보는 `ver20260701` 시점 기준입니다.

## 구조

```jsonc
{
  "meta": { "source": "...", "attribution": "...", "simplification": "..." },
  "bbox": [minLng, minLat, maxLng, maxLat],
  "districts": [
    {
      "id": "manse",
      "name": "만세구",
      "bbox": [minLng, minLat, maxLng, maxLat],
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
