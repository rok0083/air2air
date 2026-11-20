# 헥사(HEXA) 💎

> 외국 바다·해변을 배경으로 즐기는 **6×13 보석 퍼즐** — 세로 3개 블록을 떨어뜨려 가로·세로·대각선 3매치를 만들고, 연쇄(CHAIN)와 피버로 점수를 쌓아 친구들과 겨루는 웹 게임입니다.

- **플레이 주소** : https://rok0083.github.io/air2air/hexa/
- **기술 스택** : HTML5 Canvas + Vanilla JavaScript (ES Modules, 빌드 없음) + Firebase JS SDK v10 (Firestore + 익명 로그인)
- **참고** : 벽돌깨기(삼성고 동문회) 게임은 `https://rok0083.github.io/air2air/samsung-high-brick-breaker/` 로 완전히 분리되어 있습니다.

---

## 1. 게임 방법

| 조작 | 키보드 | 모바일 |
| --- | --- | --- |
| 좌우 이동 | `←` `→` | 좌우 스와이프 |
| 회전 (위→가운데→아래 색 순환) | `↑` 또는 `Space` | 화면 탭(짧게 톡) |
| 소프트 드롭 | `↓` | – |
| 하드 드롭 | `Shift` | 아래로 스와이프 |
| 아이템 사용 | `1` `2` `3` | 화면 하단 아이템 버튼 |
| 일시정지 | `P` / `Esc` | ⏸ 버튼 |

### 규칙
- 보드는 **가로 6칸 × 세로 13칸**, **세로 3개짜리 보석 블록**이 떨어집니다.
- 보석 색은 **6종**, **레벨 10부터 7종**으로 늘어납니다.
- 같은 색이 **가로·세로·대각선으로 3개 이상** 붙으면 제거되고, 위 보석이 내려오며 **다시 판정(연쇄)** 합니다.
- **맨 위 줄 중앙 열이 막히면 게임 오버** (쉴드가 있으면 1회 방어).
- **보석 30개 제거마다 레벨 업**, 낙하 속도가 점점 빨라집니다.

### 점수
- 보석 1개 = **10점 × 레벨**
- 연쇄 배율(뿌요뿌요식) : 1연쇄 ×1, 2연쇄 ×2, 3연쇄 ×4, 4연쇄 ×8 … (최대 ×64)
- **4개 이상 동시 매치 보너스 ×1.5**, **대각선 매치 보너스 +20%**
- **피버 게이지** : 연쇄·제거로 충전, 가득 차면 **10초간 점수 ×3** + 화면 연출

### 아이템 (좋은 아이템 17종)
| # | 아이템 | 효과 |
| --- | --- | --- |
| 1 | 🔮 매직 보석 | 착지 지점 아래 보석과 같은 색을 전부 제거 |
| 2 | 💣 폭탄 | 착지 지점 3×3 제거 |
| 3 | ↔️ 가로 레이저 | 한 줄 전체 제거 |
| 4 | ↕️ 세로 레이저 | 한 열 전체 제거 |
| 5 | ✳️ 십자 폭발 | 가로+세로 동시 제거 |
| 6 | 🌈 무지개 보석 | 어떤 색과도 매치되는 와일드카드 보석 생성 |
| 7 | ⚡ 번개 | 무작위 보석 10개 제거 |
| 8 | 🔨 망치 | 원하는 보석 1개를 골라 파괴 |
| 9 | ⏸️ 시간 정지 | 5초간 낙하 정지 |
| 10 | 🐢 슬로우 | 15초간 낙하 속도 절반 |
| 11 | 🎨 컬러 체인저 | 다음 블록을 모두 같은 색으로 |
| 12 | 🧲 자석 | 지정 색 보석을 바닥으로 끌어모음 |
| 13 | 🧹 바닥 정리 | 아래 3줄 제거 |
| 14 | 🛡️ 쉴드 | 게임 오버 1회 방지 (발동 시 위쪽 5줄 제거) |
| 15 | 🚀 점수 부스터 | 20초간 점수 ×2 |
| 16 | 🔀 셔플 | 보드 전체 재배치 (바로 매치되지 않게) |
| 17 | 👁️ 미래시 | 30초간 NEXT 5개 표시 |

- 보석을 제거하면 **기본 12%**(연쇄 1단계마다 +5%, 최대 45%) 확률로 아이템이 인벤토리(3칸)에 들어옵니다.
- 인벤토리가 가득 차면 **가장 오래된 아이템이 자동 발동**됩니다.

### 방해 아이템 (7종, 자동 발생)
| # | 방해 | 효과 |
| --- | --- | --- |
| 1 | 🪨 돌 블록 | 매치되지 않는 돌 1줄 (인접 매치로 파괴) |
| 2 | ⛰️ 바닥 상승 | 쓰레기 2줄이 밑에서 올라옴 |
| 3 | ⏩ 가속 | 10초간 낙하 속도 2배 |
| 4 | 🌑 어둠 | 10초간 보드 상단 절반 가림 |
| 5 | 🔄 조작 반전 | 8초간 좌우 반전 |
| 6 | 🔒 잠금 보석 | 랜덤 보석 3개 잠금 (2회 매치해야 제거) |
| 7 | 🎭 색 혼란 | 10초간 두 색이 비슷하게 보임 |

