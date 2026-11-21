# 레벨 JSON 스키마 — 헥사 킹덤

모든 스테이지는 `levels/world{N}/level{M}.json` 에 있습니다.
값은 게임이 `./levels/...` **상대 경로**로 읽으므로 GitHub Pages 하위 경로에서도 동작합니다.

```jsonc
{
  "id": "w1-3",                 // 고유 id (w{world}-{level})
  "world": 1,                   // 1~5
  "level": 3,                   // 1~20
  "name": "이슬 맺힌 길",         // 화면에 보이는 이름
  "story": "저주가 남긴 장애물을 걷어내요.",
  "cols": 8,                    // 보드 가로 (기본 8)
  "rows": 8,                    // 보드 세로 (기본 8)
  "colors": 5,                  // 사용하는 보석 색 수 (4~6)
  "moves": 22,                  // 이동 수
  "stars": [3200, 5600, 8300],  // 2성/3성 점수 기준 (1성은 클리어 시 자동)
  "goals": [                    // 1개 이상
    { "type": "collect", "color": 1, "count": 20 },
    { "type": "clear",   "obstacle": "bush", "count": 5 },
    { "type": "drop",    "count": 2, "item": "seed" },
    { "type": "boss" }
  ],
  "cells": [                    // 장애물 배치 (선택)
    { "r": 4, "c": 6, "type": "bush", "hp": 2 }
  ],
  "voids": [[3, 3]],            // 보석이 없는 구멍 칸 (선택)
  "presets": [                  // 시작 시 놓이는 특수 보석 (선택)
    { "r": 7, "c": 0, "type": "rocket", "dir": "h", "color": 2 }
  ],
  "items": [                    // 시작 시 놓이는 드롭 아이템 (선택)
    { "r": 7, "c": 7, "item": "acorn" }
  ],
  "seed": 14073,                // 보드 생성 시드(같은 값 = 같은 배치)
  "boss": {                     // 보스 스테이지일 때
    "name": "슬라임 경비대장",
    "hp": 140,
    "summon": "bush",           // 2수마다 소환할 장애물
    "summonEvery": 2,
    "kind": "slime"             // 초상화 종류 slime|golem|sphinx|vine|shadow
  },
  "generator": { "version": "1.0.0", "seed": 14073, "obstacles": 4, "free": 60 },
  "analysis": { "validated": true, "problems": [], "free": 60, "hasMove": true, "blockedRatio": 0.05 }
}
```

## 목표(goals)

| type | 필드 | 설명 |
| --- | --- | --- |
| `collect` | `color`(0~5), `count` | 해당 색 보석을 N개 제거 |
| `clear` | `obstacle`(종류 또는 `"any"`), `count` | 장애물 N개 파괴 |
| `drop` | `count` | 마법 씨앗을 N개 바닥까지 떨어뜨리기 |
| `boss` | — | `boss.hp` 를 0으로 (보석 1개당 피해 1, 특수 발동 4) |

## 장애물 타입

| 월드 | type | hp | 특징 |
| --- | --- | --- | --- |
| 1 | `bush` | 1~2 | 막는 칸, 인접 매치로 피해 |
| 1 | `crate` | 2 | 막는 칸, 단단함 |
| 1 | `grass` | 1 | 덮는 칸, 그 보석을 매치 |
| 2 | `ice` | 2 | 덮는 칸, 매치마다 한 겹 |
| 2 | `snowman` | 3 | 막는 칸 |
| 2 | `icicle` | 2 | 막는 칸, 턴 종료 시 아래로 떨어질 수 있음 |
| 3 | `sand` | 1 | 덮는 칸, 3수마다 번짐 |
| 3 | `jar` | 2 | 막는 칸, 파괴 시 특수 보석 생성 |
| 3 | `cactus` | 2 | 막는 칸 |
| 4 | `vine` | 2 | 덮는 칸 |
| 4 | `fruitTree` | 2 | 막는 칸, 파괴 시 드롭 아이템 |
| 4 | `swamp` | 1 | 덮는 칸, 매치 점수 0.7배 |
| 5 | `shadowStone` | 2 | 막는 칸, 파괴 시 보스 피해 |
| 5 | `shadowRune` | 2 | 덮는 칸 |

`cells` 의 `hp` 를 적으면 그 층수로 시작합니다(예: 2단 덤불).

## 검증 규칙 (tools/level-generator.mjs)

생성 시 아래를 자동 검사하고 `analysis` 에 기록합니다.

1. 시작 보드에 3개 이상 연속 매치가 없음
2. 가능한 교체가 1개 이상 있음
3. 막는 칸(overlay 제외)이 전체의 35% 이하
4. 목표 `clear` 의 개수가 배치된 장애물 수 이하
5. 보스 목표가 있으면 `boss` 정의가 있음

```bash
node tools/level-generator.mjs --world 2 --level 5   # 한 개 출력
node tools/level-generator.mjs --all --out levels    # 전체 생성
```

## 밸런스 가이드

- `collect` 는 이동 수 × 1.2~1.5 색 하나당(예: 22수 → 18~24개)이 적당합니다.
- `clear` 는 배치 장애물의 60~80% 를 목표로 두면 여유가 있습니다.
- `drop` 은 2수마다 아이템이 하나씩 떨어지므로 이동 수 20 이상에서 2~3개가 적당합니다.
- 보스 HP 는 이동 수 × 4~5 수준(30수 → 120~150)이 첫 도전에 맞습니다.
