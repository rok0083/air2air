#!/usr/bin/env python3
"""캐슬 팝 — 이어하기(+5 이동) · 다시 하기 · 나가기 · 다음 레벨 터치 검증

390x844 모바일 뷰포트 + 실제 터치 입력(CDP Input.dispatchTouchEvent)으로
  · 이동 수가 0이 될 때까지 실제 스와이프로 플레이 → '아깝다!' 팝업
  · +5 이동 탭 → 팝업 닫힘 · 이동 5 · 실제 스와이프로 이동 5→4
  · '다시 하기' 탭 → 팝업 닫힘 · 레벨 리셋 · 실제 스와이프로 이동 감소
  · '나가기' 탭 → 홈 화면
  · 클리어 → '계속 ▶' → 다음 레벨에서 터치 동작
를 확인하고, JS 오류 0건을 확인한다.
"""
import argparse
import json
import os
import sys

from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://127.0.0.1:8765/index.html")
ap.add_argument("--out", default="/workspace/work/castle-pop-fix/shots")
ap.add_argument("--tag", default="local")
ap.add_argument("--max-swipes", type=int, default=40)
args = ap.parse_args()

os.makedirs(args.out, exist_ok=True)
errors, failed = [], []
report = {"url": args.url, "tag": args.tag, "steps": [], "errors": [], "request_failed": []}


def shot(page, name):
    page.screenshot(path=f"{args.out}/{args.tag}-{name}.png")


def js_state(page):
    return page.evaluate(
        """() => {
          const g = window.__castlepop?.game;
          if (!g || !g.board) return {noboard: true};
          const ov = document.querySelector('#modal-root .overlay');
          return {
            ended: g.ended,
            running: g.running,
            resolving: g.resolving,
            moves: g.board.moves,
            score: g.board.score,
            levelId: g.levelId,
            continued: !!g.continued,
            bound: !!g._bound,
            overlay: !!ov,
            modalTitle: document.querySelector('#modal-root .panel-ribbon')?.textContent?.trim() || null,
            movesText: document.getElementById('moves-num')?.textContent?.trim() || null,
            homeVisible: !document.getElementById('screen-home').classList.contains('hidden'),
            gameVisible: !document.getElementById('screen-game').classList.contains('hidden'),
            empties: g.board.summary ? g.board.summary().emptyCells : null,
          };
        }"""
    )


def wait_for(page, js_pred, timeout=15000, step=200):
    waited = 0
    while waited < timeout:
        try:
            if page.evaluate(js_pred):
                return True
        except Exception:
            pass
        page.wait_for_timeout(step)
        waited += step
    return False


def hint_px(page):
    return page.evaluate(
        """() => {
          const g = window.__castlepop.game;
          const h = g.board.findHint();
          if (!h) return null;
          const a = g.cellPx(h.a[0], h.a[1]);
          const b = g.cellPx(h.b[0], h.b[1]);
          const rect = g.boardCanvas.getBoundingClientRect();
          return {ax: rect.left + a.x, ay: rect.top + a.y, bx: rect.left + b.x, by: rect.top + b.y,
                  cell: g.cw};
        }"""
    )


def touch_swipe(page, cdp, h, steps=8):
    """실제 터치 드래그 (CDP) — 손가락으로 조각을 민다."""
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": h["ax"], "y": h["ay"]}]})
    for i in range(1, steps + 1):
        x = h["ax"] + (h["bx"] - h["ax"]) * i / steps
        y = h["ay"] + (h["by"] - h["ay"]) * i / steps
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y}]})
        page.wait_for_timeout(16)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


def real_move(page, cdp, label=""):
    """힌트 자리를 실제 터치 스와이프로 한 수 둔다."""
    before = js_state(page)
    h = hint_px(page)
    if not h:
        page.wait_for_timeout(500)
        h = hint_px(page)
    if not h:
        return {"ok": False, "reason": "no-hint", "before": before}
    touch_swipe(page, cdp, h)
    wait_for(page, "() => window.__castlepop.game.resolving === 0", timeout=8000)
    page.wait_for_timeout(350)
    after = js_state(page)
    accepted = (after["moves"] != before["moves"]) or ((after.get("score") or 0) > (before.get("score") or 0))
    return {"accepted": accepted, "moves": f"{before['moves']}->{after['moves']}",
            "score": f"{before.get('score')}->{after.get('score')}",
            "dropBonus": after["moves"] > before["moves"], "label": label}


def nerf_goals(page):
    """검증용: 목표를 크게 잡아 '클리어'가 먼저 뜨지 않게 한다 (이동 수 소진 경로만 본다)."""
    page.evaluate("() => { const g = window.__castlepop.game; g.board.goals.forEach(x => { x.need = 9999; x.done = 0; }); g.updateGoals(); }")