- 첫 방해는 약 22초 후, 이후 27초 주기이며 **레벨이 오를수록 주기가 짧아집니다**(레벨당 -1.8초, 최소 9초). 레벨업 시 70% 확률로 한 번 더 발생합니다.

---

## 2. 파일 구성

```
games/hexa/
├─ index.html              # 화면 마크업 (시작 / 게임 / 게임오버 / 랭킹)
├─ style.css               # 해변 배경 + 프로스트 유리 UI
├─ assets/
│  ├─ beach-bg.jpg         # 외국 바다·해변 배경
│  └─ og-base.png          # OG 원본 아트
├─ og-image.png            # 카카오톡 공유용 1200×630
├─ js/
│  ├─ config.js            # ★ 아이템 확률·점수·속도·피버 등 모든 밸런스
│  ├─ items.js             # 아이템 17종 + 방해 7종 + Web Audio 효과음
│  ├─ game.js              # 게임 엔진 (보드·매치·연쇄·피버·렌더)
│  ├─ firebase-config.js   # firebaseConfig
│  ├─ firebase.js          # 익명 로그인 · 점수 저장/조회 · 오프라인 대기열
│  ├─ leaderboard.js       # 랭킹 화면 (전체/오늘/주간/우리 방)
│  └─ ui.js                # 화면 전환 · 입력 · HUD
├─ screenshots/            # 검증 스크린샷
├─ firebase.json           # Firebase Hosting 설정
├─ firestore.rules         # Firestore 보안 규칙
├─ firestore.indexes.json  # 복합 색인 정의
└─ README.md
```

### 밸런스 조절
모든 수치는 `js/config.js` 한 곳에서 바꿀 수 있습니다.
- `items.weights` : 좋은 아이템 등장 확률(가중치)
- `items.dropBaseChance` / `dropChainBonus` : 아이템 생성 확률
- `obstacles` : 방해 아이템 시작 시간·주기·가중치
- `score` : 보석 점수, 연쇄 배율표, 보너스
- `fever` : 피버 게이지 충전량·지속시간·배율
- `speed` : 레벨별 낙하 속도
- `effects` : 각 아이템 지속시간

---

## 3. Firebase 설정 (이미 완료된 상태)

프로젝트 : `samsung-brick-breaker` (Spark 무료 요금제, 계정 `air2air2@gmail.com`)

1. **Authentication → 로그인 방법 → 익명** 사용 설정 ✅
2. **Cloud Firestore** 생성 — 위치 `asia-southeast1` (Singapore) ✅
3. **보안 규칙** 게시 — `firestore.rules` ✅
   - 읽기 공개, 생성은 `request.auth.uid == data.uid` + 이름 2~12자 + 점수 0~10,000,000 정수 + `createdAt == request.time`, 수정·삭제 금지
4. **복합 색인** — `firestore.indexes.json` 과 동일한 3종 ✅
   - `roomCode ↑ + score ↓`
   - `createdAt ↑ + score ↓`
   - `roomCode ↑ + createdAt ↑ + score ↓`
5. **웹 앱 등록** (`hexa-game`) → `firebaseConfig` 를 `js/firebase-config.js` 에 입력 ✅

### 데이터 구조 (`scores` 컬렉션)
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `uid` | string | 익명 로그인 UID |
| `name` | string | 닉네임 (2~12자) |
| `score` | int | 점수 (0~10,000,000) |
| `level` | int | 도달 레벨 |
| `maxChain` | int | 최고 연쇄 |
| `itemsUsed` | int | 사용한 아이템 수 |
| `playTimeSec` | int | 플레이 시간(초) |
| `roomCode` | string | 방 코드 6자리, 없으면 `global` |
| `createdAt` | timestamp | `serverTimestamp()` |

### 랭킹 쿼리
- 전체 : `orderBy('score','desc') limit 50`
- 오늘 / 주간 : `where('createdAt','>=',기준시각) + orderBy('score','desc') limit 50`
- 우리 방 : `where('roomCode','==',코드) + orderBy('score','desc') limit 50`

### 오프라인 처리
- 저장 실패(또는 오프라인) 시 `localStorage` 대기열에 보관 → 다음 실행·온라인 복귀·랭킹 조회 시 자동 재전송.

---

## 4. 배포

### GitHub Pages (현재 사용 중)
```bash
cp -r games/hexa/. work/github/air2air-deploy/hexa/
cd work/github/air2air-deploy
git add hexa && git commit -m "hexa: 헥사 게임 배포" && git push origin master
```
`https://rok0083.github.io/air2air/hexa/`

### Firebase Hosting (선택)
```bash
npm i -g firebase-tools
firebase login
firebase deploy --only hosting,firestore:rules,firestore:indexes --project samsung-brick-breaker
```
(`firebase.json` 의 `hosting.public` 이 `"."` 이므로 `games/hexa` 폴더에서 실행)

---

## 5. 공유

- 게임 오버 화면의 **[친구에게 공유]** → Web Share API(모바일) 또는 클립보드 복사.
- 방 코드가 있으면 공유 링크에 `?room=CODE` 가 붙어, 친구가 열면 방 코드가 자동 입력됩니다.
- 카카오톡 미리보기 이미지는 `og-image.png` (1200×630).
