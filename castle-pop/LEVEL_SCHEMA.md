# LEVEL_SCHEMA.md — 캐슬 팝 레벨 JSON 스키마

레벨은 `levels/area{1~5}/level{1~20}.json` 에 하나씩 저장합니다.
모든 경로는 상대 경로이며, 게임은 `fetch()` 로 읽습니다.

```json
{
  "id": 1,
  "area": 1,
  "level": 1,
  "name": "1-1",
  "moves": 10,
  "colors": 4,
  "cols": 9,
  "rows": 8,
  "difficulty": "normal",
  "goals": [{ "type": "box", "count": 27 }],
  "obstacles": [
    { "type": "box", "x": 0, "y": 5, "hp": 1 },
    { "type": "colorBox", "x": 3, "y": 5, "w": 2, "h": 2, "hp": 2, "color": "red" }
  ],
  "blocked": [],
  "tutorial": "swap",
  "intro": null,
  "drops": 3,
  "seed": 1013
}
```

## 필드

| 필드 | 형식 | 설명 |
| --- | --- | --- |
| `moves` | int | 이동 수(1 이상). 봇이 클리어율 목표 범위에 맞춰 조정 |
| `colors` | 2~5 | 사용하는 조각 색 수. 초반 5레벨은 4색(연쇄가 잘 일어나도록) |
| `cols` / `rows` | 5~9 / 5~10 | 기본 9×8 |
| `difficulty` | `normal`\|`hard`\|`veryhard` | 보통 / 어려움(보라) / 매우 어려움(붉은). 어려움·매우 어려움은 보상 2배 |
| `goals` | 배열 | 1~4개. 아래 표 참고 |
| `obstacles` | 배열 | 장애물·색 상자 배치 |
| `blocked` | [[x,y],…] | 보드에서 구멍인 칸(조각이 생기지 않음) |
| `tutorial` | 문자열\|null | `swap`·`rocket`·`tnt`·`propeller`·`light`·`combo`·`booster` (1구역 1~7레벨 안내) |
| `intro` | 장애물 type\|null | 첫 등장 안내 팝업 강제 표시 |
| `drops` | int | 보너스 드롭(코인·+2 이동·별·선물) 개수(평균 2~4) |
| `seed` | int | 초기 보드 난수 시드(재현용) |

## 목표(goals)

```json
{ "type": "box", "count": 27 }
{ "type": "colorBox", "count": 4 }
{ "type": "grass", "count": 12 }
{ "type": "collect", "color": "red", "count": 30 }
{ "type": "letter", "count": 2 }        // 우체통에서 편지 수집
{ "type": "bird", "count": 2 }          // 새 둥지 구출
```

장애물 이름을 `type` 으로 쓰면 그 장애물 제거가 목표가 됩니다.
`collect` 는 지정한 색 조각을 `count` 개 터뜨리는 목표입니다.

## 장애물(obstacles)

| `type` | 이름 | hp | blocksFall | 색 조건 | 비고 |
| --- | --- | --- | --- | --- | --- |
| `box` | 나무 상자 | 1~4 | ✅ | – | 옆 매치·파워업으로 한 겹씩 |
| `colorBox` | 색 상자 | 1~4 | ✅ | ✅ 같은 색만 | `w`·`h` 로 1×1~3×3, `color` 필수 |
| `grass` | 풀밭 | 1 | ✕ | – | 그 칸에서 매치하면 베임 |
| `mailbox` | 우체통 | 2 | ✅ | – | 부수면 편지 +1, 금고 열쇠 |
| `vase` | 꽃병 | 2 | ✅ | – | 두 번 맞으면 깨짐 |
| `chain` | 사슬 | 1~2 | ✕ | – | 조각 이동 잠금 |
| `ice` | 얼음 | 1~2 | ✕ | – | 조각 이동 잠금 |
| `birdNest` | 새 둥지 | 2 | ✅ | – | 부수면 아기 새 +1 |
| `honey` | 꿀 | 1 | ✕ | – | 2턴마다 한 칸 번짐 |
| `safe` | 금고 | 3 | ✅ | – | 편지(열쇠)로 피해 |
| `curtain` | 커튼 | 1 | ✕ | – | 그 줄을 가림 |

장애물 공통 인터페이스(`js/obstacles/index.js`):
`hp`, `size`, `blocksFall`, `onAdjacentMatch(color)`, `onPowerupHit`, `onTurnEnd`.

## 검증

```bash
node tools/autoplay-bot.mjs --validate          # 빈 칸 0 · 가능한 수 존재 · 목표 존재
node tools/autoplay-bot.mjs --level 7 --area 2 --sims 200
```

검증 항목: 시작 보드에 즉시 매치가 없고, 빈 칸이 0이며, 최소 한 개의 가능한 수가 존재하고,
`goals` 총합이 0보다 커야 합니다(실패 시 exit code 1).
