#!/usr/bin/env python3
"""v2 아트/연출 캡처 — 라이브(또는 로컬) 390x844
   · v2-home-ui.png     홈 화면 전체
   · v2-play-gems.png   인게임 보드(조각·UI)
   · v2-fall-anim.png   낙하 중 프레임(여러 지연 중 가장 잘 보인 것)
   · v2-pop-anim.png    팝(터지는) 프레임
"""
import sys, json
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://rok0083.github.io/air2air"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/workspace/games/castle-pop/screenshots"
BASE = BASE.rstrip("/")
errors, failed = [], []


def dismiss(page, tries=6):
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
        page.wait_for_timeout(400)


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3,
                            is_mobile=True, has_touch=True, locale="ko-KR")
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(m.text[:200]) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        page.on("requestfailed", lambda r: failed.append(r.url[:90]))
        page.goto(f"{BASE}/castle-pop/index.html", wait_until="load")
        page.wait_for_timeout(5000)
        if page.query_selector("#name-input"):
            page.fill("#name-input", "상봉")
            page.click("text=시작하기", force=True)
            page.wait_for_timeout(1500)
        dismiss(page)
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{OUT}/v2-home-ui.png")

        page.click("#play-btn", force=True)
        page.wait_for_timeout(900)
        page.click("text=플레이 ▶", force=True)
        page.wait_for_timeout(2000)
        dismiss(page)
        page.wait_for_timeout(700)
        page.screenshot(path=f"{OUT}/v2-play-gems.png")

        box = page.evaluate("""() => { const r = window.__castlepop.game.boardCanvas.getBoundingClientRect();
          return {x: r.left, y: r.top, w: r.width, h: r.height}; }""")
        clip = {"x": 0, "y": max(0, box["y"] - 8), "width": 390,
                "height": min(844 - max(0, box["y"] - 8), box["h"] + 26)}

        def hint():
            return page.evaluate("""() => {
              const g = window.__castlepop.game;
              const h = g.board.findHint(); if (!h) return null;
              const a = g.cellPx(h.a[0], h.a[1]), b = g.cellPx(h.b[0], h.b[1]);
              const rect = g.boardCanvas.getBoundingClientRect();
              return {ax: rect.left + a.x, ay: rect.top + a.y, bx: rect.left + b.x, by: rect.top + b.y};
            }""")

        # 여러 번 스와이프하며 서로 다른 지연에 캡처 → 낙하/팝 프레임 확보
        for i, d in enumerate([40, 90, 140, 190, 240, 300, 380]):
            h = hint()
            if not h:
                page.wait_for_timeout(500)
                continue
            page.mouse.move(h["ax"], h["ay"])
            page.mouse.down()
            page.mouse.move((h["ax"] + h["bx"]) / 2, (h["ay"] + h["by"]) / 2, steps=3)
            page.mouse.move(h["bx"], h["by"], steps=2)
            page.mouse.up()
            page.wait_for_timeout(d)
            page.screenshot(path=f"{OUT}/tmp-frame-{i}-{d}.png", clip=clip)
            page.wait_for_timeout(1200)

        print("STATE", json.dumps(page.evaluate("""() => { const g = window.__castlepop.game;
            return {empties: g.board.summary().emptyCells, moves: g.board.moves,
                    goals: g.board.goals.map(x => x.done + '/' + x.need)}; }"""), ensure_ascii=False))
        print("ERRORS", json.dumps(errors[:8], ensure_ascii=False))
        print("FAILED", json.dumps(failed[:6], ensure_ascii=False))
        b.close()


if __name__ == "__main__":
    main()
