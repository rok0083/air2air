/* =========================================================================
   dom.js — 화면/팝업/토스트/커튼 전환 등 UI 공통
   (팝업은 전부 밝은 크림 패널 + 금색 테두리 + 파란 리본)
   ========================================================================= */
import { Audio } from '../audio/audio.js';

export function el(tag, cls = '', html = '') {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html) n.innerHTML = html;
  return n;
}

export function $(sel) { return document.querySelector(sel); }
export function $$(sel) { return [...document.querySelectorAll(sel)]; }

export function fmt(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
}

export function toast(text, ms = 1800) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const t = el('div', 'toast', text);
  root.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .25s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 260);
  }, ms);
}

/* 팝업 — { title, body(HTMLElement|string), buttons:[{label,cls,onClick,close}], closable, wide } */
export function modal(opts = {}) {
  const root = document.getElementById('modal-root');
  const overlay = el('div', 'overlay');
  const panel = el('div', 'panel');
  if (opts.title) panel.appendChild(el('div', 'panel-ribbon', opts.title));
  if (opts.body instanceof HTMLElement) panel.appendChild(opts.body);
  else if (typeof opts.body === 'string') panel.insertAdjacentHTML('beforeend', opts.body);

  let closed = false;
  const close = () => {
    if (closed) return;          // onClose 가 두 번 불리지 않게
    closed = true;
    overlay.remove();
    Audio.play('close');
    opts.onClose?.();
  };
  const btnRow = el('div', 'btn-row');
  for (const b of opts.buttons || []) {
    const btn = el('button', `btn ${b.cls || 'green'}${b.small ? ' small' : ''}`, b.label);
    btn.type = 'button';
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;   // 연타로 두 번 처리되지 않게
      btn.disabled = true;
      Audio.play('button');
      let keep;
      try { keep = await b.onClick?.(); } catch (e) { console.error('[castle-pop] 팝업 버튼 처리 실패', e); }
      // onClick 이 false 를 돌려주면 팝업 유지, true 는 닫기 요청
      // (close:false 인 버튼도 true 를 돌려주면 닫힌다 — 이어하기가 overlay 에 갇히던 원인)
      if (keep === false) { btn.disabled = false; return; }
      if (keep === true || b.close !== false) close();
      else btn.disabled = false;
    });
    btnRow.appendChild(btn);
  }
  if ((opts.buttons || []).length) panel.appendChild(btnRow);

  if (opts.closable !== false) {
    const x = el('button', 'panel-close', '✕');
    x.type = 'button';
    x.addEventListener('click', close);
    panel.appendChild(x);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  }
  overlay.appendChild(panel);
  root.appendChild(overlay);
  Audio.play('popup');
  return { overlay, panel, close };
}

export function confirmModal({ title, text, yes = '네', no = '아니요', onYes }) {
  return new Promise(resolve => {
    modal({
      title,
      body: `<p>${text}</p>`,
      closable: false,
      buttons: [
        { label: no, cls: 'ghost', onClick: () => resolve(false) },
        { label: yes, cls: 'green', onClick: () => { onYes?.(); resolve(true); } },
      ],
    });
  });
}

/* 금색 커튼 전환 */
export function curtainTransition(midFn) {
  const c = document.getElementById('curtain');
  if (!c) { midFn?.(); return Promise.resolve(); }
  return new Promise(resolve => {
    c.classList.remove('opening');
    c.classList.add('closing');
    setTimeout(async () => {
      await midFn?.();
      c.classList.remove('closing');
      c.classList.add('opening');
      setTimeout(() => {
        c.classList.remove('opening');
        resolve();
      }, 540);
    }, 520);
  });
}

/* 캔버스를 CSS 픽셀 크기에 맞춰 DPR 스케일 */
export function fitCanvas(canvas, w, h) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, dpr };
}
