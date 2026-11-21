/* =========================================================================
   DOM 도우미 — 요소 생성, 모달, 토스트, 숫자 포맷, 공용 SVG 아이콘
   ========================================================================= */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmt = (n) => Math.round(n || 0).toLocaleString('ko-KR');

export function timeLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/* ── 토스트 ─────────────────────────────────────────────── */
let toastTimer = null;
export function toast(message, type = 'info', ms = 2200) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const node = el('div', { class: `toast toast-${type}` }, message);
  root.append(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 300);
  }, ms);
  clearTimeout(toastTimer);
}

/* ── 모달 ───────────────────────────────────────────────── */
export function openModal({ title = '', subtitle = '', body = '', actions = [], className = '', onClose = null, closable = true }) {
  const root = document.getElementById('modal-root');
  if (!root) return null;
  const overlay = el('div', { class: `modal-overlay ${className}` });
  const panel = el('div', { class: 'modal-panel', role: 'dialog', 'aria-modal': 'true' });

  const head = el('div', { class: 'modal-head' },
    el('div', {},
      title ? el('h2', { class: 'modal-title' }, title) : null,
      subtitle ? el('p', { class: 'modal-sub' }, subtitle) : null,
    ),
    closable ? el('button', { class: 'icon-btn modal-close', 'aria-label': '닫기', html: ICONS.close, onclick: () => close() }) : null,
  );
  panel.append(head);
  const bodyWrap = el('div', { class: 'modal-body' });
  if (typeof body === 'string') bodyWrap.innerHTML = body;
  else if (body) bodyWrap.append(body);
  panel.append(bodyWrap);

  if (actions.length) {
    // a.full 이 있는 모달은 세로로 쌓아 주 버튼(게임 시작)이 폭 전체를 차지합니다.
    const stacked = actions.some(a => a.full);
    const foot = el('div', { class: `modal-foot ${stacked ? 'stacked' : ''}` });
    for (const a of actions) {
      const btn = el('button', { class: `btn ${a.class || 'btn-ghost'} ${a.wide ? 'wide' : ''} ${a.full ? 'full' : ''}`, onclick: async () => { a.onClick ? await a.onClick(close) : close(); } });
      // 라벨에 SVG 마크업이 섞여 들어와도 글자로 새지 않도록: html 은 innerHTML, label 은 텍스트로만.
      if (a.html) btn.innerHTML = a.html;
      else btn.textContent = String(a.label ?? '');
      if (a.ariaLabel) btn.setAttribute('aria-label', a.ariaLabel);
      if (a.disabled) btn.disabled = true;
      foot.append(btn);
    }
    panel.append(foot);
  }
  overlay.append(panel);
  overlay.addEventListener('click', (e) => { if (e.target === overlay && closable) close(); });
  root.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  function close() {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 220);
    onClose?.();
  }
  return { overlay, panel, close, body: bodyWrap };
}

export function closeAllModals() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

/* ── 아이콘 (인라인 SVG, 이모지 미사용) ─────────────────── */
/* 게임 시작 버튼용 ▶ 배지 — 버튼 안에서 항상 또렷하게 보이도록 원형 배경 위에 얹습니다. */
export const PLAY_BADGE = '<span class="play-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 5.2 20 12 9 18.8z" fill="currentColor"/></svg></span>';

