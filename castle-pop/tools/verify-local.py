#!/usr/bin/env python3
"""실제 플레이 검증 — 390x844 모바일 뷰포트, 끝까지 한 판 (승리/실패), 오류 수집."""
import os, sys, json
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/index.html"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/workspace/browser/castle-check"
os.makedirs(OUT, exist_ok=True)

errors, failed = [], []


def dismiss(page, tries=4):
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
        page.wait_for_timeout(500)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True, locale="ko-KR")
        page = ctx.new_page()
        page.on("console", lambda m: errors.append({"type": m.type, "text": m.text}) if m.type in ("error",) else None)
        page.on("pageerror", lambda e: errors.append({"type": "pageerror", "text": str(e)}))
        page.on("requestfailed", lambda r: failed.append({"url": r.url, "err": r.failure}))
        page.goto(URL, wait_until="load")
        page.wait_for_timeout(2500)

        inp = page.query_selector("#name-input")
        if inp:
            inp.fill("상봉")
            page.click("text=시작하기", force=True)
            page.wait_for_timeout(1200)
        dismiss(page)
        page.wait_for_timeout(900)
        page.screenshot(path=f"{OUT}/02-home.png")

        page.click("#play-btn", force=True)
        page.wait_for_timeout(900)
        page.screenshot(path=f"{OUT}/03-prelevel.png")
        if not page.query_selector("text=플레이 ▶"):
            print("NO PRELEVEL BUTTON", page.evaluate("document.getElementById('modal-root').innerText"))
        page.click("text=플레이 ▶", force=True)
        page.wait_for_timeout(1600)
        dismiss(page)
        page.wait_for_timeout(400)
        page.screenshot(path=f"{OUT}/04-level.png")

        layout = page.evaluate("""() => {
          const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return {x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height)}; };
          const g = window.__castlepop.game;
          return { hud: r('#hud'), board: r('#board'), tray: r('#tray'), cw: Math.round(g.cw), boardH: Math.round(g.boardH), originY: Math.round(g.originY) };
        }""")

        log = []
        screenshot_mid = False
        for i in range(40):
            st = page.evaluate("""() => {
              const g = window.__castlepop.game;
              if (!g || !g.board) return {noboard: true};
              return {moves: g.board.moves, empties: g.board.summary().emptyCells, resolving: g.resolving,
                      running: g.running, ended: g.ended, goals: g.board.goals.map(x => x.done + '/' + x.need),
                      modal: !!document.querySelector('#modal-root .overlay')};
            }""")
            log.append(st)
            if st.get("modal") and st.get("ended"):
                dismiss(page, 2)
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
            page.wait_for_timeout(950)
            if not screenshot_mid and i > 2:
                page.screenshot(path=f"{OUT}/05-play.png")
                screenshot_mid = True

        # 끝난 뒤: 모달 닫고 피날레/결과 확인
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{OUT}/06-result.png")
        end_state = page.evaluate("""() => {
          const g = window.__castlepop.game;
          const p = JSON.parse(localStorage.getItem('castlePop.profile.v1') || '{}');
          return { empties: g.board.summary().emptyCells, moves: g.board.moves, goals: g.board.goals.map(x => x.done + '/' + x.need),
                   won: g.board.goalComplete(), level: p.level, coins: p.coins, lives: p.lives, stars: p.stars,
                   modal: document.querySelector('#modal-root .panel-ribbon')?.textContent || null };
        }""")
        page.screenshot(path=f"{OUT}/07-after.png")
        print(json.dumps({"layout": layout, "end": end_state, "steps": log[-3:],
                          "errors": errors[:10], "failed": failed[:8]}, ensure_ascii=False, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
