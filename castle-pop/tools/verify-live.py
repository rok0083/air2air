#!/usr/bin/env python3
"""라이브 검증 — https://rok0083.github.io/air2air/castle-pop/
   390x844 모바일 · 한 판 클리어 · 랭킹 확인 · 다른 세션과 같은 랭킹 · 회귀(hexa/hexa-kingdom)
"""
import os, sys, json
from playwright.sync_api import sync_playwright

BASE = "https://rok0083.github.io/air2air"
OUT = "/workspace/games/castle-pop/screenshots"
os.makedirs(OUT, exist_ok=True)

errors, failed = [], []


def dismiss(page, tries=5):
    for _ in range(tries):
        btn = (page.query_selector("#modal-root .panel .btn.green")
               or page.query_selector("#modal-root .panel .btn.gold")
               or page.query_selector("#modal-root .panel .btn.ghost")
               or page.query_selector("#modal-root .panel .panel-close"))
        if not btn:
            return
        try:
            btn.click(force=True)
        except Exception:
            return
        page.wait_for_timeout(450)


def play_level(page, name="상봉", shots=None, max_swipes=40):
    if page.query_selector("#name-input"):
        page.fill("#name-input", name)
        page.click("text=시작하기", force=True)
        page.wait_for_timeout(1200)
    dismiss(page)
    page.wait_for_timeout(600)
    if shots:
        page.screenshot(path=f"{OUT}/home.png")
    page.click("#play-btn", force=True)
    page.wait_for_timeout(800)
    if shots:
        page.screenshot(path=f"{OUT}/prelevel.png")
    page.click("text=플레이 ▶", force=True)
    page.wait_for_timeout(1700)
    dismiss(page)
    page.wait_for_timeout(500)
    if shots:
        page.screenshot(path=f"{OUT}/level1.png")
    mid = False
    for i in range(max_swipes):
        st = page.evaluate("""() => {
          const g = window.__castlepop?.game;
          if (!g || !g.board) return {noboard: true};
          return {ended: g.ended, moves: g.board.moves, empties: g.board.summary().emptyCells,
                  goals: g.board.goals.map(x => x.done + '/' + x.need), modal: !!document.querySelector('#modal-root .overlay')};
        }""")
        if st.get("noboard"):
            break
        if st.get("modal") and st.get("ended"):
            break
        if st.get("ended"):
            break
        hint = page.evaluate("""() => {
          const g = window.__castlepop.game;
          const h = g.board.findHint(); if (!h) return null;
          const a = g.cellPx(h.a[0], h.a[1]), b = g.cellPx(h.b[0], h.b[1]);
          const rect = g.boardCanvas.getBoundingClientRect();
          return {ax: rect.left + a.x, ay: rect.top + a.y, bx: rect.left + b.x, by: rect.top + b.y};
        }""")
        if not hint:
            page.wait_for_timeout(400)
            continue
        page.mouse.move(hint["ax"], hint["ay"])
        page.mouse.down()
        page.mouse.move((hint["ax"] + hint["bx"]) / 2, (hint["ay"] + hint["by"]) / 2, steps=3)
        page.mouse.move(hint["bx"], hint["by"], steps=3)
        page.mouse.up()
        page.wait_for_timeout(850)
        if shots and not mid and i > 1:
            page.screenshot(path=f"{OUT}/play.png")
            mid = True
    # 결과 팝업이 뜰 때까지 (피날레 연출 포함) 기다린다
    for _ in range(40):
        if page.query_selector("#modal-root .panel-ribbon"):
            break
        page.wait_for_timeout(500)
    page.wait_for_timeout(700)
    if shots:
        page.screenshot(path=f"{OUT}/result.png")
    res = page.evaluate("""() => {
      const g = window.__castlepop?.game;
      const p = JSON.parse(localStorage.getItem('castlePop.profile.v1') || '{}');
      return {won: g?.board?.goalComplete?.(), empties: g?.board?.summary().emptyCells,
              goals: g?.board?.goals.map(x => x.done + '/' + x.need), level: p.level, coins: p.coins,
              lives: p.lives, uid: p.uid, name: p.name,
              title: document.querySelector('#modal-root .panel-ribbon')?.textContent || null};
    }""")
    # 결과 팝업에서 홈으로 (계속 ▶ 를 눌러 다음 레벨로 가지 않도록)
    home_btn = page.query_selector("#modal-root .panel .btn.blue")
    if home_btn:
        home_btn.click(force=True)
    page.wait_for_timeout(2500)   # Firestore 저장 대기
    return res


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True, locale="ko-KR")
        page = ctx.new_page()
        page.on("console", lambda m: errors.append({"type": m.type, "text": m.text[:200]}) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append({"type": "pageerror", "text": str(e)[:200]}))
        page.on("requestfailed", lambda r: failed.append({"url": r.url, "err": r.failure}))

        page.goto(f"{BASE}/castle-pop/index.html", wait_until="load")
        page.wait_for_timeout(5000)
        first = play_level(page, "상봉", shots=True)
        print("SESSION1", json.dumps(first, ensure_ascii=False))

        # 랭킹 4탭 확인
        page.click("#home-tabs .tab[data-tab=rank]", force=True)
        page.wait_for_timeout(2500)
        page.screenshot(path=f"{OUT}/ranking.png")
        rank = page.evaluate("""() => {
          const rows = [...document.querySelectorAll('#modal-root .rank-row')].map(r => r.innerText.replace(/\\n/g,' '));
          return {rows: rows.slice(0,5), text: document.querySelector('#modal-root .rank-list')?.innerText.slice(0,200)};
        }""")
        print("RANK1", json.dumps(rank, ensure_ascii=False))
        dismiss(page, 2)

        # 두 번째 세션(다른 익명 uid) — 같은 랭킹에 보이는지
        ctx2 = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                   is_mobile=True, has_touch=True, locale="ko-KR")
        page2 = ctx2.new_page()
        page2.goto(f"{BASE}/castle-pop/index.html", wait_until="load")
        page2.wait_for_timeout(4500)
        second = play_level(page2, "둘째", shots=False, max_swipes=24)
        print("SESSION2", json.dumps(second, ensure_ascii=False))
        page2.click("#home-tabs .tab[data-tab=rank]", force=True)
        page2.wait_for_timeout(3000)
        rank2 = page2.evaluate("""() => [...document.querySelectorAll('#modal-root .rank-row')].map(r => r.innerText.replace(/\\n/g,' ')).slice(0,6)""")
        print("RANK2", json.dumps(rank2, ensure_ascii=False))

        # 회귀: hexa / hexa-kingdom
        for path in ["hexa/", "hexa-kingdom/"]:
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
            pg.on("requestfailed", lambda r: errs.append("REQFAIL " + r.url[-60:]))
            pg.goto(f"{BASE}/{path}", wait_until="load")
            pg.wait_for_timeout(4000)
            title = pg.evaluate("document.title")
            print(f"REGRESSION {path} title={title!r} errors={errs[:3]}")
            pg.close()

        # 검증 중 만든 내 문서 정리(본인 문서만 삭제 가능)
        for pg in (page, page2):
            try:
                res = pg.evaluate("""async () => {
                  const cfg = await import('./js/firebase/config.js');
                  const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
                  const uid = cfg.FB.uid;
                  if (!uid) return 'no-uid';
                  const out = [];
                  for (let round = 0; round < 3; round++) {
                    for (const col of ['cp_users', 'cp_leaderboard', 'cp_rush']) {
                      try { await fs.deleteDoc(fs.doc(cfg.FB.db, col, uid)); } catch (e) { /* skip */ }
                    }
                    await new Promise(r => setTimeout(r, 2600));   // 디바운스 저장이 다시 쓰는 것을 막고 재삭제
                  }
                  return 'cleaned:' + uid;
                }""")
                print("CLEANUP", res)
            except Exception as e:
                print("CLEANUP-ERR", str(e)[:80])

        print("ERRORS", json.dumps(errors[:12], ensure_ascii=False))
        print("FAILED", json.dumps(failed[:8], ensure_ascii=False))
        ctx2.close()
        ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
