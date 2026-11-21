# 캐슬 팝 (CASTLE POP) 🦁👑

> 사자 임금 **레오**와 부엉이 집사 **올리**가 퍼즐로 모은 별로 낡은 성을 한 구역씩 되살리는
> **로열 매치 스타일 매치-3 퍼즐**입니다. 5개 구역 100레벨, 파워업 4종과 조합 8종,
> 인게임 부스터 8종, 장애물 11종, 미니게임 5종, 실시간 랭킹까지 들어 있습니다.

- **플레이**: https://rok0083.github.io/air2air/castle-pop/
- **기술**: HTML5 Canvas + Vanilla JS (ES Modules, 빌드 없음) + Firebase v10 (익명 로그인 · Firestore)
- **화면**: 모바일 세로 우선(390×844 기준). 데스크톱에서는 가운데 480px 로 정렬됩니다.
- **그림·소리**: 외부 이미지·음원 파일 없이 전부 Canvas 벡터와 Web Audio 합성으로 그립니다.

---

## 1. 게임 흐름

```
홈(성) → [레벨 N] → 사전 팝업(목표·시작 부스터) → 레벨 플레이(1~3분)
      → 클리어(별 1개 + 코인 + 피날레) → [계속] → 다음 레벨
```

- **이동 수가 0이 되면** 남은 목표를 보여 주고 `+5 이동` 이어하기를 제안합니다. 거절하면 실패입니다.
- **목숨은 레벨 시작 시 차감되지 않습니다.** 실패하거나 도중에 나갈 때만 1개를 씁니다(최대 10, 10분에 1개 회복).
- 별은 홈의 **구역 과제**에 써서 성을 실제로 바꿉니다(분수·융단·샹들리에·깃발·왕좌…).

## 2. 조작

| 동작 | 설명 |
| --- | --- |
| 스와이프 | 칸 크기의 25%만 밀어도 교환됩니다(110ms) |
| 탭 → 탭 | 떨어진 칸을 차례로 탭해도 교환됩니다 |
| 파워업 탭 | 그 자리에서 즉시 발동(이동 1 소모) |
| 파워업 교환 | 조합 발동(로켓+로켓, TNT+TNT 9×9, 빛구슬+빛구슬 전체 정화 등) |
| 부스터 | 트레이를 좌우로 밀어 8종 중 선택. 이동 수를 쓰지 않습니다 |

연쇄가 진행되는 동안에도 **멈춰 있는 다른 조각은 바로 움직일 수 있습니다**(입력 전체 잠금 없음).

## 3. 폴더 구조

```
castle-pop/
├─ index.html            화면 껍데기(부팅·홈·레벨·팝업)
├─ css/style.css         밝은 왕실 테마(로열 블루 HUD·크림 패널·금색 리본)
├─ js/
│  ├─ config.js          모든 수치(속도·확률·보상·가격·이벤트 일정·Firebase)
│  ├─ main.js            부팅·배경·화면 전환·Firebase 동기화
│  ├─ core/              board · match · gravity (DOM 없음 — 봇이 그대로 사용)
│  ├─ powerups/          파워업 4종 생성·발동·모든 조합
│  ├─ obstacles/         장애물 11종 공통 인터페이스(hp·blocksFall·onAdjacentMatch…)
│  ├─ goals/             목표 정규화·아이콘·문구
│  ├─ boosters/          (config 의 boosters 정의를 사용)
│  ├─ meta/              profile(목숨·코인·별·연승·일일보상) · levels(로딩)
│  ├─ events/            미니게임 5종·이벤트 일정
│  ├─ anim/              트윈·타임라인·파티클 풀·화면 흔들림·줌
│  ├─ audio/             Web Audio 합성 BGM·효과음 30종
│  ├─ art/               벡터 그림(레오 6표정·올리·조각 5종·성 일러스트) + 스프라이트 캐시
│  ├─ firebase/          config · auth · store · rankings
│  └─ ui/                home · game · prelevel · ranking · settings · dom
├─ levels/area1~5/level1~20.json   레벨 100개(area1 은 손설계, 2~5 는 생성·검증)
├─ levels/balance-report.json      봇 200회 시뮬레이션 밸런스 리포트
├─ tools/                레벨 생성기 · 자동 플레이 봇 · 밸런스 리포트 · 로컬 검증
├─ firestore.rules       기존 hexa/hexa-kingdom 규칙 유지 + cp_* 추가(게시 완료)
├─ firestore.indexes.json
└─ firebase.json
```

## 4. 레벨과 밸런스

