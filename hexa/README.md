# 헥사 블리츠 (HEXA BLITZ) 💎⚡

> **60초 매치3 블리츠** — 외국 바다·해변을 배경으로 8×8 보드에서 보석을 터뜨려 최고 점수에 도전하는 웹 게임입니다.
> 콤보·피버·블레이징 스피드, 7종 특수 보석, 드롭 아이템, 라스트 허라까지.

- **플레이** : https://rok0083.github.io/air2air/hexa/
- **기술** : HTML5 Canvas + Vanilla JS (ES Modules, 빌드 없음) + Firebase v10 (Firestore + 익명 로그인)
- **모드** : `blitz60` (60초)

---

## 1. 게임 방법

| 조작 | 방법 |
| --- | --- |
| 보석 교체 | 보석을 **드래그**(상하좌우) 하거나 **두 번 탭** |
| 부스터 | 화면 하단 버튼 (피버 게이지 소모) |
| 일시정지 | ⏸ 버튼 · `P` · `Esc` |

- 8×8 보드, 7가지 색 보석. 색약 접근성을 위해 **모양도 7가지**(원·다이아·사각·삼각·육각·별·하트)로 구분됩니다.
- 인접한 두 보석을 바꿔 **3개 이상** 같은 색을 맞추면 제거 → 위 보석 낙하 → 새 보석 보충 → **연쇄(cascade)**.
- 매치가 되지 않는 교체는 **되돌아갑니다**(bounce back).
- **60초** 제한, 남은 10초부터 경고음·붉은 시간 바.
- **3초** 동안 조작이 없으면 힌트 표시, **가능한 수가 없으면 자동 셔플**.
- 연쇄 중에도 다른 칸을 바로 조작할 수 있습니다(빠른 템포).
- 시간이 끝나면 **라스트 허라**: 보드에 남은 특수 보석을 순서대로 모두 발동해 마지막 점수를 더합니다.

### 점수 · 콤보 · 피버
| 요소 | 규칙 |
| --- | --- |
| 보석 1개 | 25점 (콤보·피버·블레이징·×2 배율 적용) |
| 콤보 | 1.5초 안에 다시 매치하면 콤보 +1, **배율 = 1 + 콤보 × 0.25** |
| 블레이징 스피드 | 3초 안에 콤보 5회 → 5초간 **점수 ×2 + 매치마다 인접 폭발** (화염 테두리) |
| 피버 | 게이지 충전(보석·콤보) → 가득 차면 **8초간 점수 ×3**, 특수 보석 생성률↑, 음악 변화 |
| 특수 보석 생성 | +200점, 발동 1회당 +60점 |
| 드롭 아이템 획득 | +120점 |

---

## 2. 특수 보석 (매치 모양으로 생성)

| 특수 보석 | 만드는 매치 | 효과 |
| --- | --- | --- |
| ⇔ **가로 줄 보석** | 세로 4매치 | 가로 한 줄 전체 제거 (빔) |
| ⇕ **세로 줄 보석** | 가로 4매치 | 세로 한 줄 전체 제거 (빔) |
| ✸ **폭탄 보석** | L / T 자 매치 | 3×3 폭발 **두 번** (2차는 반경 확대) |
| ✜ **프로펠러** | 2×2 사각 매치 | 자기 기준 십자 제거 + 목표 보석 1개로 날아가 파괴 |
| ◈ **하이퍼 큐브** | 5개 일렬 | 교체한 상대 보석과 **같은 색 전부** 제거 |
| ✷ **슈퍼노바** | 6개 이상 일렬 | **3줄 + 3열** 제거 |
| ★ **스타 보석** | +자 5매치 | 가로줄 + 세로줄 십자 제거 |