def force_fail(page, cdp, tries=5):
    """이동 수를 1로 떨어뜨린 뒤 실제 스와이프로 0을 만들어 '아깝다!' 팝업을 띄운다.
    (이동 수 드롭 아이템을 먹으면 다시 늘어날 수 있어 여러 번 시도한다)"""
    for i in range(tries):
        if js_state(page).get("overlay"):
            return True
        nerf_goals(page)
        page.evaluate("() => { const g = window.__castlepop.game; if (g.board.moves > 0) { g.board.moves = 1; g.updateMoves(); } }")
        page.wait_for_timeout(250)
        real_move(page, cdp, f"force-fail-{i}")
        if wait_for(page, "() => !!document.querySelector('#modal-root .panel-ribbon')", timeout=5000):
            return True
        page.wait_for_timeout(400)
    return bool(js_state(page).get("overlay"))


def tap(page, selector):
    page.locator(selector).first.tap()


def tap_text(page, text):
    page.locator(f"#modal-root .panel button:has-text('{text}')").first.tap()


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
        page.wait_for_timeout(500)


def record(name, data):
    data["step"] = name
    report["steps"].append(data)
    print(f"[{name}] {json.dumps(data, ensure_ascii=False)}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True, locale="ko-KR")
        page = ctx.new_page()
        cdp = ctx.new_cdp_session(page)
        page.on("console", lambda m: errors.append({"type": m.type, "text": m.text[:200]}) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append({"type": "pageerror", "text": str(e)[:200]}))
        page.on("requestfailed", lambda r: failed.append({"url": r.url[-90:], "err": r.failure}))

        page.goto(args.url, wait_until="load")
        page.wait_for_timeout(4500)

        # 이름 입력(첫 실행) · 홈
        if page.query_selector("#name-input"):
            page.fill("#name-input", "상봉")
            page.click("text=시작하기", force=True)
            page.wait_for_timeout(1500)
        dismiss(page)
        wait_for(page, "() => !document.getElementById('screen-home').classList.contains('hidden')", timeout=20000)
        page.wait_for_timeout(500)
        record("home", js_state(page))
        # start() 호출 추적 (엉뚱한 판이 끼어드는지 확인용)
        page.evaluate("""() => {
          const g = window.__castlepop.game;
          window.__starts = [];
          const orig = g.start.bind(g);
          g.start = (...a) => {
            window.__starts.push({
              t: Math.round(performance.now()),
              arg: (a[0] && typeof a[0] === 'object') ? ('obj:' + a[0].id) : String(a[0]),
              custom: !!(a[1] && a[1].custom),
              stack: (new Error().stack || '').split('\\n').slice(2, 4).join(' | '),
            });
            return orig(...a);
          };
        }""")

        # ---- 레벨 시작
        page.click("#play-btn", force=True)
        page.wait_for_timeout(900)
        page.click("text=플레이 ▶", force=True)
        wait_for(page, "() => window.__castlepop?.game?.running === true", timeout=20000)
        page.wait_for_timeout(1600)
        dismiss(page, 2)          # 새 장애물 안내 등
        page.wait_for_timeout(300)
        # 검증용: 목표를 아주 크게 잡아 '클리어'가 먼저 뜨지 않게 한다 (이동 수 소진 경로만 본다)
        nerf_goals(page)
        record("level-start", js_state(page))

        # ---- 실제 스와이프로 이동 수 0까지 플레이
        played = 0
        for i in range(args.max_swipes):
            st = js_state(page)
            if st.get("overlay") and st.get("modalTitle"):
                break
            if st.get("moves", 0) <= 0:
                break
            r = real_move(page, cdp, f"play-{i}")
            played += 1
            if not r["accepted"]:
                # 힌트가 일시적으로 없거나 연쇄 중 — 잠시 뒤 재시도
                page.wait_for_timeout(500)
            if js_state(page).get("overlay"):
                break
        wait_for(page, "() => !!document.querySelector('#modal-root .panel-ribbon')", timeout=8000)
        page.wait_for_timeout(700)
        st = js_state(page)
        shot(page, "01-fail-modal")
        record("reached-fail-modal", {"played": played, **st})

        # ---- +5 이동 (이어하기)
        before = js_state(page)
        tap_text(page, "+5")
        page.wait_for_timeout(900)
        after = js_state(page)
        shot(page, "02-after-continue")
        record("continue-tap", {"before": {k: before[k] for k in ("ended", "moves", "overlay", "modalTitle")},
                                "after": {k: after[k] for k in ("ended", "running", "moves", "overlay", "modalTitle",
                                                                "movesText", "resolving", "bound")}})
        cont_move = real_move(page, cdp, "after-continue")
        shot(page, "03-continue-swipe")
        record("continue-swipe", {**cont_move, "boardAfter": js_state(page)})

        # ---- 다시 실패시켜 '다시 하기' 검증
        force_fail(page, cdp)
        page.wait_for_timeout(600)
        st = js_state(page)
        shot(page, "04-fail-modal-2")
        record("reached-fail-modal-2", st)

        before = js_state(page)
        tap_text(page, "다시 하기")
        page.wait_for_timeout(1800)
        after = js_state(page)
        shot(page, "05-after-retry")
        retry_state = js_state(page)
        nerf_goals(page)          # 새 판에서 우연히 클리어되지 않게
        record("retry-tap", {"before": {k: before[k] for k in ("ended", "moves", "overlay")},
                             "after": {k: after[k] for k in ("ended", "running", "moves", "overlay", "modalTitle",
                                                             "resolving", "bound", "continued", "gameVisible")}})
        retry_move = real_move(page, cdp, "after-retry")
        shot(page, "06-retry-swipe")
        retry_move2 = real_move(page, cdp, "after-retry-2")
        record("retry-swipe", {**retry_move, "second": retry_move2, "boardAfter": js_state(page)})

        # ---- 나가기 → 홈
        force_fail(page, cdp)
        page.wait_for_timeout(600)
        tap_text(page, "나가기")
        page.wait_for_timeout(1500)
        shot(page, "07-after-quit")
        record("quit-tap", js_state(page))

        # ---- 클리어 → 계속 ▶ → 다음 레벨 터치
        page.wait_for_timeout(400)
        page.click("#play-btn", force=True)
        page.wait_for_timeout(900)
        page.click("text=플레이 ▶", force=True)
        wait_for(page, "() => window.__castlepop?.game?.running === true", timeout=20000)
        page.wait_for_timeout(1600)
        dismiss(page, 2)
        win_before = js_state(page)
        page.evaluate("""() => { const g = window.__castlepop.game;
            g.board.goals.forEach(x => { x.done = x.need; }); g.afterResolve(); }""")
        wait_for(page, "() => !!document.querySelector('#modal-root .panel-ribbon')", timeout=25000)
        page.wait_for_timeout(800)
        shot(page, "08-win-modal")
        record("win-modal", {"before": win_before, "after": js_state(page)})
        tap_text(page, "계속")
        page.wait_for_timeout(2600)
        next_state = js_state(page)
        shot(page, "09-next-level")
        record("next-level", next_state)
        next_move = real_move(page, cdp, "next-level")
        record("next-level-swipe", {**next_move, "boardAfter": js_state(page)})
        shot(page, "10-next-level-swipe")

        # ---- 설정(일시정지) 버튼이 한 번만 열리는지 (bind 중복 리스너 회귀)
        page.tap("#hud-close")
        page.wait_for_timeout(700)
        overlays = page.evaluate("() => document.querySelectorAll('#modal-root .overlay').length")
        shot(page, "11-settings")
        record("settings-open", {"overlays": overlays})
        tap_text(page, "계속하기")
        page.wait_for_timeout(500)
        record("settings-close", js_state(page))

        # ---- 이벤트(커스텀 레벨) 시간 종료 → '다시 도전'
        page.evaluate("() => window.__castlepop.toHome()")
        page.wait_for_timeout(1500)
        page.evaluate("() => window.__castlepop.events.play('kingRescue')")
        wait_for(page, "() => window.__castlepop?.game?.running === true && window.__castlepop.game.levelId === 'rescue'", timeout=20000)
        page.wait_for_timeout(1500)
        record("event-start", js_state(page))
        page.evaluate("() => { window.__castlepop.game.secondsLeft = 0.2; }")
        wait_for(page, "() => !!document.querySelector('#modal-root .panel-ribbon')", timeout=10000)
        page.wait_for_timeout(700)
        shot(page, "12-event-timeout")
        ev_before = js_state(page)
        tap_text(page, "다시 도전")
        page.wait_for_timeout(2600)
        shot(page, "13-event-retry")
        record("event-retry-tap", {"before": {k: ev_before[k] for k in ("ended", "moves", "overlay", "modalTitle")},
                                   "after": js_state(page)})
        ev_move = real_move(page, cdp, "event-retry")
        record("event-retry-swipe", {**ev_move, "boardAfter": js_state(page)})
        shot(page, "14-event-retry-swipe")

        print("STARTS", json.dumps(page.evaluate("() => window.__starts"), ensure_ascii=False))
        report["starts"] = page.evaluate("() => window.__starts")
        report["errors"] = errors[:20]
        report["request_failed"] = failed[:10]
        print("ERRORS", json.dumps(errors[:10], ensure_ascii=False))
        print("REQFAILED", json.dumps(failed[:6], ensure_ascii=False))

        # 검증 중 만든 내 문서 정리 (본인 문서만 삭제 가능)
        try:
            res = page.evaluate("""async () => {
              const cfg = await import('./js/firebase/config.js');
              const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
              const uid = cfg.FB.uid;
              if (!uid) return 'no-uid';
              for (let round = 0; round < 3; round++) {
                for (const col of ['cp_users', 'cp_leaderboard', 'cp_rush']) {
                  try { await fs.deleteDoc(fs.doc(cfg.FB.db, col, uid)); } catch (e) {}
                }
                await new Promise(r => setTimeout(r, 2400));
              }
              return 'cleaned:' + uid;
            }""")
            print("CLEANUP", res)
            report["cleanup"] = res
        except Exception as e:
            print("CLEANUP-ERR", str(e)[:120])
            report["cleanup"] = f"error: {e}"

        with open(f"{args.out}/{args.tag}-report.json", "w") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