export const ICONS = {
  coin: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="9" fill="#ffc93c"/><circle cx="12" cy="12" r="6.5" fill="#ffe38a"/><path d="M9.5 12.5h5M12 9.6v5.8" stroke="#a86f00" stroke-width="1.6" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 3.4l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.6l5.9-.8z" fill="#ffd166" stroke="#c98a00" stroke-width="1"/></svg>',
  hammer: '<svg viewBox="0 0 24 24" class="ic"><path d="M6 18l7-7" stroke="#b07a45" stroke-width="2.6" stroke-linecap="round"/><path d="M11 6l7 7-2.4 2.4-7-7z" fill="#8b8fa3"/><path d="M4 20l3-3" stroke="#8b8fa3" stroke-width="3"/></svg>',
  heart: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 20s-7-4.4-7-9.2A4 4 0 0112 7a4 4 0 017 3.8C19 15.6 12 20 12 20z" fill="#ff5b7f"/></svg>',
  gem: '<svg viewBox="0 0 24 24" class="ic"><path d="M7 4h10l4 6-9 11L3 10z" fill="#4d9dff"/><path d="M7 4l5 6 5-6M3 10h18" stroke="#dfeeff" stroke-width="1.2"/></svg>',
  shop: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 9h16l-1.2-4H5.2z" fill="#ffc93c"/><path d="M5 9v10h14V9" fill="none" stroke="#ffc93c" stroke-width="1.8"/><path d="M9 19v-6h6v6" fill="none" stroke="#ffc93c" stroke-width="1.6"/></svg>',
  chart: '<svg viewBox="0 0 24 24" class="ic"><rect x="4" y="12" width="4" height="8" rx="1" fill="#4d9dff"/><rect x="10" y="7" width="4" height="13" rx="1" fill="#3ddc84"/><rect x="16" y="10" width="4" height="10" rx="1" fill="#ffc93c"/></svg>',
  gear: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="3.2" fill="none" stroke="#cfe4ff" stroke-width="2"/><path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3L5.6 5.6" stroke="#cfe4ff" stroke-width="2" stroke-linecap="round"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" class="ic"><path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="#ffd166"/></svg>',
  crown: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 8l4 3 4-6 4 6 4-3-2 11H6z" fill="#ffd166" stroke="#c98a00" stroke-width="1"/></svg>',
  lock: '<svg viewBox="0 0 24 24" class="ic"><rect x="5" y="10" width="14" height="10" rx="2" fill="#8b8fa3"/><path d="M8 10V8a4 4 0 018 0v2" fill="none" stroke="#8b8fa3" stroke-width="2"/><circle cx="12" cy="15" r="1.6" fill="#2a2a35"/></svg>',
  check: '<svg viewBox="0 0 24 24" class="ic"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#3ddc84" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" class="ic"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" class="ic"><path d="M14 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" class="ic"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>',
  hint: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9V17h5v-1.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z" fill="#ffe066"/><rect x="10" y="18.5" width="4" height="2" rx="1" fill="#ffe066"/></svg>',
  sound: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#cfe4ff"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="#cfe4ff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#8b8fa3"/><path d="M16 9l5 6M21 9l-5 6" stroke="#8b8fa3" stroke-width="2" stroke-linecap="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24" class="ic"><rect x="6" y="4" width="4" height="16" rx="1.5" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1.5" fill="currentColor"/></svg>',
  boss: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7z" fill="#8b6cff"/><circle cx="9.5" cy="11" r="1.4" fill="#1a1230"/><circle cx="14.5" cy="11" r="1.4" fill="#1a1230"/><path d="M9 15c2 1.4 4 1.4 6 0" stroke="#1a1230" stroke-width="1.4" fill="none"/></svg>',
  seed: '<svg viewBox="0 0 24 24" class="ic"><ellipse cx="12" cy="13" rx="6" ry="7" fill="#a4651f"/><path d="M12 6c0-2 1.5-3 3-3" stroke="#6fae4a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  brick: '<svg viewBox="0 0 24 24" class="ic"><rect x="3.5" y="6" width="17" height="5.2" rx="1.4" fill="#e07a4a"/><rect x="3.5" y="12.6" width="8" height="5.4" rx="1.4" fill="#c9613a"/><rect x="13.4" y="12.6" width="7.1" height="5.4" rx="1.4" fill="#c9613a"/></svg>',
  users: '<svg viewBox="0 0 24 24" class="ic"><circle cx="9" cy="9" r="3" fill="#cfe4ff"/><path d="M4 19c0-3 2.5-5 5-5s5 2 5 5z" fill="#cfe4ff"/><circle cx="17" cy="10" r="2.4" fill="#8b8fa3"/><path d="M14 19c0-2.4 1.4-4 3-4s3 1.6 3 4z" fill="#8b8fa3"/></svg>',
};