### 특수 + 특수 콤보 스왑
| 조합 | 결과 |
| --- | --- |
| 줄 + 줄 | 십자(가로+세로) 제거 |
| 줄 + 폭탄 | **3줄 + 3열** 제거 |
| 폭탄 + 폭탄 | **5×5** 제거 |
| 프로펠러 + 줄/폭탄 | 상대 특수를 **3개로 복제**해 목표 지점에서 연쇄 발동 |
| 프로펠러 + 프로펠러 | 3개로 분열해 **3곳**에서 연쇄 발동 |
| 하이퍼 + 줄/폭탄/프로펠러 | 그 색 **전부**를 해당 특수 보석으로 바꿔 발동 |
| 하이퍼 + 하이퍼 | **보드 전체** 제거 |
| 슈퍼노바 + 아무 특수 | **2배 범위**로 폭발 |

### 연쇄 반응
다른 특수 보석의 효과 범위에 특수 보석이 휩쓸리면 **연달아 발동**합니다(깊이 제한 60웨이브).

---

## 3. 드롭 아이템 (보석에 붙어 내려옴)

| 아이템 | 효과 |
| --- | --- |
| ⏱ **시간 보석** | 남은 시간 **+5초** (게임당 최대 3회) |
| ×2 **점수 ×2** | 10초간 점수 2배 |
| ⚡ **번개 보석** | 무작위 보석 **12개** 제거 (전기 아크) |
| 🌈 **무지개 보석** | 어떤 색과도 매치되는 **와일드카드** |
| 🎁 **보물 상자** | 무작위 특수 보석 **2개** 생성 |
| ❄ **얼음 보석** | **2번** 매치해야 깨짐 |
| 💣 **시한 폭탄** | 플레이 **5수** 안에 처리하지 못하면 폭발 + **-3초** |

- 새 보석이 생길 때 확률(기본 5.5%)로 붙으며, 보드에 최대 3개까지 동시에 존재합니다.

## 4. 부스터 (피버 게이지 소모)

| 부스터 | 소모 | 효과 |
| --- | --- | --- |
| 🔨 망치 | 30 | 원하는 보석 1개 파괴 |
| 🔀 셔플 | 25 | 보드 전체 재배치 (즉시 매치 없이) |
| ⏸️ 시간 정지 | 40 | 4초간 타이머 정지 |
| 💥 컬러 봄 | 50 | 고른 보석과 같은 색 모두 제거 |

---

## 5. 연출 · 사운드
- 풀링된 파티클, 빔(줄/열), 충격파, 프로펠러 비행, 전기 아크, 화면 플래시.
- 큰 폭발 시 **화면 흔들림 + 80ms 슬로모**.
- Web Audio API로 직접 합성한 효과음 — **콤보가 올라가면 음정 상승**, 피버 시 배경 음악 조성·템포 변화. 음소거 토글(🔊).
- 60fps 목표, 모바일 세로 화면 우선(가로·데스크톱도 대응).

---

## 6. 파일 구성

```
games/hexa/
├─ index.html            # 화면 마크업 (시작/게임/게임오버/랭킹)
├─ style.css             # 해변 배경 + 프로스트 유리 UI
├─ assets/
│  ├─ beach-bg.jpg       # 외국 바다·해변 배경
│  └─ og-base.png        # OG 원본 아트(소스)
├─ og-image.png          # 카카오톡 공유용 1200×630 (헥사 블리츠)
├─ js/
│  ├─ config.js          # ★ 모든 밸런스 수치 (한국어 주석)
│  ├─ board.js           # 8×8 보드 로직 + 렌더링 + 낙하/보충
│  ├─ specials.js        # 특수 보석 7종 + 콤보 스왑 + 연쇄
│  ├─ combos.js          # 콤보·블레이징·피버 게이지
│  ├─ effects.js         # 파티클/FX 풀
│  ├─ audio.js           # Web Audio 합성 효과음 + BGM
│  ├─ firebase-config.js # firebaseConfig (samsung-brick-breaker)
│  ├─ firebase.js        # 익명 로그인·점수 저장/조회·오프라인 대기열
│  ├─ leaderboard.js     # 랭킹 화면
│  └─ ui.js              # 화면·입력·타이머·부스터·라스트 허라
├─ screenshots/
├─ firebase.json
├─ firestore.rules
├─ firestore.indexes.json
└─ README.md
```