- 레벨은 데이터 주도입니다: `levels/area{N}/level{M}.json` (스키마는 `LEVEL_SCHEMA.md`).
- 구역별 테마: 1 새벽 정원 성 · 2 호수 성 · 3 사막 성 · 4 서리 성 · 5 무지개 왕성.
- 난이도 3단계: 보통 / **어려움(보라)** / **매우 어려움(붉은)** — 어려운 레벨은 보상 2배.
- 10레벨마다 새 장애물이 등장하고, 처음 나올 때 한 장짜리 안내 팝업이 뜹니다.

### 자동 플레이 봇

```bash
# 레벨 하나 측정 (200회)
node tools/autoplay-bot.mjs --level 1 --area 1 --sims 200

# 100레벨 전부 검증(빈 칸 0 · 가능한 수 존재)
node tools/autoplay-bot.mjs --validate

# 이동 수 자동 조정 후 저장 (보통 70~85% / 어려움 40~55% / 매우 어려움 25~35%)
node tools/autoplay-bot.mjs --tune --area 1 --sims 40

# 전체 밸런스 리포트 생성
node tools/balance-report.mjs --sims 200
```

### 레벨 생성기

```bash
node tools/level-generator.mjs --all          # 100개 생성
node tools/level-generator.mjs --area 3       # 3구역만
node tools/level-generator.mjs --area 1 --level 5 --print
```

## 5. Firebase (기존 게임과 공존)

- 기존 **samsung-brick-breaker** 프로젝트의 Firestore 를 그대로 씁니다.
- 기존 컬렉션 `scores`(헥사 블리츠), `users`·`blitzScores`(헥사 킹덤) 규칙은 **한 글자도 바꾸지 않았습니다.**
- 캐슬 팝은 **cp_ 접두사**만 사용합니다.

| 컬렉션 | 용도 |
| --- | --- |
| `cp_users/{uid}` | 프로필(이름·레벨·별·코인·목숨·부스터·과제) |
| `cp_leaderboard/{uid}` | 전체/주간/우리 방 랭킹 |
| `cp_rooms/{code}` | 6자리 친구 방(`?room=CODE`) |
| `cp_gifts/{giftId}` | 친구끼리 목숨 선물 |
| `cp_rush/{uid}` | 번개 러시 주간 최고점 |
| `cp_races/{raceId}` | 하늘 경주 |

규칙 요약: **읽기는 공개(랭킹 공유), 쓰기는 본인 문서만**, 수치 범위 검증, **레벨은 한 번에 1씩만 증가**.
규칙은 콘솔에서 병합·게시했습니다(버전 기록 참고). 오프라인에서는 localStorage 에 저장하고 접속하면 동기화합니다.

## 6. 로컬에서 실행

ES Modules 를 쓰므로 파일을 직접 열지 말고 정적 서버로 열어 주세요.

```bash
cd castle-pop
python3 -m http.server 8765
# http://127.0.0.1:8765/
```

모바일 검증 하네스(390×844 · 오류 수집 · 스크린샷):

```bash
python3 tools/verify-local.py http://127.0.0.1:8765/index.html ./screenshots
```

## 7. 완성 기준(18번) 점검 결과

| 항목 | 결과 |
| --- | --- |
| 레벨 화면 배치·비율(4번 명세) | HUD 22%, 목표/이동 패널·아치 초상화·보드·부스터 트레이 배치 확인 |
| 밝고 선명한 화면, 어두운 패널 없음 | 모든 팝업이 크림 패널 + 금색 테두리 + 파란 리본 |
| 어떤 상황에서도 빈 칸 0 | 봇 100레벨 × 200회 · UI 플레이 모두 `emptyCells 0` |
| 연쇄 중 다른 조각 이동 | 입력 잠금 없음(정지 조각 즉시 스와이프) |
| 목숨은 실패 시에만 차감 | 시작 무료, 실패/나가기에서만 1개 |
| 파워업 조합 전부 동작 | 8조합 + 연쇄 반응, 조합마다 슬로모션·콜아웃·효과음 |
| 목표물이 목표 패널로 날아감 | `flyGoals` 곡선 비행 + 숫자 감소 + 완료 체크 |
| 피날레에서 남은 이동이 폭발 | 남은 이동 → 로켓/TNT 연쇄 + 코인 샤워 + 탭 건너뛰기 |
| 클리어율 목표 범위 | `levels/balance-report.json` 참고(92/100 이 목표 범위) |
| 60fps | DPR 반영 스프라이트 캐시·파티클 풀·"효과 줄이기" 옵션 |
| 다른 기기와 같은 랭킹 | cp_leaderboard + onSnapshot 실시간 갱신 |