### 밸런스 조절
`js/config.js` 한 파일에서 조절합니다.
- `time.total` (제한 시간), `time.timeGemBonus`
- `score.perGem`, `score.specialCreated`
- `combo.windowMs`, `combo.step`
- `blaze` (콤보 수·유지 시간·배율), `fever` (충전량·지속·배율·특수 생성 부스트)
- `items.spawnChance`, 각 아이템 확률/효과
- `boosters` 소모 게이지
- `anim` (교체 120ms·제거 150ms·낙하 가속)

---

## 7. Firebase

프로젝트 : **samsung-brick-breaker** (Spark, 계정 `air2air2@gmail.com`) — 벽돌깨기 게임과 같은 프로젝트를 재사용합니다.

- Authentication → **익명 로그인** 사용 설정 ✅
- Cloud Firestore → 위치 `asia-southeast1` (Singapore) ✅
- 보안 규칙 → `firestore.rules` 게시 ✅
  - 읽기 공개, 생성은 `request.auth.uid == data.uid` + `name` 2~12자 + `score` 0~5,000,000 정수 + `mode == "blitz60"` + `createdAt == request.time`
  - **수정·삭제 금지**
- 복합 색인 → `firestore.indexes.json` (4종) ✅
  - `score ↓ + createdAt ↓` (오늘/주간)
  - `roomCode ↑ + score ↓` (우리 방)
  - `createdAt ↑ + score ↓`
  - `roomCode ↑ + createdAt ↑ + score ↓`
- 웹 앱 `hexa-game` 의 `firebaseConfig` → `js/firebase-config.js` ✅

> 다른 Firebase 프로젝트에 배포하려면 `js/firebase-config.js` 의 값을 그 프로젝트 웹 앱 설정으로 바꾸고, 같은 이름의 `scores` 규칙·색인을 게시하면 됩니다. 값이 `YOUR_…` 같은 플레이스홀더면 게임은 **로컬 전용 모드**로 동작합니다.

### scores 문서 구조
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `uid` | string | 익명 로그인 UID |
| `name` | string | 닉네임 (2~12자) |
| `score` | int | 점수 (0~5,000,000) |
| `maxCombo` | int | 최고 콤보 |
| `specialsCreated` | int | 만든 특수 보석 수 |
| `combosTriggered` | int | 콤보 달성 횟수 |
| `mode` | string | `blitz60` 고정 |
| `roomCode` | string | 6자리 방 코드, 없으면 `global` |
| `createdAt` | timestamp | `serverTimestamp()` |

### 쿼리
- 전체 : `orderBy('score','desc') limit 50`
- 오늘 / 주간 : `where('createdAt','>=',기준) + orderBy('score','desc') limit 50`
- 우리 방 : `where('roomCode','==',코드) + orderBy('score','desc') limit 50`

### 오프라인
저장 실패·오프라인 시 `localStorage` 대기열에 보관하고, 다음 실행·온라인 복귀·랭킹 조회 시 자동 재전송합니다.

---

## 8. 배포

### GitHub Pages (현재)
```bash
cp -r games/hexa/. work/github/air2air-deploy/hexa/
cd work/github/air2air-deploy
git add hexa && git commit -m "hexa blitz: ..." && git push origin master
```
→ https://rok0083.github.io/air2air/hexa/

### Firebase Hosting (선택)
```bash
npm i -g firebase-tools && firebase login
cd games/hexa
firebase deploy --only hosting,firestore:rules,firestore:indexes --project samsung-brick-breaker
```

## 9. 공유
- 게임 오버의 **[공유]** → Web Share API 또는 클립보드 복사.
- 방 코드가 있으면 `?room=CODE` 가 붙어 친구가 열면 자동 입력됩니다.
- 카카오톡 미리보기 이미지 : `og-image.png` (1200×630)
